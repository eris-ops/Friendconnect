const { EventEmitter } = require('events');

/**
 * Enhanced Health Monitor for system-wide health checking and alerting
 */
class HealthMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            checkInterval: config.checkInterval || 60000, // 1 minute
            healthThreshold: config.healthThreshold || 0.8, // 80% healthy
            criticalThreshold: config.criticalThreshold || 0.3, // 30% healthy = critical
            maxFailures: config.maxFailures || 3,
            restartOnCriticalFailure: config.restartOnCriticalFailure || false,
            enableHealthEndpoint: config.enableHealthEndpoint || false,
            ...config
        };
        
        this.serverHealthCheckers = new Map();
        this.healthHistory = new Map();
        this.failures = new Map();
        this.isRunning = false;
        this.healthCheckInterval = null;
        
        this.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    }

    startMonitoring(serverIds, healthCheckFunction) {
        if (this.isRunning) {
            this.stop();
        }

        console.log(`💚 Health Monitor: Starting monitoring for ${serverIds.length} server(s)`);
        
        // Register health check function for each server
        serverIds.forEach(serverId => {
            this.serverHealthCheckers.set(serverId, healthCheckFunction);
            this.healthHistory.set(serverId, []);
            this.failures.set(serverId, 0);
        });

        this.isRunning = true;
        this.scheduleHealthChecks();
    }

    scheduleHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthChecks();
            } catch (error) {
                console.error('💥 Health Monitor: Error during health checks:', error.message);
            }
        }, this.config.checkInterval);

        console.log(`💚 Health Monitor: Scheduled checks every ${this.config.checkInterval}ms`);
    }

    async performHealthChecks() {
        if (!this.isRunning) {
            return;
        }

        const serverIds = Array.from(this.serverHealthCheckers.keys());
        const results = [];

        for (const serverId of serverIds) {
            try {
                const healthChecker = this.serverHealthCheckers.get(serverId);
                const healthStatus = await healthChecker(serverId);
                
                const result = {
                    serverId,
                    healthy: healthStatus.healthy,
                    reason: healthStatus.reason,
                    timestamp: Date.now(),
                    details: healthStatus
                };

                results.push(result);
                this.updateHealthHistory(serverId, result);
                this.processHealthResult(serverId, result);

            } catch (error) {
                const result = {
                    serverId,
                    healthy: false,
                    reason: `Health check error: ${error.message}`,
                    timestamp: Date.now(),
                    error: error.message
                };

                results.push(result);
                this.updateHealthHistory(serverId, result);
                this.processHealthResult(serverId, result);
            }
        }

        // Emit overall health check results
        this.emit('healthCheck', results);
        
        // Check for system-wide critical issues
        this.checkSystemHealth(results);
    }

    updateHealthHistory(serverId, result) {
        const history = this.healthHistory.get(serverId) || [];
        history.push(result);
        
        // Keep only last 10 health checks
        if (history.length > 10) {
            history.shift();
        }
        
        this.healthHistory.set(serverId, history);
    }

    processHealthResult(serverId, result) {
        if (result.healthy) {
            // Reset failure count on successful health check
            this.failures.set(serverId, 0);
        } else {
            // Increment failure count
            const currentFailures = this.failures.get(serverId) || 0;
            const newFailures = currentFailures + 1;
            this.failures.set(serverId, newFailures);

            console.warn(`⚠️ Health Monitor: Server ${serverId} unhealthy (${newFailures}/${this.config.maxFailures}): ${result.reason}`);

            // Emit server down event if max failures reached
            if (newFailures >= this.config.maxFailures) {
                console.error(`🚨 Health Monitor: Server ${serverId} marked as DOWN after ${newFailures} failures`);
                this.emit('serverDown', serverId, result);
            }
        }
    }

    checkSystemHealth(results) {
        const totalServers = results.length;
        const healthyServers = results.filter(r => r.healthy).length;
        const healthPercentage = totalServers > 0 ? (healthyServers / totalServers) : 1;

        // Check for critical system failure
        if (healthPercentage <= this.config.criticalThreshold) {
            const criticalError = new Error(
                `Critical system failure: Only ${healthyServers}/${totalServers} servers healthy (${(healthPercentage * 100).toFixed(1)}%)`
            );
            
            console.error(`🚨 Health Monitor: ${criticalError.message}`);
            this.emit('criticalFailure', criticalError, results);
        }
        // Check for degraded performance
        else if (healthPercentage <= this.config.healthThreshold) {
            console.warn(`💛 Health Monitor: System degraded: ${healthyServers}/${totalServers} servers healthy (${(healthPercentage * 100).toFixed(1)}%)`);
            this.emit('systemDegraded', { healthPercentage, results });
        }
    }

    getSystemHealthSummary() {
        const summary = {
            timestamp: Date.now(),
            servers: {},
            overall: {
                totalServers: 0,
                healthyServers: 0,
                unhealthyServers: 0,
                healthPercentage: 0
            }
        };

        let totalServers = 0;
        let healthyServers = 0;

        for (const [serverId, history] of this.healthHistory) {
            const latestCheck = history[history.length - 1];
            const failures = this.failures.get(serverId) || 0;
            
            summary.servers[serverId] = {
                healthy: latestCheck?.healthy || false,
                reason: latestCheck?.reason || 'No health data',
                failures,
                lastCheck: latestCheck?.timestamp,
                healthHistory: history.slice(-5) // Last 5 checks
            };

            totalServers++;
            if (latestCheck?.healthy) {
                healthyServers++;
            }
        }

        summary.overall = {
            totalServers,
            healthyServers,
            unhealthyServers: totalServers - healthyServers,
            healthPercentage: totalServers > 0 ? (healthyServers / totalServers) * 100 : 100
        };

        return summary;
    }

    getServerHealth(serverId) {
        const history = this.healthHistory.get(serverId) || [];
        const failures = this.failures.get(serverId) || 0;
        const latestCheck = history[history.length - 1];

        return {
            serverId,
            healthy: latestCheck?.healthy || false,
            reason: latestCheck?.reason || 'No health data',
            failures,
            maxFailures: this.config.maxFailures,
            lastCheck: latestCheck?.timestamp,
            healthHistory: history
        };
    }

    // Force a health check for a specific server
    async checkServer(serverId) {
        const healthChecker = this.serverHealthCheckers.get(serverId);
        if (!healthChecker) {
            throw new Error(`No health checker registered for server: ${serverId}`);
        }

        try {
            const healthStatus = await healthChecker(serverId);
            const result = {
                serverId,
                healthy: healthStatus.healthy,
                reason: healthStatus.reason,
                timestamp: Date.now(),
                details: healthStatus,
                forced: true
            };

            this.updateHealthHistory(serverId, result);
            this.processHealthResult(serverId, result);

            return result;

        } catch (error) {
            const result = {
                serverId,
                healthy: false,
                reason: `Health check error: ${error.message}`,
                timestamp: Date.now(),
                error: error.message,
                forced: true
            };

            this.updateHealthHistory(serverId, result);
            this.processHealthResult(serverId, result);

            return result;
        }
    }

    // Reset failure count for a server (useful after manual recovery)
    resetServerFailures(serverId) {
        this.failures.set(serverId, 0);
        console.log(`🔄 Health Monitor: Reset failure count for server ${serverId}`);
    }

    stop() {
        console.log('🛑 Health Monitor: Stopping...');
        
        this.isRunning = false;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        this.serverHealthCheckers.clear();
        this.healthHistory.clear();
        this.failures.clear();
        
        console.log('✅ Health Monitor: Stopped');
    }
}

module.exports = { HealthMonitor };
