const fs = require('fs');
const path = require('path');

/**
 * Enhanced Configuration Validator with comprehensive validation and auto-correction
 */
class ConfigValidator {
    constructor() {
        this.defaultConfig = {
            // Server settings
            server: "play.example.com",
            port: 19132,
            hostName: "FriendConnect Server",
            worldName: "Join via Friends Tab",
            version: "1.21.51",
            protocol: 685,
            maxPlayers: 40,
            
            // Account settings
            accounts: [],
            demoMode: false,
            
            // Session settings
            session: {
                autoReconnect: true,
                maxReconnectAttempts: 10,
                reconnectDelay: 5000,
                heartbeatInterval: 60000,
                autoRecover: true
            },
            
            // Authentication settings
            auth: {
                tokenPath: "./auth/",
                maxRetries: 3,
                retryDelay: 5000
            },
            
            // Friend management settings
            friends: {
                maxConcurrentRequests: 5,
                requestDelay: 1000,
                autoAcceptFriends: true
            },
            
            // Monitoring settings
            monitoring: {
                checkInterval: 60000,
                healthThreshold: 0.8,
                criticalThreshold: 0.3,
                maxFailures: 3,
                restartOnCriticalFailure: false,
                maxInactivityTime: 300000,
                statsInterval: 300000
            },
            
            // Global settings
            global: {
                continueOnServerFailure: false
            },
            
            // Debugging settings
            debugging: {
                enableStackTrace: false,
                enableDebugMode: false,
                logLevel: "info"
            }
        };
        
        this.validationRules = {
            server: { type: 'string', required: true, minLength: 1 },
            port: { type: 'number', required: true, min: 1, max: 65535 },
            hostName: { type: 'string', required: true, maxLength: 64 },
            worldName: { type: 'string', required: true, maxLength: 64 },
            version: { type: 'string', required: true, pattern: /^\d+\.\d+\.\d+$/ },
            protocol: { type: 'number', required: true, min: 1 },
            maxPlayers: { type: 'number', required: true, min: 1, max: 100 },
            accounts: { type: 'array', required: false, itemType: 'string' },
            demoMode: { type: 'boolean', required: false }
        };
    }

