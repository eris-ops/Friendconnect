# FriendConnect Bot v3.1

A comprehensive Node.js Minecraft Bedrock bot that revolutionizes friend management and server interactions through Xbox Live Multiplayer Sessions with enhanced reliability and multi-server support.

## Overview

FriendConnect Bot v3.1 implements the proven jrcarl624/FriendConnect methodology using Xbox Live Multiplayer Sessions. Instead of direct Bedrock protocol connections, the bot creates Xbox Live sessions that appear in players' Friends tabs, allowing console players to join servers without requiring server IPs.

## New in v3.1 - Enhanced Features

- **🏢 Multi-Server Support** - Manage multiple Minecraft servers simultaneously
- **🔄 Advanced Session Recovery** - Automatic session recovery with exponential backoff
- **💚 Health Monitoring** - System-wide health checks with alerting
- **🔐 Enhanced Authentication** - Improved token management with automatic refresh
- **👥 Smart Friend Management** - Intelligent friend request handling with queue management
- **📊 Comprehensive Logging** - Structured logging with file output and rotation
- **⚙️ Configuration Validation** - Automatic validation and error correction
- **🔧 Modular Architecture** - Separated components for better maintainability

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
