const { SessionManager } = require('./session-manager.js');
const { FriendManager } = require('./friend-manager.js');
const { AuthManager } = require('./auth-manager.js');
const { EventEmitter } = require('events');

/**
 * Enhanced FriendConnect Manager with multi-server support
 * Manages Xbox Live sessions, authentication, and friend management for multiple servers
 */
class FriendConnectManager extends EventEmitter {
    constructor(options) {
        super();
        
        this.serverId = options.serverId;
        this.server = options.server;
        this.port = options.port;
        this.hostName = options.hostName || "FriendConnect Server";
        this.worldName = options.worldName || "Join via Friends Tab";
        this.accounts = options.accounts || [];
        this.config = options.globalConfig || {};
        this.logger = options.logger;
        
        this.authManager = null;
        this.sessionManager = null;
        this.friendManager = null;
        this.initialized = false;
        this.recovering = false;
        
        this.stats = {
            sessionsCreated: 0,
            accountsConnected: 0,
            friendshipsEstablished: 0,
            reconnectAttempts: 0,
            lastActivity: Date.now(),
            errors: 0
        };
    }

    async initialize() {
        try {
            this.logger.info(`🚀 [${this.serverId}] Initializing FriendConnect Manager...`);
            
            // Validate configuration
            this.validateConfiguration();
            
            // Initialize authentication manager
            this.authManager = new AuthManager({
                accounts: this.accounts,
                tokenPath: this.config.auth?.tokenPath || './auth/',
                maxRetries: this.config.auth?.maxRetries || 3,
                retryDelay: this.config.auth?.retryDelay || 5000,
                preferredMethod: this.config.auth?.preferredMethod || 'android',
                mobileOptimized: this.config.auth?.mobileOptimized || true,
                serverId: this.serverId,
                logger: this.logger
            });

            // Set up auth event listeners
            this.setupAuthEventListeners();

            // Initialize accounts
            const authenticatedAccounts = await this.authManager.initializeAccounts();
            this.stats.accountsConnected = authenticatedAccounts.length;

            if (authenticatedAccounts.length === 0) {
                throw new Error('No accounts could be authenticated');
            }

            // Initialize friend manager
            this.friendManager = new FriendManager({
                accounts: authenticatedAccounts,
                maxConcurrentRequests: this.config.friends?.maxConcurrentRequests || 5,
                requestDelay: this.config.friends?.requestDelay || 1000,
                autoAcceptFriends: this.config.friends?.autoAcceptFriends || true,
                serverId: this.serverId,
                logger: this.logger
            });

            // Set up friend event listeners
            this.setupFriendEventListeners();

            // Initialize friendships
            await this.friendManager.setupCrossFriendships();

            // Initialize session manager
            this.sessionManager = new SessionManager({
                hostAccount: authenticatedAccounts[0],
                allAccounts: authenticatedAccounts,
                serverConfig: {
                    ip: this.server,
                    port: this.port,
                    hostName: this.hostName,
                    worldName: this.worldName,
                    version: this.config.version || "1.21.51",
                    protocol: this.config.protocol || 685,
                    maxPlayers: this.config.maxPlayers || 40
                },
                sessionConfig: {
                    autoReconnect: this.config.session?.autoReconnect || true,
                    maxReconnectAttempts: this.config.session?.maxReconnectAttempts || 10,
                    reconnectDelay: this.config.session?.reconnectDelay || 5000,
                    heartbeatInterval: this.config.session?.heartbeatInterval || 60000
                },
                serverId: this.serverId,
                logger: this.logger
            });

            // Set up session event listeners
            this.setupSessionEventListeners();

            // Create the Xbox Live session
            await this.sessionManager.createSession();
            this.stats.sessionsCreated++;

            this.initialized = true;
            this.logger.success(`✅ [${this.serverId}] FriendConnect Manager initialized successfully`);
            
            this.emit('initialized', { serverId: this.serverId, stats: this.stats });

        } catch (error) {
            this.stats.errors++;
            this.logger.error(`❌ [${this.serverId}] Failed to initialize:`, error.message);
            this.emit('error', error);
            throw error;
        }
    }

    validateConfiguration() {
        if (!this.server) {
            throw new Error('Server hostname/IP is required');
        }
        
        if (!this.port || this.port < 1 || this.port > 65535) {
            throw new Error('Valid port number is required');
        }
        
        if (!this.accounts || this.accounts.length === 0) {
            this.logger.info(`🔐 [${this.serverId}] No Xbox Live accounts configured - will use Microsoft authentication`);
            this.logger.info(`🔗 [${this.serverId}] The bot will prompt you to authenticate with Microsoft`);
            this.logger.info(`🔗 [${this.serverId}] You can use any Microsoft account that owns Minecraft`);
        }

        this.logger.debug(`🔍 [${this.serverId}] Configuration validated`);
    }

    setupAuthEventListeners() {
        this.authManager.on('accountAuthenticated', (data) => {
            this.logger.info(`🔐 [${this.serverId}] Account authenticated: ${data.email}`);
            this.emit('accountConnected', data);
        });

        this.authManager.on('authenticationFailed', (data) => {
            this.logger.error(`❌ [${this.serverId}] Authentication failed: ${data.email} - ${data.error}`);
            this.stats.errors++;
        });

        this.authManager.on('tokenRefreshed', (data) => {
            this.logger.debug(`🔄 [${this.serverId}] Token refreshed: ${data.email}`);
        });
    }

