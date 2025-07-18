const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const prismarineAuth = require('prismarine-auth');

const { Authflow, Titles } = prismarineAuth;

/**
 * Enhanced Authentication Manager with token management and health monitoring
 */
class AuthManager extends EventEmitter {
    constructor(options) {
        super();
        
        this.accounts = options.accounts || [];
        this.tokenPath = options.tokenPath || './auth/';
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 5000;
        this.serverId = options.serverId;
        this.logger = options.logger;
        
        this.authenticatedAccounts = new Map();
        this.authFlows = new Map();
        this.tokenRefreshTimers = new Map();
        
        this.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Ensure auth directory exists
        this.ensureAuthDirectory();
    }

    ensureAuthDirectory() {
        if (!fs.existsSync(this.tokenPath)) {
            fs.mkdirSync(this.tokenPath, { recursive: true });
            this.logger.debug(`📁 [${this.serverId}] Created auth directory: ${this.tokenPath}`);
        }
    }

    async initializeAccounts() {
        this.logger.info(`🔐 [${this.serverId}] Initializing ${this.accounts.length} Xbox Live accounts...`);
        
        const authPromises = this.accounts.map(email => this.authenticateAccount(email));
        const results = await Promise.allSettled(authPromises);
        
        const successful = [];
        const failed = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successful.push(result.value);
            } else {
                failed.push({
                    email: this.accounts[index],
                    error: result.reason.message
                });
            }
        });
        
        if (failed.length > 0) {
            this.logger.warning(`⚠️ [${this.serverId}] ${failed.length} account(s) failed to authenticate:`);
            failed.forEach(f => {
                this.logger.warning(`   ❌ ${f.email}: ${f.error}`);
                this.emit('authenticationFailed', f);
            });
        }
        
        if (successful.length === 0) {
            throw new Error('No accounts could be authenticated successfully');
        }
        
        this.logger.success(`✅ [${this.serverId}] ${successful.length}/${this.accounts.length} accounts authenticated successfully`);
        return successful;
    }

    async authenticateAccount(email, attempt = 1) {
        try {
            this.logger.info(`🔐 [${this.serverId}] Authenticating ${email} (attempt ${attempt}/${this.maxRetries + 1})...`);
            
            // Try different authentication methods
            const authMethods = [
                { title: Titles.MinecraftJava, name: 'Java' },
                { title: Titles.MinecraftAndroid, name: 'Android' },
                { title: Titles.MinecraftNintendoSwitch, name: 'Switch' }
            ];
            
            for (const method of authMethods) {
                try {
                    const client = await this.tryAuthenticationMethod(email, method.title, method.name);
                    
                    // Store authenticated account
                    this.authenticatedAccounts.set(email, client);
                    
                    // Schedule token refresh
                    this.scheduleTokenRefresh(email, client);
                    
                    this.emit('accountAuthenticated', { email, xuid: client.xuid, method: method.name });
                    this.logger.success(`✅ [${this.serverId}] ${email} authenticated via ${method.name}`);
                    
                    return client;
                    
                } catch (methodError) {
                    this.logger.debug(`🔍 [${this.serverId}] ${method.name} auth failed for ${email}: ${methodError.message}`);
                    continue; // Try next method
                }
            }
            
            throw new Error('All authentication methods failed');
            
        } catch (error) {
            if (attempt <= this.maxRetries) {
                this.logger.warning(`⚠️ [${this.serverId}] Auth attempt ${attempt} failed for ${email}, retrying in ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay * attempt); // Exponential backoff
                return this.authenticateAccount(email, attempt + 1);
            }
            
            this.logger.error(`❌ [${this.serverId}] Authentication failed for ${email} after ${this.maxRetries + 1} attempts`);
            this.provideAuthenticationGuidance(email, error);
            throw error;
        }
    }

    async tryAuthenticationMethod(email, authTitle, methodName) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout - 15 minutes exceeded'));
            }, 15 * 60 * 1000); // 15 minute timeout

            const authflow = new Authflow(email, this.tokenPath, {
                authTitle,
                flow: 'msal'
            }, (response) => {
                if (response && response.userCode) {
                    this.logger.info(`🔐 [${this.serverId}] Microsoft authentication required for ${email}`);
                    this.logger.info(`📱 Visit: https://microsoft.com/link`);
                    this.logger.info(`🔑 Enter device code: ${response.userCode}`);
                    this.logger.info(`⏰ You have ${Math.floor(response.expiresIn / 60)} minutes to complete authentication`);
                    this.logger.info(`📋 Authentication method: ${methodName}`);
                    this.logger.info(`📋 Instructions:`);
                    this.logger.info(`   1. Go to https://microsoft.com/link in your browser`);
                    this.logger.info(`   2. Enter code: ${response.userCode}`);
                    this.logger.info(`   3. Sign in with: ${email}`);
                    this.logger.info(`   4. Wait for authentication to complete...`);
                } else {
                    this.logger.warning(`⚠️ [${this.serverId}] Device code callback received but no user code provided`);
                }
            });

            // Store authflow for potential cleanup
            this.authFlows.set(email, authflow);

            authflow.getXboxToken().then(token => {
                clearTimeout(timeout);
                
                const client = {
                    email,
                    xuid: token.userXUID,
                    userHash: token.userHash,
                    xstsToken: token.XSTSToken,
                    authHeader: `XBL3.0 x=${token.userHash};${token.XSTSToken}`,
                    token,
                    authMethod: methodName,
                    authenticatedAt: Date.now(),
                    expiresAt: token.NotAfter ? new Date(token.NotAfter).getTime() : Date.now() + (24 * 60 * 60 * 1000) // 24h default
                };
                
                resolve(client);
                
            }).catch(error => {
                clearTimeout(timeout);
                reject(error);
            }).finally(() => {
                this.authFlows.delete(email);
            });
        });
    }

    scheduleTokenRefresh(email, client) {
        // Clear any existing refresh timer
        if (this.tokenRefreshTimers.has(email)) {
            clearTimeout(this.tokenRefreshTimers.get(email));
        }

        // Schedule refresh for 1 hour before expiration
        const refreshTime = client.expiresAt - Date.now() - (60 * 60 * 1000);
        const refreshDelay = Math.max(refreshTime, 60 * 60 * 1000); // At least 1 hour from now

        const timer = setTimeout(async () => {
            try {
                await this.refreshAccountToken(email);
            } catch (error) {
                this.logger.error(`❌ [${this.serverId}] Token refresh failed for ${email}:`, error.message);
            }
        }, refreshDelay);

        this.tokenRefreshTimers.set(email, timer);
        this.logger.debug(`⏰ [${this.serverId}] Token refresh scheduled for ${email} in ${Math.floor(refreshDelay / 1000)}s`);
    }

    async refreshAccountToken(email) {
        try {
            this.logger.info(`🔄 [${this.serverId}] Refreshing token for ${email}...`);
            
            const oldClient = this.authenticatedAccounts.get(email);
            if (!oldClient) {
                throw new Error('Account not found in authenticated accounts');
            }

            // Re-authenticate the account
            const newClient = await this.authenticateAccount(email, 1);
            
            this.logger.success(`✅ [${this.serverId}] Token refreshed for ${email}`);
            this.emit('tokenRefreshed', { email, xuid: newClient.xuid });
            
            return newClient;
            
        } catch (error) {
            this.logger.error(`❌ [${this.serverId}] Token refresh failed for ${email}:`, error.message);
            throw error;
        }
    }

    async refreshTokens() {
        this.logger.info(`🔄 [${this.serverId}] Refreshing all tokens...`);
        
        const refreshPromises = Array.from(this.authenticatedAccounts.keys()).map(email => 
            this.refreshAccountToken(email).catch(error => ({ email, error }))
        );
        
        const results = await Promise.all(refreshPromises);
        
        const failed = results.filter(r => r.error);
        if (failed.length > 0) {
            this.logger.warning(`⚠️ [${this.serverId}] ${failed.length} token refresh(es) failed:`);
            failed.forEach(f => this.logger.warning(`   ❌ ${f.email}: ${f.error.message}`));
        }
        
        this.logger.success(`✅ [${this.serverId}] Token refresh completed`);
    }

    provideAuthenticationGuidance(email, error) {
        this.logger.error(`❌ ===============================`);
        this.logger.error(`❌ AUTHENTICATION FAILED`);
        this.logger.error(`❌ ===============================`);
        this.logger.error(`❌ Account: ${email}`);
        this.logger.error(`❌ Error: ${error.message}`);
        this.logger.error(`❌ Common causes:`);
        this.logger.error(`❌   1. Account doesn't own Minecraft`);
        this.logger.error(`❌   2. Account has no Xbox Live access`);
        this.logger.error(`❌   3. Account hasn't played Minecraft before`);
        this.logger.error(`❌   4. Network/authentication server issues`);
        this.logger.error(`❌   5. Two-factor authentication required`);
        this.logger.error(`❌ ===============================`);
        this.logger.error(`❌ Solutions:`);
        this.logger.error(`❌   1. Use demo mode: Set "demoMode": true in config.json`);
        this.logger.error(`❌   2. Use different account that owns Minecraft`);
        this.logger.error(`❌   3. Purchase Minecraft for this account`);
        this.logger.error(`❌   4. Check Xbox Live account status`);
        this.logger.error(`❌   5. Complete authentication within time limit`);
        this.logger.error(`❌ ===============================`);
    }

    getAuthenticatedAccounts() {
        return Array.from(this.authenticatedAccounts.values());
    }

    async getHealthStatus() {
        try {
            const now = Date.now();
            const accounts = Array.from(this.authenticatedAccounts.values());
            
            if (accounts.length === 0) {
                return { healthy: false, reason: 'No authenticated accounts' };
            }

            // Check for expiring tokens (within 1 hour)
            const expiringSoon = accounts.filter(account => 
                account.expiresAt && (account.expiresAt - now) < (60 * 60 * 1000)
            );

            if (expiringSoon.length > 0) {
                return { 
                    healthy: false, 
                    reason: `${expiringSoon.length} account(s) have tokens expiring soon`,
                    expiringAccounts: expiringSoon.map(a => a.email)
                };
            }

            return { 
                healthy: true, 
                accountCount: accounts.length,
                accountStatus: accounts.map(a => ({
                    email: a.email,
                    xuid: a.xuid,
                    method: a.authMethod,
                    expiresAt: a.expiresAt
                }))
            };

        } catch (error) {
            return { healthy: false, reason: `Health check error: ${error.message}` };
        }
    }

    async stop() {
        this.logger.info(`🛑 [${this.serverId}] Stopping auth manager...`);
        
        // Clear all timers
        for (const timer of this.tokenRefreshTimers.values()) {
            clearTimeout(timer);
        }
        this.tokenRefreshTimers.clear();
        
        // Cancel any pending auth flows
        for (const authflow of this.authFlows.values()) {
            try {
                // Note: prismarine-auth doesn't have a cancel method, 
                // so we just clear our references
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        this.authFlows.clear();
        
        this.logger.success(`✅ [${this.serverId}] Auth manager stopped`);
    }
}

module.exports = { AuthManager };
