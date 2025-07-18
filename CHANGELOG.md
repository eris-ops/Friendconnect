# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2025-01-18

### 🚀 Major Features Added
- **Multi-Server Support**: Manage multiple Minecraft servers simultaneously with independent configurations
- **Advanced Health Monitoring**: System-wide health checks with automatic failure detection and recovery
- **Modular Architecture**: Separated components for better maintainability and scalability
- **Enhanced Session Recovery**: Intelligent session recovery with exponential backoff and failure limits
- **Smart Friend Management**: Queue-based friend request handling with rate limiting and batch processing
- **Comprehensive Configuration Validation**: Automatic validation, error correction, and default application
- **Structured Logging System**: Multi-level logging with file output, rotation, and structured data

### 🔧 Enhanced Components
- **SessionManager**: Dedicated session management with heartbeat monitoring and automatic recovery
- **AuthManager**: Enhanced authentication with multiple method fallbacks and token refresh
- **FriendManager**: Intelligent friend request automation with concurrent processing
- **HealthMonitor**: System-wide health monitoring with configurable thresholds and alerting
- **ConfigValidator**: Comprehensive configuration validation with backup creation
- **Logger**: Advanced logging with multiple outputs, rotation, and structured data

### 🔄 Improved Authentication
- Multiple authentication method support (Java, Android, Nintendo Switch)
- Automatic token refresh and caching
- Enhanced error handling with detailed guidance
- Timeout protection and retry mechanisms
- Better authentication failure diagnostics

### 📊 Enhanced Monitoring
- Real-time health status monitoring
- Automatic failure detection and recovery
- Configurable health thresholds and alerting
- System performance metrics tracking
- Detailed statistics reporting and logging

### ⚙️ Configuration Improvements
- Multi-server configuration support
- Backward compatibility with single-server configs
- Comprehensive validation with error correction
- Automatic backup creation
- Environment variable support for sensitive data

### 🛡️ Reliability Features
- Exponential backoff for reconnection attempts
- Circuit breaker pattern for failing services
- Graceful degradation on partial failures
- Automatic session recovery mechanisms
- Health-based restart capabilities

### 🔧 Developer Experience
- Modular codebase for easier maintenance
- Comprehensive error handling and logging
- Extensive configuration options
- Demo mode for testing without authentication
- Detailed documentation and setup guides

### 📝 Documentation Updates
- Updated README with new features and architecture
- Enhanced SETUP guide with advanced configuration
- Comprehensive CONTRIBUTING guidelines
- Detailed troubleshooting documentation
- Configuration examples and best practices

### 🐛 Bug Fixes
- Fixed authentication callback issues with device codes
- Resolved session creation failures under high load
- Fixed friend request rate limiting issues
- Corrected token refresh timing problems
- Resolved health monitoring false positives

### 🔧 Technical Improvements
- Better error propagation and handling
- Improved memory management and cleanup
- Enhanced concurrent request handling
- Optimized session heartbeat mechanisms
- Better resource utilization and scaling

### ⚠️ Breaking Changes
- **Configuration Structure**: Single server configs are automatically converted to multi-server format
- **File Structure**: New modular file organization (backward compatibility maintained)
- **Event Names**: Some internal event names have changed (affects custom integrations)
- **Health Monitoring**: New health check requirements (configurable)

### 🔄 Migration Guide
Existing v3.0 configurations will be automatically migrated to v3.1 format. No manual intervention required for basic setups.

For advanced configurations:
1. Review new configuration options in `config.json.example`
2. Update monitoring and health check settings if needed
3. Consider enabling new logging features
4. Test multi-server capabilities if managing multiple servers

## [3.0.0] - 2025-01-17

### Added
- Xbox Live Multiplayer Sessions implementation
- Multi-account support for improved discoverability
- Cross-friendship management between bot accounts
- Demo mode for testing without Microsoft authentication
- Real-time session monitoring and statistics
- Comprehensive error handling and user guidance
- Pterodactyl Panel deployment support
- Enhanced logging system with timestamps and emojis
- Authentication token caching and refresh
- GitHub Actions CI/CD workflow

### Changed
- **BREAKING**: Migrated from direct Bedrock protocol to Xbox Live Sessions
- **BREAKING**: Switched from `minecraft-auth` to `prismarine-auth` package
- **BREAKING**: Updated configuration schema for Xbox Live accounts
- Improved authentication flow with device code method
- Enhanced error messages for authentication failures
- Updated Node.js requirement to 18.0.0+

### Fixed
- Authentication callback issues with undefined device codes
- ES module compatibility with import/export statements
- Timeout handling in authentication flow
- Session creation and monitoring stability

### Security
- Secure token storage in auth directory
- Automatic token refresh handling
- Sensitive data protection in configuration

## [2.0.0] - 2024-12-15

### Added
- Microsoft OAuth device code authentication
- Bedrock protocol integration
- Automatic reconnection system
- Friend request handling
- Statistics logging and monitoring
- Pterodactyl Panel egg configuration
- Comprehensive README and setup documentation

### Changed
- Rebuilt system using `minecraft-auth` package
- Simplified connection simulation
- Enhanced logging with emoji indicators
- Improved error handling and user guidance

### Fixed
- Native compilation issues with bedrock-protocol
- Authentication timeout protection
- Connection stability improvements

## [1.0.0] - 2024-11-20

### Added
- Initial release
- Basic Minecraft Bedrock bot functionality
- Microsoft authentication
- Server connection capabilities
- Configuration system
- Basic logging

### Features
- Single server support
- Basic friend request automation
- Simple authentication flow
- Manual session management
- Console logging only

## Migration Guides

### Migrating from v3.0 to v3.1

#### Automatic Migration
Most configurations will be automatically migrated. The bot will:
- Convert single-server configs to multi-server format
- Apply default values for new settings
- Create configuration backups
- Validate and correct common issues

#### Manual Steps (Optional)
1. **Review New Features**: Check `config.json.example` for new configuration options
2. **Enable Health Monitoring**: Configure monitoring thresholds if needed
3. **Set Up Logging**: Enable file logging for production environments
4. **Multi-Server Setup**: Add additional servers if managing multiple instances

#### Configuration Changes
```json
// Old v3.0 format (still supported)
{
  "server": "play.example.com",
  "port": 19132,
  "accounts": ["account@example.com"]
}

// New v3.1 format (recommended)
{
  "servers": [
    {
      "id": "main-server",
      "server": "play.example.com", 
      "port": 19132,
      "accounts": ["account@example.com"]
    }
  ]
}