    setupFriendEventListeners() {
        this.friendManager.on('friendshipEstablished', (data) => {
            this.logger.info(`👥 [${this.serverId}] Friendship: ${data.from} → ${data.to}`);
            this.stats.friendshipsEstablished++;
            this.emit('friendshipEstablished', data);
        });

        this.friendManager.on('friendRequestReceived', (data) => {
            this.logger.info(`📨 [${this.serverId}] Friend request from: ${data.from}`);
        });

        this.friendManager.on('friendRequestAccepted', (data) => {
            this.logger.info(`✅ [${this.serverId}] Friend request accepted: ${data.from}`);
        });

        this.friendManager.on('error', (error) => {
            this.logger.error(`❌ [${this.serverId}] Friend manager error:`, error.message);
            this.stats.errors++;
        });
    }

    setupSessionEventListeners() {
        this.sessionManager.on('sessionCreated', (data) => {
            this.logger.success(`🎮 [${this.serverId}] Session created: ${data.sessionName}`);
            this.stats.lastActivity = Date.now();
            this.emit('sessionCreated', data);
        });

        this.sessionManager.on('sessionJoined', (data) => {
            this.logger.info(`👤 [${this.serverId}] Account joined session: ${data.email}`);
            this.stats.lastActivity = Date.now();
        });

        this.sessionManager.on('sessionHeartbeat', (data) => {
            this.logger.debug(`💓 [${this.serverId}] Session heartbeat: ${data.accountCount} accounts`);
            this.stats.lastActivity = Date.now();
        });

        this.sessionManager.on('sessionRecovered', (data) => {
            this.logger.success(`🔄 [${this.serverId}] Session recovered: ${data.sessionName}`);
            this.stats.lastActivity = Date.now();
            this.emit('sessionRecovered', data);
        });

        this.sessionManager.on('reconnectAttempt', (data) => {
            this.logger.warning(`🔄 [${this.serverId}] Reconnect attempt ${data.attempt}/${data.maxAttempts}`);
            this.stats.reconnectAttempts++;
            this.emit('reconnectAttempt', data);
        });

        this.sessionManager.on('error', (error) => {
            this.logger.error(`❌ [${this.serverId}] Session error:`, error.message);
            this.stats.errors++;
            
            // Attempt recovery if not already recovering
            if (!this.recovering && this.config.session?.autoRecover) {
                this.recover();
            }
        });

        this.sessionManager.on('stopped', () => {
            this.logger.warning(`🛑 [${this.serverId}] Session stopped`);
            this.emit('stopped');
        });
    }

    async recover() {
        if (this.recovering) {
            this.logger.warning(`⚠️ [${this.serverId}] Recovery already in progress`);
            return;
        }

        this.recovering = true;
        this.logger.info(`🏥 [${this.serverId}] Starting recovery process...`);

        try {
            // Stop current session if running
            if (this.sessionManager) {
                await this.sessionManager.stop();
            }

            // Refresh authentication tokens
            if (this.authManager) {
                await this.authManager.refreshTokens();
            }

            // Re-establish friendships
            if (this.friendManager) {
                await this.friendManager.refreshFriendships();
            }

            // Recreate session
            if (this.sessionManager) {
                await this.sessionManager.createSession();
                this.stats.sessionsCreated++;
            }

            this.logger.success(`✅ [${this.serverId}] Recovery completed successfully`);
            this.emit('recovered', { serverId: this.serverId });

        } catch (error) {
            this.logger.error(`❌ [${this.serverId}] Recovery failed:`, error.message);
            this.stats.errors++;
            this.emit('recoveryFailed', { serverId: this.serverId, error });
            throw error;
        } finally {
            this.recovering = false;
        }
    }

    async getHealthStatus() {
        try {
            const now = Date.now();
            const timeSinceLastActivity = now - this.stats.lastActivity;
            const maxInactivity = this.config.monitoring?.maxInactivityTime || 300000; // 5 minutes

            // Check if manager is initialized
            if (!this.initialized) {
                return { healthy: false, reason: 'Not initialized' };
            }

            // Check if too much time has passed since last activity
            if (timeSinceLastActivity > maxInactivity) {
                return { healthy: false, reason: `No activity for ${Math.floor(timeSinceLastActivity / 1000)}s` };
            }

            // Check session health
            if (this.sessionManager) {
                const sessionHealth = await this.sessionManager.getHealthStatus();
                if (!sessionHealth.healthy) {
                    return { healthy: false, reason: `Session unhealthy: ${sessionHealth.reason}` };
                }
            }

            // Check authentication health
            if (this.authManager) {
                const authHealth = await this.authManager.getHealthStatus();
                if (!authHealth.healthy) {
                    return { healthy: false, reason: `Auth unhealthy: ${authHealth.reason}` };
                }
            }

            return { 
                healthy: true, 
                stats: this.stats,
                lastActivity: this.stats.lastActivity
            };

        } catch (error) {
            return { healthy: false, reason: `Health check error: ${error.message}` };
        }
    }

    getStats() {
        return {
            ...this.stats,
            serverId: this.serverId,
            server: this.server,
            port: this.port,
            initialized: this.initialized,
            recovering: this.recovering
        };
    }

    async stop() {
        this.logger.info(`🛑 [${this.serverId}] Stopping FriendConnect Manager...`);

        try {
            // Stop session manager
            if (this.sessionManager) {
                await this.sessionManager.stop();
            }

            // Stop friend manager
            if (this.friendManager) {
                await this.friendManager.stop();
            }

            // Stop auth manager
            if (this.authManager) {
                await this.authManager.stop();
            }

            this.initialized = false;
            this.logger.success(`✅ [${this.serverId}] Manager stopped successfully`);
            this.emit('stopped');

        } catch (error) {
            this.logger.error(`❌ [${this.serverId}] Error during shutdown:`, error.message);
            throw error;
        }
    }
}

module.exports = { FriendConnectManager };
