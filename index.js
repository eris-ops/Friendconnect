#!/usr/bin/env node

// GitHub Version - FriendConnect Bot v3.0 (Xbox Live Session Method)
// Based on jrcarl624/FriendConnect approach updated for latest Minecraft versions

const crypto = require('crypto');
const { EventEmitter } = require('events');
const fs = require('fs');
const { ping } = require('bedrock-protocol');
const { Authflow, Titles } = require('prismarine-auth');

console.log('🤖 ================================');
console.log('🤖   FriendConnect Bot v3.0    '); 
console.log('🤖  Xbox Live Session Method  ');
console.log('🤖 ================================');

// Configuration from environment variables (GitHub deployment)
const config = {
    server: process.env.SERVER_IP || 'your-server.com',
    port: parseInt(process.env.SERVER_PORT) || 19132,
    hostName: process.env.HOST_NAME || 'FriendConnect Server',
    worldName: process.env.WORLD_NAME || 'Join via Friends Tab',
    version: process.env.VERSION || '1.21.51',
    protocol: parseInt(process.env.PROTOCOL) || 685,
    maxPlayers: parseInt(process.env.MAX_PLAYERS) || 40,
    accounts: process.env.ACCOUNTS ? process.env.ACCOUNTS.split(',').map(email => email.trim()) : [],
    demoMode: process.env.DEMO_MODE === 'true'
};

// Constants for Xbox Live integration
const Constants = {
    SERVICE_CONFIG_ID: "4fc10100-5f7a-4470-899b-280835760c07",
    CLIENT_ID: "00000000441cc96b",
};

// Enhanced logging
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

// Xbox Live Session Management
class XboxLiveSession extends EventEmitter {
    constructor(options) {
        super();
        this.hostName = options.hostName;
        this.worldName = options.worldName;
        this.version = options.version;
        this.protocol = options.protocol;
        this.ip = options.ip;
        this.port = options.port;
        this.maxPlayers = options.maxPlayers;
        this.accounts = options.accounts;
        this.xboxClients = new Map();
        this.hostAccount = null;
        this.sessionInstance = null;
        this.started = false;
    }

    async initializeAccounts() {
        log('INFO', `📱 Initializing ${this.accounts.length} Xbox Live accounts...`);
        
        for (const email of this.accounts) {
            try {
                const client = await this.createXboxClient(email);
                this.xboxClients.set(email, client);
                
                if (!this.hostAccount) {
                    this.hostAccount = client;
                }
                
                log('SUCCESS', `Account ${email} initialized`);
            } catch (error) {
                log('ERROR', `Failed to initialize ${email}:`, error.message);
            }
        }

        if (this.xboxClients.size === 0) {
            throw new Error('No Xbox Live accounts initialized');
        }

        await this.setupCrossFriendships();
        await this.createMinecraftLobbySession();
    }

    async createXboxClient(email) {
        return new Promise((resolve, reject) => {
            const authflow = new Authflow(email, './auth/', {
                authTitle: Titles.MinecraftNintendoSwitch,
                deviceType: 'Nintendo'
            }, (response) => {
                log('INFO', `🔐 Auth required for ${email}`);
                log('INFO', `📱 Visit: ${response.verificationUri}`);
                log('INFO', `🔑 Code: ${response.userCode}`);
            });

            authflow.getXboxToken().then(token => {
                resolve({
                    email,
                    xuid: token.userXUID,
                    authHeader: `XBL3.0 x=${token.userHash};${token.XSTSToken}`,
                    token
                });
            }).catch(reject);
        });
    }

    async setupCrossFriendships() {
        const clients = Array.from(this.xboxClients.values());
        
        for (let i = 0; i < clients.length; i++) {
            for (let j = 0; j < clients.length; j++) {
                if (i !== j) {
                    try {
                        await this.addFriend(clients[i], clients[j].xuid);
                        await this.delay(1000);
                    } catch (error) {
                        // Friendship might already exist
                    }
                }
            }
        }
    }

    async addFriend(client, targetXuid) {
        const response = await fetch(`https://social.xboxlive.com/users/me/people/xuid(${targetXuid})`, {
            method: 'PUT',
            headers: {
                'Authorization': client.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '1'
            }
        });
        return response;
    }