    async validate(config) {
        console.log('🔍 Validating configuration...');
        
        try {
            // Create a deep copy of config to avoid mutations
            const validatedConfig = JSON.parse(JSON.stringify(config));
            
            // Handle multi-server vs single server configuration
            const processedConfig = this.processServerConfiguration(validatedConfig);
            
            // Apply defaults
            const configWithDefaults = this.applyDefaults(processedConfig);
            
            // Validate structure
            this.validateStructure(configWithDefaults);
            
            // Validate servers
            this.validateServers(configWithDefaults);
            
            // Validate accounts
            this.validateAccounts(configWithDefaults);
            
            // Validate settings
            this.validateSettings(configWithDefaults);
            
            // Create backup if validation passes
            this.createConfigBackup(config);
            
            console.log('✅ Configuration validation passed');
            return configWithDefaults;
            
        } catch (error) {
            console.error('❌ Configuration validation failed:', error.message);
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
    }

    processServerConfiguration(config) {
        // Check if this is a multi-server configuration
        if (config.servers && Array.isArray(config.servers)) {
            console.log('📡 Multi-server configuration detected');
            return config;
        }
        
        // Convert single server config to multi-server format
        console.log('📡 Single server configuration detected, converting to multi-server format');
        
        const serverConfig = {
            id: 'main-server',
            server: config.server,
            port: config.port,
            hostName: config.hostName,
            worldName: config.worldName,
            version: config.version,
            protocol: config.protocol,
            maxPlayers: config.maxPlayers,
            accounts: config.accounts
        };
        
        return {
            ...config,
            servers: [serverConfig]
        };
    }

    applyDefaults(config) {
        const result = { ...config };
        
        // Apply global defaults
        Object.keys(this.defaultConfig).forEach(key => {
            if (!(key in result)) {
                result[key] = this.defaultConfig[key];
                console.log(`📝 Applied default for ${key}:`, this.defaultConfig[key]);
            }
        });
        
        // Apply defaults to each server
        if (result.servers) {
            result.servers = result.servers.map((server, index) => {
                const serverDefaults = {
                    id: server.id || `server-${index + 1}`,
                    server: server.server || this.defaultConfig.server,
                    port: server.port || this.defaultConfig.port,
                    hostName: server.hostName || this.defaultConfig.hostName,
                    worldName: server.worldName || this.defaultConfig.worldName,
                    version: server.version || this.defaultConfig.version,
                    protocol: server.protocol || this.defaultConfig.protocol,
                    maxPlayers: server.maxPlayers || this.defaultConfig.maxPlayers,
                    accounts: server.accounts || []
                };
                
                return { ...serverDefaults, ...server };
            });
        }
        
        // Deep merge nested objects
        ['session', 'auth', 'friends', 'monitoring', 'global', 'debugging'].forEach(section => {
            if (section in this.defaultConfig) {
                result[section] = { ...this.defaultConfig[section], ...(result[section] || {}) };
            }
        });
        
        return result;
    }

    validateStructure(config) {
        // Check for required top-level properties
        if (!config.servers || !Array.isArray(config.servers) || config.servers.length === 0) {
            throw new Error('At least one server configuration is required');
        }
        
        // Validate boolean flags
        if (typeof config.demoMode !== 'boolean') {
            throw new Error('demoMode must be a boolean');
        }
        
        console.log('✅ Configuration structure validation passed');
    }

    validateServers(config) {
        console.log(`🔍 Validating ${config.servers.length} server configuration(s)...`);
        
        config.servers.forEach((server, index) => {
            const serverContext = `Server ${index + 1} (${server.id || 'unnamed'})`;
            
            // Validate required fields
            if (!server.server) {
                throw new Error(`${serverContext}: server hostname/IP is required`);
            }
            
            if (!server.port || server.port < 1 || server.port > 65535) {
                throw new Error(`${serverContext}: valid port number (1-65535) is required`);
            }
            
            if (!server.hostName || typeof server.hostName !== 'string') {
                throw new Error(`${serverContext}: hostName must be a non-empty string`);
            }
            
            if (!server.worldName || typeof server.worldName !== 'string') {
                throw new Error(`${serverContext}: worldName must be a non-empty string`);
            }
            
            // Validate version format
            if (!server.version || !/^\d+\.\d+\.\d+$/.test(server.version)) {
                throw new Error(`${serverContext}: version must be in format X.Y.Z (e.g., 1.21.51)`);
            }
            
            // Validate protocol
            if (!server.protocol || server.protocol < 1) {
                throw new Error(`${serverContext}: protocol must be a positive number`);
            }
            
            // Validate maxPlayers
            if (!server.maxPlayers || server.maxPlayers < 1 || server.maxPlayers > 100) {
                throw new Error(`${serverContext}: maxPlayers must be between 1 and 100`);
            }
            
            console.log(`✅ ${serverContext} validation passed`);
        });
    }

    validateAccounts(config) {
        if (config.demoMode) {
            console.log('🎭 Demo mode enabled - skipping account validation');
            return;
        }
        
        let totalAccounts = 0;
        
        config.servers.forEach((server, index) => {
            const serverContext = `Server ${index + 1} (${server.id || 'unnamed'})`;
            
            if (!server.accounts || !Array.isArray(server.accounts)) {
                throw new Error(`${serverContext}: accounts must be an array`);
            }
            
            if (server.accounts.length === 0) {
                throw new Error(`${serverContext}: at least one Xbox Live account is required (or enable demoMode)`);
            }
            
            // Validate email formats
            server.accounts.forEach((email, emailIndex) => {
                if (typeof email !== 'string') {
                    throw new Error(`${serverContext}: account ${emailIndex + 1} must be a string`);
                }
                
                if (!this.isValidEmail(email)) {
                    throw new Error(`${serverContext}: account ${emailIndex + 1} "${email}" is not a valid email address`);
                }
            });
            
            totalAccounts += server.accounts.length;
            console.log(`✅ ${serverContext}: ${server.accounts.length} account(s) validated`);
        });
        
        console.log(`✅ Total accounts across all servers: ${totalAccounts}`);
    }

    validateSettings(config) {
        console.log('🔍 Validating advanced settings...');
        
        // Validate session settings
        if (config.session) {
            if (typeof config.session.autoReconnect !== 'boolean') {
                throw new Error('session.autoReconnect must be a boolean');
            }
            
            if (config.session.maxReconnectAttempts < 1 || config.session.maxReconnectAttempts > 50) {
                throw new Error('session.maxReconnectAttempts must be between 1 and 50');
            }
            
            if (config.session.reconnectDelay < 1000 || config.session.reconnectDelay > 60000) {
                throw new Error('session.reconnectDelay must be between 1000ms and 60000ms');
            }
        }
        
        // Validate auth settings
        if (config.auth) {
            if (config.auth.maxRetries < 1 || config.auth.maxRetries > 10) {
                throw new Error('auth.maxRetries must be between 1 and 10');
            }
            
            if (config.auth.retryDelay < 1000 || config.auth.retryDelay > 30000) {
                throw new Error('auth.retryDelay must be between 1000ms and 30000ms');
            }
        }
        
        // Validate friend settings
        if (config.friends) {
            if (config.friends.maxConcurrentRequests < 1 || config.friends.maxConcurrentRequests > 20) {
                throw new Error('friends.maxConcurrentRequests must be between 1 and 20');
            }
            
            if (config.friends.requestDelay < 500 || config.friends.requestDelay > 10000) {
                throw new Error('friends.requestDelay must be between 500ms and 10000ms');
            }
        }
        
        // Validate monitoring settings
        if (config.monitoring) {
            if (config.monitoring.checkInterval < 10000 || config.monitoring.checkInterval > 600000) {
                throw new Error('monitoring.checkInterval must be between 10s and 10min');
            }
            
            if (config.monitoring.healthThreshold < 0.1 || config.monitoring.healthThreshold > 1.0) {
                throw new Error('monitoring.healthThreshold must be between 0.1 and 1.0');
            }
            
            if (config.monitoring.criticalThreshold < 0.1 || config.monitoring.criticalThreshold > 1.0) {
                throw new Error('monitoring.criticalThreshold must be between 0.1 and 1.0');
            }
        }
        
        console.log('✅ Advanced settings validation passed');
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    createConfigBackup(originalConfig) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `config.backup.${timestamp}.json`;
            
            fs.writeFileSync(backupPath, JSON.stringify(originalConfig, null, 2));
            console.log(`💾 Configuration backup created: ${backupPath}`);
            
            // Clean up old backups (keep only last 5)
            this.cleanupOldBackups();
            
        } catch (error) {
            console.warn('⚠️ Could not create configuration backup:', error.message);
        }
    }

