# FriendConnect Bot v3.1 - Deployment Guide

## GitHub Integration for Pterodactyl

The FriendConnect bot is now fully configured for GitHub deployment with Pterodactyl Panel integration.

### Files Required for GitHub Repository

When deploying to GitHub, ensure your repository contains these key files:

#### Essential Bot Files
- `index-friendconnect.js` - Main application entry point
- `multi-server-manager.js` - Multi-server orchestration
- `session-manager.js` - Xbox Live session management
- `auth-manager.js` - Xbox Live authentication
- `friend-manager.js` - Friend request automation
- `health-monitor.js` - System health monitoring
- `config-validator.js` - Configuration validation
- `logger.js` - Structured logging system

#### Configuration Files
- `config.json.example` - Configuration template
- `package.json.friendconnect` - Node.js package configuration for deployment
- `friendconnect-egg.json` - Pterodactyl Panel egg configuration

#### Documentation
- `README.md` - Project overview and quick start
- `SETUP.md` - Detailed setup instructions
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - MIT license

### Pterodactyl Panel Setup

#### Default Repository
The egg is configured to download from:
```
https://github.com/friendconnect-community/friendconnect-bot
```

#### Custom Repository
To use your own GitHub repository:

1. **Upload Files**: Push all bot files to your GitHub repository
2. **Set Environment Variables** in Pterodactyl:
   - `GITHUB_USER`: Your GitHub username
   - `GITHUB_REPO`: Your repository name

#### Example Custom Repository Setup
```bash
# Environment Variables in Pterodactyl
GITHUB_USER=myusername
GITHUB_REPO=my-friendconnect-bot
```

This will download from: `https://github.com/myusername/my-friendconnect-bot`

### Installation Process

The Pterodactyl egg automatically:

1. **Downloads** the repository from GitHub
2. **Installs** Node.js dependencies
3. **Configures** the package.json (uses CommonJS format)
4. **Creates** configuration from template
5. **Sets up** required directories (`auth/`, `logs/`)
6. **Verifies** installation integrity

### Configuration Variables

The egg provides these configurable options:

#### Server Settings
- `SERVER` - Minecraft server hostname/IP
- `PORT` - Server port (default: 19132)
- `HOST_NAME` - Display name in Xbox Live
- `WORLD_NAME` - World name in Friends tab

#### Authentication
- `XBOX_ACCOUNT` - Xbox Live account email
- `DEMO_MODE` - Enable testing without Xbox authentication

#### Session Management
- `AUTO_RECONNECT` - Enable automatic reconnection
- `MAX_RECONNECT_ATTEMPTS` - Maximum reconnection attempts
- `HEALTH_CHECK_INTERVAL` - Health monitoring interval

#### Logging
- `LOG_LEVEL` - Logging verbosity (error, warning, info, debug)

### Module Compatibility

The bot handles module compatibility automatically:

- **Local Development**: Uses CommonJS format (current working version)
- **GitHub Deployment**: Downloads as-is and converts if needed
- **Package Management**: Automatically selects compatible node-fetch version (v2 for CommonJS)

### GitHub Repository Structure

Your repository should have this structure:
```
friendconnect-bot/
├── index-friendconnect.js
├── multi-server-manager.js
├── session-manager.js
├── auth-manager.js
├── friend-manager.js
├── health-monitor.js
├── config-validator.js
├── logger.js
├── config.json.example
├── package.json.friendconnect
├── friendconnect-egg.json
├── README.md
├── SETUP.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

### Next Steps

1. **Create GitHub Repository**
2. **Upload All Files** from this Replit workspace
3. **Import Egg** into Pterodactyl Panel
4. **Create Server** using the FriendConnect egg
5. **Configure Settings** through the panel interface
6. **Start Server** and monitor logs

The bot will automatically download from your GitHub repository and set up the complete environment.