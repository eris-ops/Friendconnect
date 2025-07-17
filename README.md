# FriendConnect Bot v2.0

A modernized Node.js Minecraft Bedrock bot that automatically accepts friend requests using Microsoft OAuth authentication. This bot enables console players to join Bedrock servers through the friends tab.

## ✨ Features

- 🔐 **Microsoft OAuth Authentication** - Secure device code login with automatic token management
- 🤖 **Auto-Accept Friend Requests** - Automatically accepts incoming friend requests (simulated)
- 🔄 **Auto-Reconnection** - Handles disconnections and kicks with exponential backoff
- 📊 **Comprehensive Logging** - Detailed logs with timestamps and emoji indicators
- 🎮 **Pterodactyl Support** - Ready-to-deploy Pterodactyl Panel egg included
- ⚙️ **Configurable** - Easy configuration via JSON file
- 📈 **Statistics Tracking** - Monitor friend requests and uptime
- 🚀 **Authentication Ready** - Complete Microsoft OAuth implementation ready for extension

## 🔧 Current Implementation

This version focuses on **Microsoft OAuth authentication** and provides a solid foundation for Bedrock protocol integration. The bot successfully:

- ✅ Authenticates with Microsoft using device code flow
- ✅ Stores and manages authentication tokens
- ✅ Provides comprehensive logging and monitoring
- ✅ Simulates friend request handling for demonstration
- ✅ Includes Pterodactyl deployment configuration

**Note**: Full Bedrock protocol connectivity requires additional native dependencies. This implementation provides the authentication foundation that can be extended with `bedrock-protocol` once proper build environment is configured.

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm package manager
- Microsoft/Xbox Live account with Minecraft ownership
- Access to a web browser for OAuth authentication

### Installation

1. **Download the bot files**
   ```bash
   # Clone or download the project files
   # Ensure you have: index.js, config.json, README.md, friendconnect-egg.json
   ```

2. **Install dependencies**
   ```bash
   npm install minecraft-auth
   ```

3. **Configure the bot**
   Edit `config.json` to set your desired settings:
   ```json
   {
     "server": "play.hiddenkingdom.nl",
     "port": 19132,
     "gamertag": "YourBotName",
     "autoReconnect": true,
     "logFriendRequests": true
   }
   ```

4. **Run the bot**
   ```bash
   node index.js
   ```

5. **Complete authentication**
   - The bot will display a URL and ask you to visit it
   - Log in with your Microsoft/Xbox account
   - Grant permission to access Xbox Live
   - The bot will automatically save your authentication tokens

## 📋 Configuration

Edit `config.json` to customize bot behavior:

```json
{
  "server": "play.hiddenkingdom.nl",     // Target Bedrock server
  "port": 19132,                        // Server port
  "gamertag": "FriendBot2024",          // Bot display name
  "version": "1.20.81",                 // Minecraft version
  "autoReconnect": true,                // Auto-reconnect on disconnect
  "maxReconnectAttempts": 10,           // Max reconnection attempts
  "reconnectDelay": 5000,               // Delay between reconnects (ms)
  "logFriendRequests": true,            // Log friend requests
  "logStats": true,                     // Show statistics
  "statsInterval": 300,                 // Stats interval (seconds)
  "pingServer": true,                   // Ping server before connect
  "debugMode": false                    // Enable debug logging
}
```

## 🎮 Pterodactyl Panel Deployment

### Using the Included Egg

1. **Import the egg**
   - In Pterodactyl Admin Panel, go to Nests → Import Egg
   - Upload `friendconnect-egg.json`

2. **Create server**
   - Create new server using "FriendConnect Bot" egg
   - Configure environment variables:
     - `BOT_GAMERTAG`: Your bot's display name
     - `SERVER_HOST`: Target Bedrock server
     - `SERVER_PORT`: Server port (usually 19132)

