# FriendConnect Bot Setup Guide

## Prerequisites

### System Requirements
- Node.js 18.0.0 or higher
- npm (comes with Node.js)
- Internet connection for Xbox Live authentication

### Microsoft Account Requirements
- Microsoft account with Minecraft ownership (Bedrock or Java Edition)
- Active Xbox Live account
- Account must have played Minecraft at least once
- Proper Xbox Live permissions

## Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/friendconnect-bot.git
cd friendconnect-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure the Bot
```bash
cp config.json.example config.json
```

Edit `config.json` with your settings:
```json
{
  "server": "your-server.com",
  "port": 19132,
  "hostName": "Your Server Name",
  "worldName": "Join via Friends Tab",
  "accounts": [
    "your-email@example.com"
  ],
  "demoMode": false
}
```

### 4. Run the Bot
```bash
node index-friendconnect.js
```

## Authentication Process

### First Run Authentication
1. Start the bot
2. You'll see a message like:
   ```
   🔐 Microsoft authentication required for your-email@example.com
   📱 Visit: https://microsoft.com/link
   🔑 Enter device code: ABC123DEF
   ```
3. Open https://microsoft.com/link in your browser
4. Enter the displayed device code
5. Sign in with your Microsoft account
6. Wait for authentication to complete

### Authentication Tokens
- Tokens are stored in the `auth/` directory
- They are automatically refreshed when needed
- Keep this directory secure and private

## Demo Mode (Testing)

For testing without Microsoft authentication:

1. Set `"demoMode": true` in config.json
2. Run the bot - it will simulate Xbox Live sessions
3. Perfect for testing configuration and bot behavior

## Troubleshooting

### Authentication Errors

#### 403 Forbidden Error
- **Cause**: Account doesn't own Minecraft
- **Solution**: Use an account that owns Minecraft Bedrock or Java Edition

#### invalid_grant Error
- **Cause**: Account authentication issues
- **Solutions**:
  - Try a different Microsoft account
  - Ensure account has Xbox Live access
  - Check if account has played Minecraft before

#### Timeout Error
- **Cause**: Authentication took longer than 15 minutes
- **Solution**: Restart the bot and complete authentication faster

### Common Issues

#### "No Xbox Live accounts could be initialized"
- Check that your Microsoft account owns Minecraft
- Verify Xbox Live account is active
- Try demo mode first to test configuration

#### Bot connects but no sessions appear
- Ensure bot accounts are friends with test accounts
- Check that accounts have proper Xbox Live permissions
- Verify server IP and port are correct

## Advanced Configuration

### Multiple Accounts
```json
{
  "accounts": [
    "account1@example.com",
    "account2@example.com",
    "account3@example.com"
  ]
}
```

### Server Settings
```json
{
  "server": "play.example.com",
  "port": 19132,
  "hostName": "My Awesome Server",
  "worldName": "Join via Friends Tab - My Server",
  "maxPlayers": 100
}
```

### Monitoring Settings
```json
{
  "logStats": true,
  "statsInterval": 300,
  "debugMode": false,
  "autoReconnect": true,
  "maxReconnectAttempts": 10
}
```

## Production Deployment

### VPS/Dedicated Server
1. Install Node.js 18+
2. Clone repository
3. Install dependencies
4. Configure with production settings
5. Run with process manager (PM2 recommended)

### Pterodactyl Panel
1. Import the `friendconnect-egg.json` file
2. Create new server with the imported egg
3. Configure environment variables
4. Start the server

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index-friendconnect.js"]
```

## Monitoring and Logs

### Bot Statistics
The bot logs statistics every 5 minutes:
- Sessions created
- Xbox accounts connected
- Uptime
- Server status

### Log Files
- Console output shows all bot activity
- Authentication status and errors
- Session creation and monitoring
- Player connection events

## Security Notes

- Keep `auth/` directory secure
- Don't commit authentication tokens to version control
- Use environment variables for sensitive configuration
- Regular token rotation is handled automatically

## Support

If you encounter issues:
1. Check this setup guide
2. Review the troubleshooting section
3. Try demo mode for testing
4. Ensure your Microsoft account owns Minecraft
5. Check Xbox Live account status