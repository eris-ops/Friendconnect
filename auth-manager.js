const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const prismarineAuth = require('prismarine-auth');
const { XboxAuthRecovery } = require('./xbox-auth-recovery');

const { Authflow, Titles } = prismarineAuth;

/**
 * Simplified Authentication Manager based on jrcarl624/FriendConnect approach
 */
class AuthManager extends EventEmitter {
    constructor(options) {
        super();

        this.accounts = options.accounts || [];
        this.tokenPath = options.tokenPath || './auth/';
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 5000;
        this.preferredMethod = options.preferredMethod || 'switch';
        this.serverId = options.serverId;
        this.logger = options.logger;

        this.authenticatedAccounts = new Map();
        this.authFlows = new Map();
        this.tokenRefreshTimers = new Map();

        this.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Initialize simplified Xbox authentication
        this.xboxAuthRecovery = new XboxAuthRecovery({
            logger: this.logger,
            tokenPath: this.tokenPath,
            maxRetries: 3,
            retryDelay: 5000
        });

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
        this.logger.info(`🔐 [${this.serverId}] Starting Microsoft authentication process...`);
        return await this.promptForMicrosoftAuthentication();
    }

    async authenticateAccount(email, attempt = 1) {
        try {
            this.logger.info(`🔐 [${this.serverId}] Authenticating ${email} (attempt ${attempt}/${this.maxRetries + 1})...`);

            // Use Nintendo Switch method by default (most reliable for Bedrock)
            const authTitle = Titles.MinecraftNintendoSwitch;
            const deviceType = 'Nintendo';
            const methodName = 'Switch';

            const client = await this.xboxAuthRecovery.authenticateWithRecovery(email, {
                authTitle,
                deviceType,
                methodName,
                timeout: 15 * 60 * 1000 // 15 minutes
            });

            // Store authenticated account
            this.authenticatedAccounts.set(email, client);

            // Schedule token refresh
            this.scheduleTokenRefresh(email, client);

            this.emit('accountAuthenticated', { email, xuid: client.xuid, method: methodName });
            this.logger.success(`✅ [${this.serverId}] ${email} authenticated successfully`);

            return client;

        } catch (error) {
            if (attempt <= this.maxRetries) {
                this.logger.warning(`⚠️ [${this.serverId}] Auth attempt ${attempt} failed for ${email}, retrying in ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay * attempt);
                return this.authenticateAccount(email, attempt + 1);
            }

            this.logger.error(`❌ [${this.serverId}] Authentication failed for ${email} after ${this.maxRetries + 1} attempts`);
            this.provideAuthenticationGuidance(email, error);
            throw error;
        }
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

    async promptForMicrosoftAuthentication() {
        this.logger.info(`🔐 [${this.serverId}] Starting Microsoft authentication process...`);
        this.logger.info(`📋 [${this.serverId}] You can use any Microsoft account email address.`);

        // Use a placeholder email for the authentication process
        const email = 'user@example.com';

        try {
            const client = await this.authenticateAccount(email);
            return [client];
        } catch (error) {
            this.logger.error(`❌ [${this.serverId}] Microsoft authentication failed: ${error.message}`);
            this.logger.error(`❌ [${this.serverId}] Please ensure you have a valid Microsoft account with Xbox Live access.`);
            this.logger.error(`❌ [${this.serverId}] The account must own Minecraft to create sessions.`);
            throw error;
        }
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