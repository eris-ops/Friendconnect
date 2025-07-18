# Contributing to FriendConnect Bot v3.1

Thank you for your interest in contributing to FriendConnect Bot! This document provides comprehensive guidelines for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions. This project welcomes contributions from everyone regardless of experience level, background, or identity.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Include comprehensive information**:
   - Operating system and Node.js version
   - Configuration details (remove sensitive information)
   - Complete error messages and stack traces
   - Steps to reproduce the issue
   - Expected vs actual behavior
   - Health monitoring status (if available)
   - Log files (if applicable)

### Suggesting Features

1. **Check existing issues and discussions** for similar requests
2. **Use the feature request template**
3. **Describe thoroughly**:
   - Use case and motivation
   - Proposed solution with examples
   - Alternative approaches considered
   - Implementation complexity estimation
   - Impact on existing functionality
   - Backward compatibility considerations

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following coding standards
4. **Test thoroughly** including edge cases
5. **Update documentation** as needed
6. **Commit with clear messages** using conventional commits
7. **Push to your fork**
8. **Create a pull request** with detailed description

#### Pull Request Guidelines

- **Follow existing code style** and patterns
- **Add tests** for new functionality
- **Update documentation** for user-facing changes
- **Keep PRs focused** on a single feature or fix
- **Reference related issues** using keywords (fixes #123)
- **Include breaking change notes** in PR description
- **Test in demo mode** before submitting
- **Verify health monitoring** works with changes

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Git version control
- Code editor with ES modules support

### Local Development Environment

1. **Clone your fork**:
```bash
git clone https://github.com/your-username/friendconnect-bot.git
cd friendconnect-bot