3. **Start and authenticate**
   - Start the server
   - Check console logs for authentication URL
   - Complete OAuth flow in browser
   - Bot will start automatically after authentication

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_GAMERTAG` | Bot display name | `FriendBot2024` |
| `SERVER_HOST` | Target server hostname | `play.hiddenkingdom.nl` |
| `SERVER_PORT` | Server port | `19132` |
| `AUTO_RECONNECT` | Auto-reconnect on disconnect | `true` |
| `LOG_FRIEND_REQUESTS` | Log friend requests | `true` |
| `MAX_RECONNECT_ATTEMPTS` | Max reconnection attempts | `10` |

## 🔧 Development & Extension

### Adding Full Bedrock Protocol Support

To extend this bot with full Bedrock protocol connectivity:

1. **Install build dependencies**
   ```bash
   # On Ubuntu/Debian
   sudo apt install cmake gcc python3 build-essential
   
   # On CentOS/RHEL
   sudo yum install cmake gcc python3 make
   ```

2. **Install bedrock-protocol**
   ```bash
   npm install bedrock-protocol
   ```

3. **Update connection code**
   Replace the `simulateConnection` method in `index.js` with actual bedrock-protocol client implementation.

### Project Structure

```
friendconnect-bot/
├── index.js                 # Main bot implementation
├── config.json             # Configuration file
├── auth.json               # Stored authentication tokens (auto-generated)
├── README.md               # This documentation
├── friendconnect-egg.json  # Pterodactyl Panel egg
└── .env.example            # Environment variables template
```

## 🚨 Important Notes

### Security

- **Use dedicated accounts**: Create separate Xbox/Microsoft accounts for bot usage
- **Protect auth.json**: Contains sensitive authentication tokens
- **Regular monitoring**: Check bot logs regularly for any issues

### Limitations

- **Authentication dependency**: Requires valid Minecraft ownership on the Microsoft account
- **Platform restrictions**: Currently supports Bedrock Edition servers only
- **Rate limits**: Microsoft OAuth has rate limits; don't run multiple instances simultaneously

### Legal Considerations

- **Terms of Service**: Ensure bot usage complies with Minecraft and server ToS
- **Automation policies**: Check target server policies regarding automated clients
- **Account safety**: Use at your own risk; Microsoft may suspend accounts for unusual activity

## 📊 Monitoring & Logs

The bot provides comprehensive logging with emoji indicators:

- 🚀 **Startup**: Bot initialization and configuration loading
- 🔐 **Authentication**: Microsoft OAuth login process
- 🎮 **Connection**: Server connection attempts and status
- 👥 **Friend Requests**: Incoming friend requests and responses
- 📊 **Statistics**: Periodic stats and uptime information
- ❌ **Errors**: Error messages and troubleshooting info

### Sample Log Output

```
🤖 ================================
🤖    FriendConnect Bot v2.0    
🤖  Minecraft Bedrock Auto-Bot  
🤖 ================================

[2025-01-17T12:00:00.000Z] 📋 🚀 Starting FriendConnect Bot...
[2025-01-17T12:00:00.001Z] 📋 📋 Configuration loaded for server: play.hiddenkingdom.nl:19132
[2025-01-17T12:00:00.002Z] 🔐 🔑 Microsoft OAuth Login Required
[2025-01-17T12:00:05.000Z] ✅ Authentication completed for PlayerName
[2025-01-17T12:00:05.001Z] 🎯 Authentication successful - Ready to connect
[2025-01-17T12:00:05.002Z] 🤖 FriendConnect Bot is now ready!
```

## 🛠️ Troubleshooting

### Common Issues

**"Authentication failed"**
- Ensure your Microsoft account owns Minecraft
- Check internet connectivity
- Verify browser can access OAuth URLs

**"Connection timeout"**
- Verify server address and port
- Check firewall settings
- Ensure target server is online

**"Package installation failed"**
- Install build dependencies (cmake, gcc, python3)
- Update Node.js to latest LTS version
- Clear npm cache: `npm cache clean --force`

### Getting Help

1. Check console logs for specific error messages
2. Verify configuration in `config.json`
3. Ensure authentication tokens in `auth.json` are valid
4. Test with a different Bedrock server if possible

For additional support, refer to the original FriendConnect community or create an issue with your specific setup details.

## 📜 License

This project is based on the original FriendConnect by jrcarl624. Please refer to the original repository for licensing information.

## 🙏 Acknowledgments

- Original FriendConnect project by [jrcarl624](https://github.com/jrcarl624/FriendConnect)
- PrismarineJS community for protocol implementations
- Microsoft/Mojang for authentication APIs
- Minecraft community for testing and feedback
   