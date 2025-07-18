const crypto = require('crypto');
const fetch = require('node-fetch');
const { EventEmitter } = require('events');

// Constants for Xbox Live integration
const Constants = {
    SERVICE_CONFIG_ID: "4fc10100-5f7a-4470-899b-280835760c07", // Minecraft service config ID
    CLIENT_ID: "00000000441cc96b", // Nintendo Switch Title ID (most compatible)
};

/**
 * Enhanced Session Manager with automatic recovery and monitoring
 */
class SessionManager extends EventEmitter {
    constructor(options) {
        super();
        
        this.hostAccount = options.hostAccount;
        this.allAccounts = options.allAccounts || [this.hostAccount];
        this.serverConfig = options.serverConfig;
        this.sessionConfig = options.sessionConfig;
        this.serverId = options.serverId;
        this.logger = options.logger;
        
        this.sessionInstance = null;
        this.heartbeatInterval = null;
        this.reconnectAttempts = 0;
        this.isRunning = false;
        this.lastHeartbeat = null;
        
        this.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    }

    async createSession() {
        try {
            this.logger.info(`🎮 [${this.serverId}] Creating Xbox Live session...`);
            
            // Stop any existing session
            if (this.isRunning) {
                await this.stop();
            }

            const sessionData = this.buildSessionData();
            const sessionResponse = await this.createXboxLiveSession(sessionData);
            
            this.logger.success(`🎉 [${this.serverId}] Session created: ${sessionResponse.sessionName}`);
            this.emit('sessionCreated', sessionResponse);
            
            // Join other accounts to the session
            await this.joinOtherAccounts();
            
            // Start monitoring
            this.startHeartbeat();
            this.isRunning = true;
            this.reconnectAttempts = 0;
            
            return sessionResponse;

        } catch (error) {
            this.logger.error(`❌ [${this.serverId}] Session creation failed:`, error.message);
            
            if (this.sessionConfig.autoReconnect && this.reconnectAttempts < this.sessionConfig.maxReconnectAttempts) {
                await this.attemptReconnect();
            } else {
                this.emit('error', error);
                throw error;
            }
        }
    }