    async createMinecraftLobbySession() {
        const sessionData = {
            properties: {
                system: {
                    joinRestriction: "followed",
                    readRestriction: "followed", 
                    closed: false
                },
                custom: {
                    BroadcastSetting: 3,
                    CrossPlayDisabled: false,
                    Joinability: "joinable_by_friends",
                    LanGame: true,
                    MaxMemberCount: this.maxPlayers,
                    MemberCount: 0,
                    OnlineCrossPlatformGame: true,
                    SupportedConnections: [{
                        ConnectionType: 6,
                        HostIpAddress: this.ip,
                        HostPort: this.port,
                        RakNetGUID: crypto.randomUUID()
                    }],
                    TitleId: 1739947436,
                    TransportLayer: 0,
                    levelId: "level",
                    hostName: this.hostName,
                    ownerId: this.hostAccount.xuid,
                    rakNetGUID: crypto.randomUUID(),
                    worldName: this.worldName,
                    worldType: "Survival",
                    protocol: this.protocol,
                    version: this.version
                }
            },
            members: {
                me: {
                    constants: {
                        system: {
                            xuid: this.hostAccount.xuid,
                            initialize: true
                        }
                    },
                    properties: {
                        system: {
                            active: true,
                            connection: crypto.randomUUID(),
                            subscription: {
                                id: "845CC784-7348-4A27-BCDE-C083579DD113",
                                changeTypes: ["everything"]
                            }
                        }
                    }
                }
            }
        };

        const sessionName = `FriendConnect-${Date.now()}`;
        const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${sessionName}`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': this.hostAccount.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '107'
            },
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            throw new Error(`Session creation failed: ${response.status}`);
        }

        this.sessionInstance = { sessionName, ...(await response.json()) };
        this.started = true;
        
        log('SUCCESS', '🎉 Xbox Live session created!');
        log('INFO', '📋 Players can find server in Friends tab');
        
        await this.joinOtherAccounts();
    }

    async joinOtherAccounts() {
        const otherClients = Array.from(this.xboxClients.values()).filter(
            client => client !== this.hostAccount
        );

        for (const client of otherClients) {
            try {
                await this.joinSessionWithAccount(client);
                await this.delay(2000);
            } catch (error) {
                log('ERROR', `Failed to join ${client.email}`);
            }
        }
    }

    async joinSessionWithAccount(client) {
        const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}/members/me`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': client.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '107'
            },
            body: JSON.stringify({
                constants: {
                    system: {
                        xuid: client.xuid,
                        initialize: true
                    }
                }
            })
        });

        return response.json();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main Bot Class
class FriendConnectBot {
    constructor() {
        this.session = null;
        this.isActive = false;
    }

    async start() {
        try {
            log('INFO', '🚀 Starting FriendConnect Bot...');
            log('INFO', `📋 Target server: ${config.server}:${config.port}`);

            if (config.demoMode) {
                log('WARNING', 'Demo mode - simulating Xbox Live session');
                this.simulateDemo();
                return;
            }

            if (config.accounts.length === 0) {
                throw new Error('No Xbox Live accounts configured');
            }

            this.session = new XboxLiveSession({
                hostName: config.hostName,
                worldName: config.worldName,
                version: config.version,
                protocol: config.protocol,
                ip: config.server,
                port: config.port,
                maxPlayers: config.maxPlayers,
                accounts: config.accounts
            });

            await this.session.initializeAccounts();
            this.isActive = true;

            log('SUCCESS', '🎉 FriendConnect Bot active!');

        } catch (error) {
            log('ERROR', '💥 Startup error:', error.message);
            process.exit(1);
        }
    }

    simulateDemo() {
        log('INFO', '🎭 Demo mode active');
        log('SUCCESS', '✅ Demo Xbox Live session created');
        log('INFO', '📋 In production, players find server in Friends tab');
        this.isActive = true;
    }
}

// Start the bot
async function main() {
    const bot = new FriendConnectBot();
    await bot.start();
}

main();