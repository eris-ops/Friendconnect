# Contributing to FriendConnect Bot

Thank you for your interest in contributing to FriendConnect Bot! This document provides guidelines for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions. This project welcomes contributions from everyone.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Operating system and Node.js version
   - Configuration details (remove sensitive info)
   - Steps to reproduce
   - Expected vs actual behavior
   - Console logs/error messages

### Suggesting Features

1. Check existing issues and discussions
2. Use the feature request template
3. Describe:
   - Use case and motivation
   - Proposed solution
   - Alternative approaches considered
   - Implementation complexity

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Create a pull request

#### Pull Request Guidelines

- Follow existing code style
- Add tests for new functionality
- Update documentation as needed
- Keep PRs focused on a single feature/fix
- Reference related issues

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Git

### Local Development

1. Clone your fork:
```bash
git clone https://github.com/your-username/friendconnect-bot.git
cd friendconnect-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create configuration:
```bash
cp config.json.example config.json
# Edit config.json with your settings
```

4. Run in demo mode for testing:
```bash
# Set demoMode: true in config.json
npm start
```

### Testing

- Use demo mode for testing without authentication
- Test with multiple account configurations
- Verify authentication flows work correctly
- Test error handling scenarios

### Code Style

- Use ES modules (import/export)
- Follow existing naming conventions
- Add JSDoc comments for functions
- Keep functions focused and readable
- Use meaningful variable names

## Project Structure

```
friendconnect-bot/
├── index-friendconnect.js     # Main entry point
├── friendconnect-session.js   # Xbox Live session management
├── config.json.example        # Configuration template
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
├── SETUP.md                  # Setup instructions
├── CONTRIBUTING.md           # This file
├── LICENSE                   # MIT License
├── .gitignore               # Git ignore rules
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI
└── auth/                    # Authentication cache (gitignored)
```

## Key Components

### Authentication System
- Microsoft OAuth device code flow
- Token caching and refresh
- Error handling and retry logic

### Xbox Live Sessions
- Session creation and management
- Cross-friendship establishment
- Real-time monitoring

### Configuration
- JSON-based configuration
- Environment variable support
- Validation and error handling

## Common Development Tasks

### Adding New Features

1. Plan the feature architecture
2. Update configuration schema if needed
3. Implement core functionality
4. Add error handling
5. Update documentation
6. Add tests
7. Test thoroughly

### Debugging Authentication

1. Enable debug mode in config
2. Check authentication token validity
3. Verify account requirements
4. Test with demo mode first
5. Review Xbox Live API responses

### Testing Changes

1. Test in demo mode first
2. Test authentication flows
3. Test error scenarios
4. Test with different configurations
5. Verify logging and monitoring

## Documentation

- Update README.md for user-facing changes
- Update SETUP.md for installation changes
- Add JSDoc comments for new functions
- Update configuration examples
- Document breaking changes

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Test thoroughly
4. Create release PR
5. Tag release after merge
6. Update deployment documentation

## Getting Help

- Check existing documentation
- Review open issues
- Ask questions in discussions
- Join community chat if available

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- README acknowledgments section

Thank you for contributing to FriendConnect Bot!