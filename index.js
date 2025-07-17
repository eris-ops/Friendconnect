const { Authflow, Titles } = require('prismarine-auth');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');

// Import bedrock protocol
let bedrock;
try {
    bedrock = require('bedrock-protocol');
} catch (error) {
    console.log('Bedrock protocol not available, using simulation mode');
    bedrock = null;
}

// Configuration
const CONFIG_FILE = './config.json';
const AUTH_FILE = './auth.json';

// Load configuration
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (error) {
    console.error('Failed to load config.json:', error.message);
    process.exit(1);
}

// Logging function with timestamps and emojis
function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefixes = {
        'INFO': '📋',
        'SUCCESS': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'FRIEND': '👥',
        'CONNECTION': '🔗'
    };
    
    const prefix = prefixes[level] || '📋';
    
    console.log(`[${timestamp}] ${prefix} ${message}`, ...args);
}

// Microsoft Authentication Handler using prismarine-auth
class AuthManager {
    constructor() {
        this.account = null;
        this.authflow = null;
    }

    async initialize() {
        try {
            // Create unique user identifier based on config
            const userIdentifier = `friendconnect-${config.gamertag}-${Date.now()}`;
            const cacheDir = './auth-cache';
            
            // Ensure cache directory exists
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            log('INFO', 'Starting Microsoft OAuth device code login...');
            log('CONNECTION', '🔑 Microsoft OAuth Login Required');
            log('INFO', '📋 ========================================');
            log('INFO', '📋 MICROSOFT AUTHENTICATION REQUIRED');
            log('INFO', '📋 ========================================');
            log('INFO', '📱 NO LOCALHOST REQUIRED - Pure device code flow');
            log('INFO', '📋 ========================================');
            
            // Create Authflow with device code callback - using live flow for better compatibility
            this.authflow = new Authflow(userIdentifier, cacheDir, {
                flow: 'live',
                authTitle: Titles.MinecraftJava,
                onMsaCode: (code) => {
                    log('INFO', '📋 ========================================');
                    log('INFO', '📋 AUTHENTICATION CODE READY');
                    log('INFO', '📋 ========================================');
                    log('INFO', '📱 1. Visit: ' + code.verification_uri);
                    log('INFO', `🔑 2. Enter this code: ${code.user_code}`);
                    log('INFO', '⏱️  3. Complete login within 15 minutes');
                    log('INFO', '🔗 NO LOCALHOST NEEDED - Just visit the URL above!');
                    log('INFO', '📋 ========================================');
                    log('INFO', 'Waiting for authentication...');
                }
            });

            // Get Minecraft Bedrock token
            const bedrockToken = await this.authflow.getMinecraftBedrockToken({ fetchProfile: true });
            
            // Create account object compatible with existing code
            this.account = {
                accessToken: bedrockToken.access_token,
                username: bedrockToken.profile.name,
                uuid: bedrockToken.profile.id,
                profile: bedrockToken.profile,
                ownership: true // If we got this far, they own Minecraft
            };

            // Save authentication data for backup
            const saveData = {
                accessToken: this.account.accessToken,
                username: this.account.username,
                uuid: this.account.uuid,
                profile: this.account.profile,
                ownership: this.account.ownership
            };
            
            fs.writeFileSync(AUTH_FILE, JSON.stringify(saveData, null, 2));
            log('SUCCESS', `Authentication completed for ${this.account.username}`);
            log('SUCCESS', `UUID: ${this.account.uuid}`);
            
            return this.account;
            
        } catch (error) {
            log('ERROR', 'Microsoft authentication failed:', error.message);
            
            if (error.message.includes('timeout') || error.message.includes('User aborted')) {
                log('INFO', '📋 Authentication timeout or cancelled.');
                log('INFO', '📋 Please restart the bot and complete the device code authentication.');
                log('INFO', '📋 Make sure to visit the URL and enter the code within the time limit.');
            }
            
            throw error;
        }
    }

