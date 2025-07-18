// Official FriendConnect Implementation for Hidden Kingdom Server
const { FriendConnectSession } = require('./friendconnect-official.js');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (error) {
    console.error('❌ Failed to load config.json:', error.message);
    process.exit(1);
}

// Extract server configuration (support both single and multi-server configs)
const serverConfig = config.servers ? config.servers[0] : config;

console.log('🚀 Starting FriendConnect Official Implementation...');
console.log(`📡 Server: ${serverConfig.hostName || 'FriendConnect Server'}`);
console.log(`🌍 World: ${serverConfig.worldName || 'Join via Friends Tab'}`);
console.log(`📍 Address: ${serverConfig.ip || 'localhost'}:${serverConfig.port || 19132}`);
console.log(`🎮 Version: ${serverConfig.version || '1.21.51'}`);
console.log(`🔧 Protocol: ${serverConfig.protocol || 685}`);

// Create session with official FriendConnect
const session = new FriendConnectSession({
    // Server details
    hostName: serverConfig.hostName || "Hidden Kingdom Server",
    worldName: serverConfig.worldName || "Join via Friends Tab - Hidden Kingdom",
    ip: serverConfig.ip || "play.hiddenkingdom.nl",
    port: serverConfig.port || 19132,
    
    // Version info
    version: serverConfig.version || "1.21.51",
    protocol: serverConfig.protocol || 685,
    
    // Player counts
    connectedPlayers: serverConfig.connectedPlayers || 0,
    maxConnectedPlayers: serverConfig.maxConnectedPlayers || 40,
    
    // Connection settings
    connectionType: serverConfig.connectionType || 6,
    joinability: serverConfig.joinability || "joinable_by_friends",
    
    // Features
    autoFriending: serverConfig.autoFriending !== false,
    pingServerForInfo: serverConfig.pingServerForInfo !== false,
    log: true,
    
    // Authentication
    tokenPath: "./auth",
    accounts: serverConfig.accounts || [],
    
    // Constants (what values to use from server ping vs config)
    constants: {
        worldName: serverConfig.constants?.worldName || false,
        hostName: serverConfig.constants?.hostName || false,
        maxConnectedPlayers: serverConfig.constants?.maxConnectedPlayers || true,
        connectedPlayers: serverConfig.constants?.connectedPlayers || true,
        protocol: serverConfig.constants?.protocol || false,
        version: serverConfig.constants?.version || true
    }
});

// Handle session events
session.on('sessionCreated', (data) => {
    console.log('✅ Xbox Live session created successfully!');
    console.log(`📡 Session ID: ${data.sessionId}`);
    console.log(`🔗 Connection ID: ${data.connectionId}`);
    console.log('🎮 Players can now join via Xbox Live Friends tab');
});

session.on('webSocketMessage', (message) => {
    if (message.type === 'member_join') {
        console.log('👤 Player joined the session');
    } else if (message.type === 'member_leave') {
        console.log('👋 Player left the session');
    }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down FriendConnect...');
    await session.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down FriendConnect...');
    await session.cleanup();
    process.exit(0);
});

// Update session info every 5 minutes
setInterval(async () => {
    await session.updateSessionInfo();
}, 5 * 60 * 1000);

console.log('🎯 FriendConnect Official Implementation is running!');
console.log('👀 Watch for authentication prompts above...');