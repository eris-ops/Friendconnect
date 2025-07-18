# FriendConnect Bot v3.0

A modernized Node.js Minecraft Bedrock bot that revolutionizes friend management and server interactions through Xbox Live Multiplayer Sessions.

## Overview

FriendConnect Bot v3.0 implements the jrcarl624/FriendConnect methodology using Xbox Live Multiplayer Sessions. Instead of direct Bedrock protocol connections, the bot creates Xbox Live sessions that appear in players' Friends tabs, allowing console players to join servers without requiring server IPs.

## Features

- **Xbox Live Session Broadcasting** - Creates discoverable game sessions in Friends tab
- **Multi-Account Support** - Manages multiple Xbox accounts for improved discoverability
- **Cross-Friendship Management** - Automatically establishes friendships between bot accounts
- **Demo Mode** - Test functionality without Microsoft authentication
- **Real-time Monitoring** - Session health checks and statistics logging
- **Pterodactyl Ready** - Complete deployment egg for game server panels

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Microsoft account with Minecraft ownership (for production use)
- Xbox Live access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/friendconnect-bot.git
cd friendconnect-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
```bash
cp config.json.example config.json
# Edit config.json with your server details and Xbox Live accounts
```

4. Run the bot:
```bash
node index-friendconnect.js
```

### Demo Mode (No Authentication Required)

For testing without Microsoft authentication:

1. Set `"demoMode": true` in config.json
2. Run the bot - it will simulate Xbox Live sessions

## Configuration

Edit `config.json` to customize the bot:

```json
{
  "server": "your-server.com",
  "port": 19132,
  "hostName": "Your Server Name",
  "worldName": "Join via Friends Tab",
  "accounts": [
    "account1@example.com",
    "account2@example.com"
  ],
  "demoMode": false,
  "maxPlayers": 40
}
```

## Authentication

### Microsoft Account Requirements

Your Microsoft accounts must:
- Own Minecraft Bedrock Edition OR Minecraft Java Edition
- Have active Xbox Live access
- Have played Minecraft at least once
- Have proper Xbox Live permissions

### Authentication Process

1. Start the bot
2. Visit the displayed Microsoft authentication URL
3. Enter the device code
4. Sign in with your Microsoft account
5. Wait for authentication to complete

## Deployment

### Manual Deployment

1. Install Node.js 18+ on your server
2. Clone this repository
3. Install dependencies with `npm install`
4. Configure `config.json`
5. Run with `node index-friendconnect.js`

### Pterodactyl Panel

Use the included `friendconnect-egg.json` for automatic deployment on Pterodactyl Panel.

## Troubleshooting

### Authentication Errors

If you get authentication errors:

1. **Use Demo Mode**: Set `"demoMode": true` for testing
2. **Check Account**: Ensure your Microsoft account owns Minecraft
3. **Xbox Live Status**: Verify Xbox Live account is active
4. **Different Account**: Try an account that definitely owns Minecraft

### Common Issues

- **403 Forbidden**: Account doesn't own Minecraft
- **invalid_grant**: Account authentication issues
- **Timeout**: Authentication took too long (15 minute limit)

## How It Works

1. **Account Authentication**: Bot authenticates with Microsoft/Xbox Live
2. **Cross-Friendships**: Establishes friendships between bot accounts
3. **Session Creation**: Creates Xbox Live MinecraftLobby multiplayer session
4. **Broadcasting**: Session appears in Friends tab of players who follow bot accounts
5. **Discovery**: Players join by clicking "Join Game" in Friends list

## Files Structure

```
friendconnect-bot/
├── index-friendconnect.js     # Main bot entry point
├── friendconnect-session.js   # Xbox Live session management
├── config.json               # Configuration file
├── package.json              # Dependencies
├── README.md                 # This file
├── friendconnect-egg.json    # Pterodactyl deployment
└── auth/                     # Authentication cache
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review authentication requirements
- Enable demo mode for testing
- Ensure your Microsoft account owns Minecraft

## Acknowledgments

- Based on the jrcarl624/FriendConnect methodology
- Uses prismarine-auth for Xbox Live authentication
- Implements Xbox Live Multiplayer Sessions API