    cleanupOldBackups() {
        try {
            const files = fs.readdirSync('.')
                .filter(file => file.startsWith('config.backup.') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    time: fs.statSync(file).mtime
                }))
                .sort((a, b) => b.time - a.time);
            
            // Remove backups beyond the 5 most recent
            if (files.length > 5) {
                files.slice(5).forEach(file => {
                    try {
                        fs.unlinkSync(file.name);
                        console.log(`🗑️ Removed old backup: ${file.name}`);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                });
            }
            
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    // Generate a sample configuration with comments
    generateSampleConfig() {
        return {
            "_comment": "FriendConnect Bot v3.1 Configuration",
            "_documentation": "For detailed setup instructions, see SETUP.md",
            
            "demoMode": false,
            "_demoMode_comment": "Set to true to test without Microsoft authentication",
            
            "servers": [
                {
                    "id": "main-server",
                    "server": "play.example.com",
                    "port": 19132,
                    "hostName": "My Minecraft Server",
                    "worldName": "Join via Friends Tab - My Server",
                    "version": "1.21.51",
                    "protocol": 685,
                    "maxPlayers": 40,
                    "accounts": [
                        "account1@example.com",
                        "account2@example.com"
                    ]
                }
            ],
            "_servers_comment": "You can configure multiple servers by adding more objects to this array",
            
            "session": {
                "autoReconnect": true,
                "maxReconnectAttempts": 10,
                "reconnectDelay": 5000,
                "heartbeatInterval": 60000,
                "autoRecover": true
            },
            
            "auth": {
                "tokenPath": "./auth/",
                "maxRetries": 3,
                "retryDelay": 5000
            },
            
            "friends": {
                "maxConcurrentRequests": 5,
                "requestDelay": 1000,
                "autoAcceptFriends": true
            },
            
            "monitoring": {
                "checkInterval": 60000,
                "healthThreshold": 0.8,
                "criticalThreshold": 0.3,
                "maxFailures": 3,
                "restartOnCriticalFailure": false,
                "maxInactivityTime": 300000,
                "statsInterval": 300000
            },
            
            "global": {
                "continueOnServerFailure": false
            },
            
            "debugging": {
                "enableStackTrace": false,
                "enableDebugMode": false,
                "logLevel": "info"
            }
        };
    }
}

module.exports = { ConfigValidator };