    buildSessionData() {
        return {
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
                                id: crypto.randomUUID(),
                                changeTypes: ["everything"]
                            }
                        }
                    }
                }
            }
        };
    }

    createMinecraftLobbyProperties() {
        return {
            BroadcastSetting: 3,
            CrossPlayDisabled: false,
            Joinability: "joinable_by_friends",
            LanGame: true,
            MaxMemberCount: this.serverConfig.maxPlayers,
            MemberCount: 0, // Will be updated dynamically
            OnlineCrossPlatformGame: true,
            SupportedConnections: [{
                ConnectionType: 6,
                HostIpAddress: this.serverConfig.ip,
                HostPort: this.serverConfig.port,
                RakNetGUID: crypto.randomUUID()
            }],
            TitleId: 1739947436,
            TransportLayer: 0,
            levelId: "level",
            hostName: this.serverConfig.hostName,
            ownerId: this.hostAccount.xuid,
            rakNetGUID: crypto.randomUUID(),
            worldName: this.serverConfig.worldName,
            worldType: "Survival",
            protocol: this.serverConfig.protocol,
            version: this.serverConfig.version
        };
    }

    async createXboxLiveSession(sessionData) {
        const sessionName = `FriendConnect-${this.serverId}-${Date.now()}`;
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
        const otherAccounts = this.allAccounts.filter(account => account !== this.hostAccount);
        
        this.logger.info(`👥 [${this.serverId}] Adding ${otherAccounts.length} additional accounts to session...`);
        
        for (const account of otherAccounts) {
            try {
                await this.joinSessionWithAccount(account);
                this.emit('sessionJoined', { email: account.email, xuid: account.xuid });
                
                // Rate limiting
                await this.delay(1000);
                
            } catch (error) {
                this.logger.warning(`⚠️ [${this.serverId}] Failed to join account ${account.email}:`, error.message);
            }
        }
    }

    async joinSessionWithAccount(account) {
        if (!this.sessionInstance) {
            throw new Error('No active session to join');
        }

        const joinData = {
            members: {
                me: {
                    constants: {
                        system: {
                            xuid: account.xuid,
                            initialize: true
                        }
                    },
                    properties: {
                        system: {
                            active: true,
                            connection: crypto.randomUUID(),
                            subscription: {
                                id: crypto.randomUUID(),
                                changeTypes: ["everything"]
                            }
                        }
                    }
                }
            }
        };

        const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}`;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': account.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '107'
            },
            body: JSON.stringify(joinData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Account join failed: ${response.status} - ${errorText}`);
        }

        this.logger.debug(`✅ [${this.serverId}] Account ${account.email} joined session`);
    }

    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        const interval = this.sessionConfig.heartbeatInterval || 60000; // Default 1 minute
        
        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.performHeartbeat();
            } catch (error) {
                this.logger.error(`❌ [${this.serverId}] Heartbeat failed:`, error.message);
                this.emit('error', error);
            }
        }, interval);

        this.logger.debug(`💓 [${this.serverId}] Heartbeat started (${interval}ms interval)`);
    }

    async performHeartbeat() {
        if (!this.sessionInstance || !this.isRunning) {
            return;
        }

        try {
            // Update session properties
            const updateData = {
                properties: {
                    custom: {
                        ...this.createMinecraftLobbyProperties(),
                        MemberCount: this.allAccounts.length,
                        lastUpdate: Date.now()
                    }
                }
            };

            const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}`;
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': this.hostAccount.authHeader,
                    'Content-Type': 'application/json',
                    'x-xbl-contract-version': '107'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`Heartbeat failed: ${response.status}`);
            }

            this.lastHeartbeat = Date.now();
            this.emit('sessionHeartbeat', { 
                accountCount: this.allAccounts.length,
                sessionName: this.sessionInstance.sessionName 
            });

        } catch (error) {
            throw new Error(`Heartbeat error: ${error.message}`);
        }
    }

    async attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.sessionConfig.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        this.logger.warning(`🔄 [${this.serverId}] Reconnect attempt ${this.reconnectAttempts}/${this.sessionConfig.maxReconnectAttempts} in ${delay}ms`);
        this.emit('reconnectAttempt', { 
            attempt: this.reconnectAttempts, 
            maxAttempts: this.sessionConfig.maxReconnectAttempts,
            delay 
        });

        await this.delay(delay);

        try {
            await this.createSession();
            this.logger.success(`✅ [${this.serverId}] Session reconnected successfully`);
            this.emit('sessionRecovered', { sessionName: this.sessionInstance?.sessionName });
        } catch (error) {
            if (this.reconnectAttempts < this.sessionConfig.maxReconnectAttempts) {
                await this.attemptReconnect();
            } else {
                this.logger.error(`❌ [${this.serverId}] Max reconnect attempts reached`);
                this.emit('error', new Error('Max reconnect attempts exceeded'));
            }
        }
    }

    async getHealthStatus() {
        try {
            if (!this.isRunning || !this.sessionInstance) {
                return { healthy: false, reason: 'Session not running' };
            }

            const now = Date.now();
            const timeSinceHeartbeat = this.lastHeartbeat ? now - this.lastHeartbeat : Infinity;
            const maxHeartbeatAge = (this.sessionConfig.heartbeatInterval || 60000) * 2;

            if (timeSinceHeartbeat > maxHeartbeatAge) {
                return { healthy: false, reason: `No heartbeat for ${Math.floor(timeSinceHeartbeat / 1000)}s` };
            }

            return { 
                healthy: true, 
                lastHeartbeat: this.lastHeartbeat,
                sessionName: this.sessionInstance.sessionName,
                accountCount: this.allAccounts.length
            };

        } catch (error) {
            return { healthy: false, reason: `Health check error: ${error.message}` };
        }
    }

    async stop() {
        this.logger.info(`🛑 [${this.serverId}] Stopping session manager...`);
        
        this.isRunning = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // Attempt to gracefully close the session
        if (this.sessionInstance) {
            try {
                const url = `https://sessiondirectory.xboxlive.com/serviceconfigs/${Constants.SERVICE_CONFIG_ID}/sessionTemplates/MinecraftLobby/sessions/${this.sessionInstance.sessionName}`;
                
                await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': this.hostAccount.authHeader,
                        'x-xbl-contract-version': '107'
                    }
                });

                this.logger.debug(`🗑️ [${this.serverId}] Session deleted from Xbox Live`);
            } catch (error) {
                this.logger.warning(`⚠️ [${this.serverId}] Could not delete session:`, error.message);
            }
        }

        this.sessionInstance = null;
        this.reconnectAttempts = 0;
        this.lastHeartbeat = null;
        
        this.emit('stopped');
        this.logger.success(`✅ [${this.serverId}] Session manager stopped`);
    }
}

module.exports = { SessionManager };
