#!/usr/bin/env node

// Enable debug logging for prismarine-auth to troubleshoot authentication issues
process.env.DEBUG = 'prismarine-auth';

const { FriendConnectManager } = require('./multi-server-manager.js');
const { ConfigValidator } = require('./config-validator.js');
const { Logger } = require('./logger.js');
const { HealthMonitor } = require('./health-monitor.js');
const fs = require('fs');
const path = require('path');

// Initialize logger
const logger = new Logger();

logger.startup('🤖 ================================');
logger.startup('🤖   FriendConnect Bot v3.1    ');
logger.startup('🤖  Enhanced Session Manager   ');
logger.startup('🤖 ================================');

// Enhanced FriendConnect Bot with multi-server support
class EnhancedFriendConnectBot {
    constructor() {
        this.managers = new Map();
        this.healthMonitor = null;
        this.isActive = false;
        this.startTime = Date.now();
        this.stats = {
            totalSessions: 0,
            activeServers: 0,
            totalAccounts: 0,
            uptime: 0,
            reconnectAttempts: 0,
            sessionsRecovered: 0
        };
        this.config = null;
    }

    async start() {
        try {
            // Load and validate configuration
            await this.loadConfiguration();
            
            // Initialize health monitor
            this.healthMonitor = new HealthMonitor(this.config.monitoring || {});
            this.setupHealthMonitoring();

            // Handle demo mode
            if (this.config.demoMode) {
                logger.warning('Demo mode enabled - using simulated Xbox Live sessions');
                await this.runDemoMode();
                return;
            }

            // Initialize servers
            await this.initializeServers();

            this.isActive = true;
            logger.success('🎉 Enhanced FriendConnect Bot is now active!');
            logger.info('📋 All configured servers are running with Xbox Live sessions');
            
            // Start global monitoring
            this.startGlobalMonitoring();

        } catch (error) {
            logger.error('💥 Fatal error during startup:', error.message);
            if (error.stack && this.config?.debugging?.enableStackTrace) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async loadConfiguration() {
        try {
            logger.info('📋 Loading configuration...');
            
            // Check if config.json exists
            if (!fs.existsSync('./config.json')) {
                logger.error('❌ config.json not found!');
                logger.info('📋 Creating config.json from template...');
                
                if (fs.existsSync('./config.json.example')) {
                    fs.copyFileSync('./config.json.example', './config.json');
                    logger.info('✅ config.json created from template');
                    logger.info('📋 Please edit config.json with your settings and restart');
                } else {
                    logger.error('❌ config.json.example not found either!');
                }
                process.exit(1);
            }

            const configData = fs.readFileSync('./config.json', 'utf8');
            const rawConfig = JSON.parse(configData);

            // Validate configuration
            const validator = new ConfigValidator();
            this.config = await validator.validate(rawConfig);
            
            logger.success('✅ Configuration loaded and validated successfully');
            logger.info(`📋 Found ${this.config.servers?.length || 1} server(s) configured`);

        } catch (error) {
            logger.error('❌ Error loading configuration:', error.message);
            throw error;
        }
    }

    async initializeServers() {
        const servers = this.config.servers || [this.config]; // Support legacy single server config
        
        logger.info(`🚀 Initializing ${servers.length} server configuration(s)...`);

        for (let i = 0; i < servers.length; i++) {
            const serverConfig = servers[i];
            const serverId = serverConfig.id || `server-${i + 1}`;
            
            try {
                logger.info(`📡 Setting up server: ${serverId} (${serverConfig.server}:${serverConfig.port})`);
                
                const manager = new FriendConnectManager({
                    ...serverConfig,
                    serverId,
                    globalConfig: this.config,
                    logger
                });

                // Set up event listeners for this server
                this.setupServerEventListeners(manager, serverId);

                // Initialize the manager
                await manager.initialize();

                this.managers.set(serverId, manager);
                this.stats.activeServers++;
                this.stats.totalSessions += manager.getStats().sessionsCreated;
                this.stats.totalAccounts += manager.getStats().accountsConnected;

                logger.success(`✅ Server ${serverId} initialized successfully`);

            } catch (error) {
                logger.error(`❌ Failed to initialize server ${serverId}:`, error.message);
                if (this.config.global?.continueOnServerFailure) {
                    logger.warning(`⚠️ Continuing with other servers due to continueOnServerFailure setting`);
                } else {
                    throw error;
                }
            }
        }

        if (this.managers.size === 0) {
            throw new Error('No servers could be initialized successfully');
        }
    }

    setupServerEventListeners(manager, serverId) {
        manager.on('sessionCreated', (data) => {
            logger.success(`🎮 [${serverId}] Xbox Live session created: ${data.sessionName}`);
            this.stats.totalSessions++;
        });

        manager.on('sessionRecovered', (data) => {
            logger.success(`🔄 [${serverId}] Session recovered: ${data.sessionName}`);
            this.stats.sessionsRecovered++;
        });

        manager.on('accountConnected', (data) => {
            logger.info(`👤 [${serverId}] Account connected: ${data.email}`);
        });

        manager.on('friendshipEstablished', (data) => {
            logger.info(`👥 [${serverId}] Friendship established: ${data.from} → ${data.to}`);
        });

        manager.on('error', (error) => {
            logger.error(`❌ [${serverId}] Error: ${error.message}`);
        });

        manager.on('reconnectAttempt', (data) => {
            logger.warning(`🔄 [${serverId}] Reconnect attempt ${data.attempt}/${data.maxAttempts}`);
            this.stats.reconnectAttempts++;
        });

        manager.on('stopped', () => {
            logger.warning(`🛑 [${serverId}] Manager stopped`);
            this.stats.activeServers--;
        });
    }

    setupHealthMonitoring() {
        this.healthMonitor.on('healthCheck', (results) => {
            const healthyServers = results.filter(r => r.healthy).length;
            const totalServers = results.length;
            
            if (healthyServers < totalServers) {
                logger.warning(`💛 Health check: ${healthyServers}/${totalServers} servers healthy`);
            } else {
                logger.debug(`💚 Health check: All ${totalServers} servers healthy`);
            }
        });

        this.healthMonitor.on('serverDown', (serverId) => {
            logger.error(`🚨 Server ${serverId} detected as unhealthy - attempting recovery`);
            this.recoverServer(serverId);
        });

        this.healthMonitor.on('criticalFailure', (error) => {
            logger.error(`🚨 Critical system failure detected: ${error.message}`);
            if (this.config.monitoring?.restartOnCriticalFailure) {
                logger.warning('🔄 Attempting system restart due to critical failure...');
                this.restart();
            }
        });
    }

    async runDemoMode() {
        logger.info('🎭 Running in demo mode - simulating Xbox Live sessions');
        
        const servers = this.config.servers || [this.config];
        
        for (let i = 0; i < servers.length; i++) {
            const serverConfig = servers[i];
            const serverId = serverConfig.id || `demo-server-${i + 1}`;
            
            await this.delay(1000);
            logger.success(`✅ [${serverId}] Demo Xbox Live session created`);
            logger.success(`✅ [${serverId}] Demo accounts: DemoAccount1, DemoAccount2`);
            logger.success(`✅ [${serverId}] Demo friendships established`);
            
            this.stats.activeServers++;
            this.stats.totalSessions++;
            this.stats.totalAccounts += 2;
        }

        this.isActive = true;
        logger.success('🎉 Demo FriendConnect sessions are active!');
        logger.info('📋 In production, players would see servers in Friends tab');
        
        // Start demo monitoring
        this.startDemoMonitoring();
    }

    startGlobalMonitoring() {
        logger.info('📊 Starting global monitoring system...');
        
        // Global statistics reporting
        setInterval(() => {
            this.updateGlobalStats();
            this.reportGlobalStats();
        }, this.config.monitoring?.statsInterval || 300000); // Default 5 minutes

        // Start health monitoring for all servers
        const serverIds = Array.from(this.managers.keys());
        this.healthMonitor.startMonitoring(serverIds, async (serverId) => {
            const manager = this.managers.get(serverId);
            return manager ? await manager.getHealthStatus() : { healthy: false, reason: 'Manager not found' };
        });
    }

    startDemoMonitoring() {
        logger.info('📊 Starting demo monitoring...');
        
        setInterval(() => {
            this.updateGlobalStats();
            this.reportGlobalStats();
            
            // Simulate some activity
            if (Math.random() > 0.8) {
                const servers = Array.from(this.managers.keys());
                const randomServer = servers[Math.floor(Math.random() * servers.length)] || 'demo-server-1';
                logger.session(`👥 [${randomServer}] Demo: Player would join via Friends tab`);
            }
        }, 30000); // Every 30 seconds
    }

    updateGlobalStats() {
        this.stats.uptime = Date.now() - this.startTime;
        
        // Update stats from all managers
        let totalSessions = 0;
        let totalAccounts = 0;
        
        for (const [serverId, manager] of this.managers) {
            const managerStats = manager.getStats();
            totalSessions += managerStats.sessionsCreated;
            totalAccounts += managerStats.accountsConnected;
        }
        
        this.stats.totalSessions = totalSessions;
        this.stats.totalAccounts = totalAccounts;
    }

    reportGlobalStats() {
        const uptimeHours = Math.floor(this.stats.uptime / 3600000);
        const uptimeMinutes = Math.floor((this.stats.uptime % 3600000) / 60000);
        
        logger.info('📊 ==================== GLOBAL STATISTICS ====================');
        logger.info(`   🎮 Total sessions created: ${this.stats.totalSessions}`);
        logger.info(`   📡 Active servers: ${this.stats.activeServers}`);
        logger.info(`   👥 Total Xbox accounts: ${this.stats.totalAccounts}`);
        logger.info(`   ⏰ Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
        logger.info(`   🔄 Reconnect attempts: ${this.stats.reconnectAttempts}`);
        logger.info(`   🏥 Sessions recovered: ${this.stats.sessionsRecovered}`);
        logger.info(`   🌐 System status: ${this.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        logger.info('📊 ========================================================');
    }

    async recoverServer(serverId) {
        try {
            const manager = this.managers.get(serverId);
            if (!manager) {
                logger.error(`❌ Cannot recover ${serverId}: Manager not found`);
                return;
            }

            logger.info(`🔄 Attempting to recover server: ${serverId}`);
            await manager.recover();
            logger.success(`✅ Server ${serverId} recovered successfully`);

        } catch (error) {
            logger.error(`❌ Failed to recover server ${serverId}:`, error.message);
        }
    }

    async restart() {
        logger.warning('🔄 Performing system restart...');
        
        try {
            await this.stop();
            await this.delay(5000);
            await this.start();
        } catch (error) {
            logger.error(`❌ System restart failed: ${error.message}`);
        }
    }

    async stop() {
        logger.info('🛑 Stopping Enhanced FriendConnect Bot...');
        
        if (this.healthMonitor) {
            this.healthMonitor.stop();
        }

        // Stop all server managers
        const stopPromises = [];
        for (const [serverId, manager] of this.managers) {
            logger.info(`🛑 Stopping server: ${serverId}`);
            stopPromises.push(manager.stop());
        }

        await Promise.all(stopPromises);
        
        this.managers.clear();
        this.isActive = false;
        logger.success('✅ Enhanced FriendConnect Bot stopped');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    if (global.enhancedFriendConnectBot) {
        await global.enhancedFriendConnectBot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    if (global.enhancedFriendConnectBot) {
        await global.enhancedFriendConnectBot.stop();
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception:', error.message);
    if (global.enhancedFriendConnectBot) {
        global.enhancedFriendConnectBot.stop().then(() => process.exit(1));
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the enhanced bot
async function main() {
    try {
        global.enhancedFriendConnectBot = new EnhancedFriendConnectBot();
        await global.enhancedFriendConnectBot.start();
    } catch (error) {
        logger.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the bot
main();
