import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import fetch from 'node-fetch';
import prismarineAuth from 'prismarine-auth';
const { Authflow, Titles } = prismarineAuth;

// Constants for Xbox Live integration
const Constants = {
    SERVICE_CONFIG_ID: "4fc10100-5f7a-4470-899b-280835760c07", // Minecraft service config ID
    CLIENT_ID: "00000000441cc96b", // Nintendo Switch Title ID (most compatible)
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const debug = (...args) => {
    if (process.env.FRIEND_CONNECT_DEBUG) {
        console.log('[DEBUG]', ...args);
    }
};

// Xbox Live Session Management Class
class XboxLiveSession extends EventEmitter {
    constructor(options) {
        super();
        this.hostName = options.hostName || "FriendConnect Server";
        this.worldName = options.worldName || "Join via Friends Tab";
        this.version = options.version || "1.21.51";
        this.protocol = options.protocol || 685;
        this.ip = options.ip;
        this.port = options.port;
        this.maxPlayers = options.maxPlayers || 40;
        this.connectedPlayers = options.connectedPlayers || 0;
        this.tokenPath = options.tokenPath || "./auth/";
        this.accounts = options.accounts || [];
        this.xboxClients = new Map();
        this.hostAccount = null;
        this.sessionInstance = null;
        this.friendXuids = new Set();
        this.accountXuids = new Set();
        this.started = false;
        
        this.log('🚀 Initializing FriendConnect Xbox Live Session...');
        this.initializeAccounts();
    }

    log(...message) {
        console.log(`[FriendConnect]`, ...message);
    }

    async initializeAccounts() {
        this.log(`📱 Initializing ${this.accounts.length} Xbox Live accounts...`);
        
        for (const email of this.accounts) {
            try {
                const client = await this.createXboxClient(email);
                this.xboxClients.set(email, client);
                
                if (!this.hostAccount) {
                    this.hostAccount = client;
                    this.log(`👑 Host account set: ${email}`);
                }
                
                this.accountXuids.add(client.xuid);
                this.log(`✅ Account ${email} initialized (XUID: ${client.xuid})`);
            } catch (error) {
                this.log(`❌ Failed to initialize account ${email}:`, error.message);
            }
        }

        if (this.xboxClients.size === 0) {
            throw new Error('No Xbox Live accounts could be initialized');
        }

        this.log(`🔗 Setting up cross-friendships between accounts...`);
        await this.setupCrossFriendships();
        
        this.log(`🎮 Creating Xbox Live Multiplayer Session...`);
        await this.createMinecraftLobbySession();
    }

    async createXboxClient(email) {
        this.log(`🔍 Attempting authentication for ${email}...`);
        
        try {
            // Try Minecraft Java authentication first
            return await this.tryAuthentication(email, Titles.MinecraftJava, 'Java');
        } catch (javaError) {
            this.log(`❌ Java authentication failed: ${javaError.message}`);
            
            try {
                // Fallback to Android authentication
                return await this.tryAuthentication(email, Titles.MinecraftAndroid, 'Android');
            } catch (androidError) {
                this.log(`❌ Android authentication also failed: ${androidError.message}`);
                
                // Provide comprehensive error guidance
                this.log(`❌ ===============================`);
                this.log(`❌ AUTHENTICATION FAILED`);
                this.log(`❌ ===============================`);
                this.log(`❌ Account: ${email}`);
                this.log(`❌ Common causes:`);
                this.log(`❌   1. Account doesn't own Minecraft`);
                this.log(`❌   2. Account has no Xbox Live access`);
                this.log(`❌   3. Account hasn't played Minecraft before`);
                this.log(`❌   4. Network/authentication server issues`);
                this.log(`❌ ===============================`);
                this.log(`❌ Solutions:`);
                this.log(`❌   1. Use demo mode: Set demoMode: true in config.json`);
                this.log(`❌   2. Use different account that owns Minecraft`);
                this.log(`❌   3. Purchase Minecraft for this account`);
                this.log(`❌   4. Check Xbox Live account status`);
                this.log(`❌ ===============================`);
                
                throw new Error(`Authentication failed for ${email}. Account may not own Minecraft or have Xbox Live access.`);
            }
        }
    }

    async tryAuthentication(email, authTitle, authType) {
        return new Promise((resolve, reject) => {
            this.log(`🔐 Trying ${authType} authentication for ${email}...`);
            
            const authflow = new Authflow(email, this.tokenPath, {
                authTitle,
                flow: 'msal'
            }, (response) => {
                if (response && response.userCode) {
                    this.log(`🔐 Microsoft authentication required for ${email}`);
                    this.log(`📱 Visit: https://microsoft.com/link`);
                    this.log(`🔑 Enter device code: ${response.userCode}`);
                    this.log(`⏰ You have ${Math.floor(response.expiresIn / 60)} minutes to complete authentication`);
                    this.log(`📋 Instructions:`);
                    this.log(`   1. Go to https://microsoft.com/link in your browser`);
                    this.log(`   2. Enter code: ${response.userCode}`);
                    this.log(`   3. Sign in with: ${email}`);
                    this.log(`   4. Wait for authentication to complete...`);
                } else {
                    this.log(`⚠️ Device code callback received but no user code provided`);
                    this.log(`📱 Response:`, response);
                }
            });

            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout - 15 minutes exceeded'));
            }, 15 * 60 * 1000); // 15 minute timeout

            authflow.getXboxToken().then(token => {
                clearTimeout(timeout);
                const client = {
                    email,
                    xuid: token.userXUID,
                    userHash: token.userHash,
                    xstsToken: token.XSTSToken,
                    authHeader: `XBL3.0 x=${token.userHash};${token.XSTSToken}`,
                    token,
                    authType
                };
                
                this.log(`✅ ${authType} authentication successful for ${email}`);
                this.log(`🆔 Xbox User ID: ${token.userXUID}`);
                resolve(client);
            }).catch(error => {
                clearTimeout(timeout);
                this.log(`❌ ${authType} authentication failed for ${email}: ${error.message}`);
                reject(error);
            });
        });
    }

    async setupCrossFriendships() {
        const clients = Array.from(this.xboxClients.values());
        
        for (let i = 0; i < clients.length; i++) {
            for (let j = 0; j < clients.length; j++) {
                if (i !== j) {
                    try {
                        await this.addFriend(clients[i], clients[j].xuid);
                        this.friendXuids.add(clients[j].xuid);
                        this.log(`👥 ${clients[i].email} → ${clients[j].email} friendship established`);
                        await delay(1000); // Rate limiting
                    } catch (error) {
                        debug('Friendship setup error:', error.message);
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

        if (!response.ok) {
            throw new Error(`Failed to add friend: ${response.status}`);
        }

        return response;
    }

    async createMinecraftLobbySession() {
        if (!this.hostAccount) {
            throw new Error('No host account available for session creation');
        }

        const sessionData = {
            properties: {
                system: {
                    joinRestriction: "followed",
                    readRestriction: "followed", 
                    closed: false
                },
                custom: this.createMinecraftLobbyProperties()
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

        try {
            const sessionResponse = await this.createXboxLiveSession(sessionData);
            this.log(`🎉 Xbox Live session created successfully!`);
            this.log(`📋 Session Name: ${sessionResponse.sessionName}`);
            this.log(`🔗 Players can now find server in Friends tab`);
            
            this.started = true;
            this.emit('sessionCreated', sessionResponse);
            
            // Join other accounts to the session
            await this.joinOtherAccounts();
            
            // Start session monitoring
            this.startSessionMonitoring();
            
        } catch (error) {
            this.log(`❌ Failed to create Xbox Live session:`, error.message);
            throw error;
        }
    }

    createMinecraftLobbyProperties() {
        return {
            BroadcastSetting: 3,
            CrossPlayDisabled: false,
            Joinability: "joinable_by_friends",
            LanGame: true,
            MaxMemberCount: this.maxPlayers,
            MemberCount: this.connectedPlayers,
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
        };
    }

    async createXboxLiveSession(sessionData) {
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
            const errorText = await response.text();
            throw new Error(`Session creation failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        this.sessionInstance = {
            sessionName,
            ...result
        };
        
        return this.sessionInstance;
    }

    async joinOtherAccounts() {
        const otherClients = Array.from(this.xboxClients.values()).filter(
            client => client !== this.hostAccount
        );

        for (const client of otherClients) {
            try {
                await this.joinSessionWithAccount(client);
                this.log(`➕ ${client.email} joined the session`);
                await delay(2000); // Rate limiting
            } catch (error) {
                this.log(`❌ Failed to join ${client.email}:`, error.message);
            }
        }
    }

    async joinSessionWithAccount(client) {
        if (!this.sessionInstance) {
            throw new Error('No session instance available');
        }

        const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}/members/me`;
        
        const memberData = {
            constants: {
                system: {
                    xuid: client.xuid,
                    initialize: true
                }
            },
            properties: {
                system: {
                    active: true,
                    connection: crypto.randomUUID()
                }
            }
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': client.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '107'
            },
            body: JSON.stringify(memberData)
        });

        if (!response.ok) {
            throw new Error(`Join session failed: ${response.status}`);
        }

        return response.json();
    }

    startSessionMonitoring() {
        this.log(`📊 Starting session monitoring...`);
        
        // Update server info periodically
        if (this.ip && this.port) {
            setInterval(async () => {
                try {
                    await this.updateServerInfo();
                } catch (error) {
                    debug('Server info update failed:', error.message);
                }
            }, 30000); // Every 30 seconds
        }

        // Session heartbeat
        setInterval(() => {
            this.log(`💓 Session heartbeat - Active accounts: ${this.xboxClients.size}`);
            this.emit('heartbeat', {
                accountCount: this.xboxClients.size,
                sessionActive: this.started,
                hostAccount: this.hostAccount?.email
            });
        }, 300000); // Every 5 minutes
    }

    async updateServerInfo() {
        try {
            // Note: bedrock-protocol ping functionality temporarily disabled
            // Will simulate server info until dependency is resolved
            debug('Server info update: Using default values (ping functionality disabled)');
            
            // For now, keep default values
            await this.updateSessionProperties();
        } catch (error) {
            debug('Server ping failed:', error.message);
        }
    }

    async updateSessionProperties() {
        if (!this.sessionInstance || !this.hostAccount) return;

        const updatedProperties = this.createMinecraftLobbyProperties();
        
        try {
            const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}`;
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': this.hostAccount.authHeader,
                    'Content-Type': 'application/json',
                    'x-xbl-contract-version': '107'
                },
                body: JSON.stringify({
                    properties: {
                        custom: updatedProperties
                    }
                })
            });

            if (response.ok) {
                debug('Session properties updated successfully');
            }
        } catch (error) {
            debug('Failed to update session properties:', error.message);
        }
    }

    async stop() {
        this.log(`🛑 Stopping FriendConnect session...`);
        
        if (this.sessionInstance && this.hostAccount) {
            try {
                const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}`;
                
                await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': this.hostAccount.authHeader,
                        'x-xbl-contract-version': '107'
                    }
                });
                
                this.log(`✅ Xbox Live session terminated`);
            } catch (error) {
                this.log(`❌ Failed to terminate session:`, error.message);
            }
        }

        this.started = false;
        this.emit('stopped');
    }
}

export { XboxLiveSession };