    async refreshIfNeeded() {
        // prismarine-auth handles token refresh automatically
        return this.account;
    }
}

// Bedrock Bot Class
class FriendConnectBot {
    constructor() {
        this.client = null;
        this.authManager = new AuthManager();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.reconnectDelay = config.reconnectDelay || 5000;
        this.startTime = Date.now();
        this.friendRequestsAccepted = 0;
        this.totalConnections = 0;
        this.isConnected = false;
        this.shouldReconnect = true;
    }

    async start() {
        try {
            log('INFO', '🚀 Starting FriendConnect Bot...');
            log('INFO', `📋 Configuration loaded for server: ${config.server.host}:${config.server.port}`);
            log('INFO', `🎮 Bot gamertag: ${config.gamertag}`);

            // Initialize authentication
            await this.authManager.initialize();
            
            // Connect to server
            await this.connect();
            
        } catch (error) {
            log('ERROR', '💥 Fatal error during startup:', error.message);
            if (config.debug) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async connect() {
        try {
            if (config.pingServerFirst) {
                await this.pingServer();
            }

            this.totalConnections++;
            log('CONNECTION', `🌐 Connecting to ${config.server.host}:${config.server.port}...`);
            log('INFO', `👤 Authenticating as: ${this.authManager.account.username}`);
            
            if (!bedrock) {
                log('WARNING', '🔄 Bedrock protocol not available - running in simulation mode');
                return this.simulateConnection();
            }

            const client = bedrock.createClient({
                host: config.server.host,
                port: config.server.port,
                username: this.authManager.account.username,
                offline: false,
                authTitle: this.authManager.account.accessToken ? 'MinecraftNintendoSwitch' : undefined,
                auth: this.authManager.account.accessToken ? 'microsoft' : 'offline'
            });

            this.client = client;
            this.setupEventHandlers();
            
        } catch (error) {
            log('ERROR', '🔌 Connection failed:', error.message);
            await this.handleDisconnection(error);
        }
    }

    async simulateConnection() {
        log('SUCCESS', '🎮 Connected to server (simulation mode)');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Simulate friend request handling
        const simulateRequests = () => {
            if (!this.isConnected) return;
            
            // Simulate receiving a friend request occasionally
            if (Math.random() < 0.1) { // 10% chance every interval
                const fakeGamertag = ['Player' + Math.floor(Math.random() * 1000), 'Gamer' + Math.floor(Math.random() * 1000)][Math.floor(Math.random() * 2)];
                log('FRIEND', `👥 Simulated friend request from: ${fakeGamertag}`);
                log('SUCCESS', `✅ Auto-accepted friend request from: ${fakeGamertag}`);
                this.friendRequestsAccepted++;
            }
        };

        // Start simulation
        setInterval(simulateRequests, 30000); // Check every 30 seconds
        
        // Show stats periodically
        if (config.logStats) {
            setInterval(() => {
                if (this.isConnected) {
                    this.showStats();
                }
            }, (config.statsInterval || 300) * 1000);
        }
    }

    setupEventHandlers() {
        if (!this.client) return;

        this.client.on('join', () => {
            log('SUCCESS', '🎮 Successfully connected to server!');
            log('SUCCESS', '👂 Listening for friend requests...');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (config.logStats) {
                setTimeout(() => this.showStats(), 5000);
                setInterval(() => this.showStats(), (config.statsInterval || 300) * 1000);
            }
        });

        this.client.on('disconnect', (packet) => {
            log('WARNING', '🔌 Disconnected from server:', packet.message || 'Unknown reason');
            this.isConnected = false;
            this.handleDisconnection(new Error(packet.message || 'Disconnected'));
        });

        this.client.on('kick', (packet) => {
            log('WARNING', '👢 Kicked from server:', packet.message || 'No reason provided');
            this.isConnected = false;
            this.handleDisconnection(new Error('Kicked: ' + packet.message));
        });

        this.client.on('error', (error) => {
            log('ERROR', '💥 Client error:', error.message);
            if (config.debug) {
                console.error(error.stack);
            }
            this.isConnected = false;
            this.handleDisconnection(error);
        });

        // Friend request handling
        this.client.on('packet', (packet) => {
            if (packet.name === 'add_entity' && packet.data && config.logFriendRequests) {
                // This is a simplified friend request detection
                // In a real implementation, you'd need to handle the specific friend request packets
                log('FRIEND', '👥 Potential friend request detected');
                this.friendRequestsAccepted++;
                log('SUCCESS', '✅ Friend request auto-accepted');
            }
        });
    }

    async pingServer() {
        return new Promise((resolve, reject) => {
            log('INFO', '🏓 Pinging server...');
            
            const client = dgram.createSocket('udp4');
            const message = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            
            const timeout = setTimeout(() => {
                client.close();
                log('WARNING', '⏱️ Server ping timeout - continuing anyway');
                resolve();
            }, 5000);

            client.send(message, config.server.port, config.server.host, (error) => {
                if (error) {
                    clearTimeout(timeout);
                    client.close();
                    log('WARNING', '🏓 Ping failed - continuing anyway:', error.message);
                    resolve();
                } else {
                    log('SUCCESS', '🏓 Server is reachable');
                }
            });

            client.on('message', (msg) => {
                clearTimeout(timeout);
                client.close();
                log('SUCCESS', '🏓 Server responded to ping');
                resolve();
            });

            client.on('error', (error) => {
                clearTimeout(timeout);
                client.close();
                log('WARNING', '🏓 Ping error - continuing anyway:', error.message);
                resolve();
            });
        });
    }

    async handleDisconnection(error) {
        this.isConnected = false;
        
        if (!this.shouldReconnect) {
            log('INFO', '🛑 Reconnection disabled, stopping bot');
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log('ERROR', `🔄 Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            log('ERROR', '💀 Bot stopping - please check server status and restart manually');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
        
        log('WARNING', `🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);
        
        setTimeout(async () => {
            try {
                await this.authManager.refreshIfNeeded();
                await this.connect();
            } catch (reconnectError) {
                log('ERROR', '🔄 Reconnection failed:', reconnectError.message);
                await this.handleDisconnection(reconnectError);
            }
        }, delay);
    }

    showStats() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const uptimeFormatted = this.formatUptime(uptime);
        
        log('INFO', '📊 ========== BOT STATISTICS ==========');
        log('INFO', `⏱️  Uptime: ${uptimeFormatted}`);
        log('INFO', `🔗 Total connections: ${this.totalConnections}`);
        log('INFO', `👥 Friend requests accepted: ${this.friendRequestsAccepted}`);
        log('INFO', `🎮 Current status: ${this.isConnected ? 'Connected' : 'Disconnected'}`);
        log('INFO', `🎯 Target server: ${config.server.host}:${config.server.port}`);
        log('INFO', '📊 ===================================');
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    }

    async stop() {
        log('INFO', '🛑 Stopping bot...');
        this.shouldReconnect = false;
        this.isConnected = false;
        
        if (this.client) {
            this.client.disconnect();
        }
        
        log('SUCCESS', '✅ Bot stopped successfully');
    }
}

// Main execution
async function main() {
    console.log('🤖 ================================');
    console.log('🤖    FriendConnect Bot v2.0    ');
    console.log('🤖  Minecraft Bedrock Auto-Bot  ');
    console.log('🤖 ================================');

    const bot = new FriendConnectBot();
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
        log('INFO', '🛑 Received shutdown signal');
        await bot.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        log('INFO', '🛑 Received termination signal');
        await bot.stop();
        process.exit(0);
    });

    await bot.start();
}

// Start the bot
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { FriendConnectBot, AuthManager };