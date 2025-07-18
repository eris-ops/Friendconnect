# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-07-17

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

## [2.0.0] - 2025-01-17

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

## [1.0.0] - 2024-12-XX

### Added
- Initial release
- Basic Minecraft Bedrock bot functionality
- Microsoft authentication
- Server connection capabilities
- Configuration system
- Basic logging

[3.0.0]: https://github.com/yourusername/friendconnect-bot/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/yourusername/friendconnect-bot/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/yourusername/friendconnect-bot/releases/tag/v1.0.0