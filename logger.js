const fs = require('fs');
const path = require('path');

/**
 * Enhanced Logger with multiple levels, file output, and structured logging
 */
class Logger {
    constructor(options = {}) {
        this.options = {
            level: options.level || 'info',
            enableFileLogging: options.enableFileLogging || false,
            logDirectory: options.logDirectory || './logs',
            maxLogFiles: options.maxLogFiles || 10,
            maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
            enableTimestamp: options.enableTimestamp !== false,
            enableColors: options.enableColors !== false,
            ...options
        };
        
        this.levels = {
            error: 0,
            warning: 1,
            success: 2,
            info: 3,
            session: 4,
            debug: 5
        };
        
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        };
        
        this.prefixes = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: '📋',
            session: '🎮',
            debug: '🔍',
            startup: '🚀'
        };
        
        this.currentLogLevel = this.levels[this.options.level] || this.levels.info;
        
        // Initialize file logging if enabled
        if (this.options.enableFileLogging) {
            this.initializeFileLogging();
        }
    }

    initializeFileLogging() {
        try {
            if (!fs.existsSync(this.options.logDirectory)) {
                fs.mkdirSync(this.options.logDirectory, { recursive: true });
            }
            
            this.currentLogFile = path.join(
                this.options.logDirectory,
                `friendconnect-${new Date().toISOString().split('T')[0]}.log`
            );
            
            console.log(`📁 Logger: File logging enabled - ${this.currentLogFile}`);
            
        } catch (error) {
            console.error('❌ Logger: Failed to initialize file logging:', error.message);
            this.options.enableFileLogging = false;
        }
    }

    log(level, message, ...args) {
        const levelNum = this.levels[level];
        if (levelNum === undefined || levelNum > this.currentLogLevel) {
            return;
        }
        
        const timestamp = this.options.enableTimestamp ? new Date().toISOString() : '';
        const prefix = this.prefixes[level] || '📋';
        
        // Format console output
        const consoleMessage = this.formatConsoleMessage(timestamp, prefix, message, level);
        console.log(consoleMessage, ...args);
        
        // Write to file if enabled
        if (this.options.enableFileLogging) {
            this.writeToFile(timestamp, level, message, args);
        }
    }

    formatConsoleMessage(timestamp, prefix, message, level) {
        let formatted = '';
        
        if (this.options.enableColors) {
            const color = this.getLevelColor(level);
            formatted = `${color}`;
        }
        
        if (timestamp) {
            formatted += `[${timestamp}] `;
        }
        
        formatted += `${prefix} ${message}`;
        
        if (this.options.enableColors) {
            formatted += this.colors.reset;
        }
        
        return formatted;
    }

    getLevelColor(level) {
        const colorMap = {
            error: this.colors.red,
            warning: this.colors.yellow,
            success: this.colors.green,
            info: this.colors.cyan,
            session: this.colors.magenta,
            debug: this.colors.blue,
            startup: this.colors.bright + this.colors.green
        };
        
        return colorMap[level] || this.colors.white;
    }

    writeToFile(timestamp, level, message, args) {
        try {
            const logEntry = {
                timestamp,
                level: level.toUpperCase(),
                message,
                args: args.length > 0 ? args : undefined,
                pid: process.pid
            };
            
            const logLine = JSON.stringify(logEntry) + '\n';
            
            fs.appendFileSync(this.currentLogFile, logLine);
            
            // Check file size and rotate if needed
            this.checkLogRotation();
            
        } catch (error) {
            console.error('❌ Logger: Failed to write to log file:', error.message);
        }
    }

    checkLogRotation() {
        try {
            const stats = fs.statSync(this.currentLogFile);
            
            if (stats.size > this.options.maxLogSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
                
                fs.renameSync(this.currentLogFile, rotatedFile);
                console.log(`🔄 Logger: Log rotated to ${rotatedFile}`);
                
                // Clean up old log files
                this.cleanupOldLogs();
            }
            
        } catch (error) {
            // Ignore rotation errors
        }
    }

    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.options.logDirectory)
                .filter(file => file.startsWith('friendconnect-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.options.logDirectory, file),
                    time: fs.statSync(path.join(this.options.logDirectory, file)).mtime
                }))
                .sort((a, b) => b.time - a.time);
            
            // Remove files beyond the maximum count
            if (files.length > this.options.maxLogFiles) {
                files.slice(this.options.maxLogFiles).forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        console.log(`🗑️ Logger: Removed old log file: ${file.name}`);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                });
            }
            
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    // Convenience methods for different log levels
    error(message, ...args) {
        this.log('error', message, ...args);
    }

    warning(message, ...args) {
        this.log('warning', message, ...args);
    }

    success(message, ...args) {
        this.log('success', message, ...args);
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    session(message, ...args) {
        this.log('session', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }

    startup(message, ...args) {
        this.log('startup', message, ...args);
    }

    // Set log level at runtime
    setLevel(level) {
        if (level in this.levels) {
            this.currentLogLevel = this.levels[level];
            this.info(`Logger level set to: ${level}`);
        } else {
            this.warning(`Invalid log level: ${level}. Available levels: ${Object.keys(this.levels).join(', ')}`);
        }
    }

    // Get current log level
    getLevel() {
        return Object.keys(this.levels).find(level => this.levels[level] === this.currentLogLevel);
    }

    // Create a structured log entry for important events
    logStructured(event, data = {}) {
        const structuredEntry = {
            event,
            timestamp: new Date().toISOString(),
            data,
            system: 'FriendConnect',
            version: '3.1.0'
        };
        
        this.info(`📊 ${event}:`, structuredEntry);
        
        // Also write structured data to file if enabled
        if (this.options.enableFileLogging) {
            try {
                const structuredLine = JSON.stringify({ type: 'structured', ...structuredEntry }) + '\n';
                fs.appendFileSync(this.currentLogFile, structuredLine);
            } catch (error) {
                // Ignore file write errors
            }
        }
    }
}

module.exports = { Logger };
