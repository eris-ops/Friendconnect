#!/usr/bin/env node

import { XboxLiveSession } from './friendconnect-session.js';
import fs from 'fs';

console.log('🤖 ================================');
console.log('🤖   FriendConnect Bot v3.0    '); 
console.log('🤖  Xbox Live Session Method  ');
console.log('🤖 ================================');

// Configuration management
let config;
try {
    const configData = fs.readFileSync('./config.json', 'utf8');
    config = JSON.parse(configData);
} catch (error) {
    console.error('❌ Error loading config.json:', error.message);
    console.log('📋 Please ensure config.json exists and is properly formatted');
    process.exit(1);
}

// Enhanced logging with timestamps
function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = {
        'INFO': '📋',
        'SUCCESS': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'SESSION': '🎮',
        'XBOX': '🎯'
    }[level] || '📋';
    
    console.log(`[${timestamp}] ${prefix} ${message}`, ...args);
}

// Xbox Live FriendConnect Session Bot
class FriendConnectBot {
    constructor() {
        this.session = null;
        this.isActive = false;
        this.startTime = Date.now();
        this.stats = {
            sessionsCreated: 0,
            accountsConnected: 0,
            uptime: 0
        };
    }

    async start() {
        try {
            log('INFO', '🚀 Starting FriendConnect Bot...');
            log('INFO', `📋 Target server: ${config.server}:${config.port}`);
            log('INFO', `🎮 Session name: ${config.hostName || 'FriendConnect Server'}`);

            // Handle demo mode
            if (config.demoMode) {
                log('WARNING', 'Demo mode enabled - using simulated Xbox Live session');
                await this.runDemoMode();
                return;
            }

            // Validate required accounts
            if (!config.accounts || config.accounts.length === 0) {
                throw new Error('No Xbox Live accounts configured. Please add accounts to config.json');
            }

            // Create Xbox Live session
            const sessionOptions = {
                hostName: config.hostName || 'FriendConnect Server',
                worldName: config.worldName || 'Join via Friends Tab',
                version: config.version || '1.21.51',
                protocol: config.protocol || 685,
                ip: config.server,
                port: config.port,
                maxPlayers: config.maxPlayers || 40,
                connectedPlayers: 0,
                tokenPath: './auth/',
                accounts: config.accounts
            };

            this.session = new XboxLiveSession(sessionOptions);

            // Set up event listeners
            this.setupEventListeners();

            // Start the session
            await this.session.initializeAccounts();

            this.isActive = true;
            this.stats.sessionsCreated++;

            log('SUCCESS', '🎉 FriendConnect Bot is now active!');
            log('INFO', '📋 Players can find the server in their Friends tab');
            log('INFO', '📋 Server will appear as a joinable game session');

            // Start monitoring
            this.startMonitoring();

        } catch (error) {
            log('ERROR', '💥 Fatal error during startup:', error.message);
            if (error.stack) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async runDemoMode() {
        log('INFO', '🎭 Running in demo mode - simulating Xbox Live session');
        
        // Simulate session creation
        await this.delay(2000);
        log('SUCCESS', '✅ Demo Xbox Live session created');
        log('SUCCESS', '✅ Demo accounts: DemoAccount1, DemoAccount2');
        log('SUCCESS', '✅ Demo friendships established');
        
        this.isActive = true;
        this.stats.sessionsCreated++;
        this.stats.accountsConnected = 2;

        log('SUCCESS', '🎉 Demo FriendConnect session is active!');
        log('INFO', '📋 In production, players would see server in Friends tab');
        
        // Start demo monitoring
        this.startDemoMonitoring();
    }

    setupEventListeners() {
        this.session.on('sessionCreated', (sessionData) => {
            log('SUCCESS', `🎮 Xbox Live session created: ${sessionData.sessionName}`);
            this.stats.accountsConnected = this.session.xboxClients.size;
        });

        this.session.on('heartbeat', (data) => {
            log('INFO', `💓 Session heartbeat - ${data.accountCount} accounts active`);
        });

        this.session.on('error', (error) => {
            log('ERROR', `❌ Session error: ${error.message}`);
        });

        this.session.on('stopped', () => {
            log('INFO', '🛑 Xbox Live session stopped');
            this.isActive = false;
        });
    }

    startMonitoring() {
        log('INFO', '📊 Starting session monitoring...');
        
        // Statistics reporting
        setInterval(() => {
            this.updateStats();
            this.reportStats();
        }, 300000); // Every 5 minutes

        // Session health check
        setInterval(() => {
            if (this.session && this.session.started) {
                log('INFO', '💚 Session health check: ACTIVE');
            } else {
                log('WARNING', '💛 Session health check: INACTIVE - attempting restart...');
                this.restartSession();
            }
        }, 60000); // Every minute
    }

    startDemoMonitoring() {
        log('INFO', '📊 Starting demo monitoring...');
        
        // Demo statistics
        setInterval(() => {
            this.updateStats();
            this.reportStats();
            
            // Simulate some activity
            if (Math.random() > 0.7) {
                log('SESSION', '👥 Demo: Player would join via Friends tab');
            }
        }, 30000); // Every 30 seconds
    }

    updateStats() {
        this.stats.uptime = Date.now() - this.startTime;
    }

    reportStats() {
        const uptimeMinutes = Math.floor(this.stats.uptime / 60000);
        
        log('INFO', '📊 FriendConnect Statistics:');
        log('INFO', `   🎮 Sessions created: ${this.stats.sessionsCreated}`);
        log('INFO', `   👥 Xbox accounts: ${this.stats.accountsConnected}`);
        log('INFO', `   ⏰ Uptime: ${uptimeMinutes} minutes`);
        log('INFO', `   🌐 Status: ${this.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        log('INFO', `   📡 Server: ${config.server}:${config.port}`);
    }

    async restartSession() {
        try {
            if (this.session) {
                await this.session.stop();
            }
            
            log('INFO', '🔄 Restarting Xbox Live session...');
            await this.delay(5000);
            await this.start();
            
        } catch (error) {
            log('ERROR', `❌ Session restart failed: ${error.message}`);
        }
    }

    async stop() {
        log('INFO', '🛑 Stopping FriendConnect Bot...');
        
        if (this.session) {
            await this.session.stop();
        }
        
        this.isActive = false;
        log('SUCCESS', '✅ FriendConnect Bot stopped');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    if (global.friendConnectBot) {
        await global.friendConnectBot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    if (global.friendConnectBot) {
        await global.friendConnectBot.stop();
    }
    process.exit(0);
});

// Start the bot
async function main() {
    try {
        global.friendConnectBot = new FriendConnectBot();
        await global.friendConnectBot.start();
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the bot
main();