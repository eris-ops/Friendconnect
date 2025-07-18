const fetch = require('node-fetch');
const { EventEmitter } = require('events');

/**
 * Enhanced Friend Manager with smart request handling and monitoring
 */
class FriendManager extends EventEmitter {
    constructor(options) {
        super();
        
        this.accounts = options.accounts || [];
        this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
        this.requestDelay = options.requestDelay || 1000;
        this.autoAcceptFriends = options.autoAcceptFriends !== false;
        this.serverId = options.serverId;
        this.logger = options.logger;
        
        this.friendships = new Map(); // Track established friendships
        this.pendingRequests = new Set(); // Track pending friend requests
        this.requestQueue = []; // Queue for rate-limited requests
        this.isProcessing = false;
        
        this.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    }

    async setupCrossFriendships() {
        this.logger.info(`👥 [${this.serverId}] Setting up cross-friendships between ${this.accounts.length} accounts...`);
        
        const friendshipTasks = [];
        
        // Create friendship tasks for all account pairs
        for (let i = 0; i < this.accounts.length; i++) {
            for (let j = 0; j < this.accounts.length; j++) {
                if (i !== j) {
                    const fromAccount = this.accounts[i];
                    const toAccount = this.accounts[j];
                    
                    friendshipTasks.push({
                        from: fromAccount,
                        to: toAccount,
                        priority: 1 // All cross-friendships have same priority
                    });
                }
            }
        }
        
        // Add tasks to queue and start processing
        this.requestQueue.push(...friendshipTasks);
        await this.processRequestQueue();
        
        this.logger.success(`✅ [${this.serverId}] Cross-friendship setup completed`);
    }

    async processRequestQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        this.logger.debug(`🔄 [${this.serverId}] Processing ${this.requestQueue.length} friendship requests...`);

        try {
            // Process requests in batches to respect rate limits
            while (this.requestQueue.length > 0) {
                const batch = this.requestQueue.splice(0, this.maxConcurrentRequests);
                const batchPromises = batch.map(task => this.processFriendshipTask(task));
                
                await Promise.allSettled(batchPromises);
                
                // Delay between batches to avoid rate limiting
                if (this.requestQueue.length > 0) {
                    await this.delay(this.requestDelay);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async processFriendshipTask(task) {
        try {
            const friendshipKey = `${task.from.xuid}-${task.to.xuid}`;
            
            // Skip if friendship already established
            if (this.friendships.has(friendshipKey)) {
                return;
            }

            // Check if already friends
            const areAlreadyFriends = await this.checkFriendshipStatus(task.from, task.to.xuid);
            if (areAlreadyFriends) {
                this.friendships.set(friendshipKey, {
                    from: task.from.email,
                    to: task.to.email,
                    established: true,
                    timestamp: Date.now()
                });
                return;
            }

            // Send friend request
            await this.sendFriendRequest(task.from, task.to.xuid);
            
            // Record friendship
            this.friendships.set(friendshipKey, {
                from: task.from.email,
                to: task.to.email,
                established: true,
                timestamp: Date.now()
            });

            this.emit('friendshipEstablished', { 
                from: task.from.email, 
                to: task.to.email,
                fromXuid: task.from.xuid,
                toXuid: task.to.xuid
            });

            this.logger.debug(`👥 [${this.serverId}] Friendship: ${task.from.email} → ${task.to.email}`);

        } catch (error) {
            this.logger.warning(`⚠️ [${this.serverId}] Friendship failed: ${task.from.email} → ${task.to.email}: ${error.message}`);
            this.emit('error', error);
        }
    }

    async checkFriendshipStatus(fromAccount, toXuid) {
        try {
            const response = await fetch(`https://social.xboxlive.com/users/me/people/xuid(${toXuid})`, {
                method: 'GET',
                headers: {
                    'Authorization': fromAccount.authHeader,
                    'x-xbl-contract-version': '1'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                return data.isFollowedByCaller || data.isFollowingCaller;
            }
            
            return false;

        } catch (error) {
            // If we can't check, assume not friends
            return false;
        }
    }

    async sendFriendRequest(fromAccount, toXuid) {
        const response = await fetch(`https://social.xboxlive.com/users/me/people/xuid(${toXuid})`, {
            method: 'PUT',
            headers: {
                'Authorization': fromAccount.authHeader,
                'Content-Type': 'application/json',
                'x-xbl-contract-version': '1'
            }
        });

        if (!response.ok) {
            throw new Error(`Friend request failed: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    async refreshFriendships() {
        this.logger.info(`🔄 [${this.serverId}] Refreshing friendships...`);
        
        // Clear existing friendship cache
        this.friendships.clear();
        
        // Re-setup cross-friendships
        await this.setupCrossFriendships();
        
        this.logger.success(`✅ [${this.serverId}] Friendships refreshed`);
    }

    async monitorIncomingFriendRequests() {
        if (!this.autoAcceptFriends) {
            return;
        }

        this.logger.info(`📨 [${this.serverId}] Starting friend request monitoring...`);

        for (const account of this.accounts) {
            try {
                await this.checkIncomingRequests(account);
            } catch (error) {
                this.logger.warning(`⚠️ [${this.serverId}] Failed to check requests for ${account.email}:`, error.message);
            }
        }
    }

    async checkIncomingRequests(account) {
        try {
            const response = await fetch('https://social.xboxlive.com/users/me/people', {
                method: 'GET',
                headers: {
                    'Authorization': account.authHeader,
                    'x-xbl-contract-version': '1'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get people list: ${response.status}`);
            }

            const data = await response.json();
            const pendingRequests = data.people?.filter(person => 
                person.isFollowingCaller && !person.isFollowedByCaller
            ) || [];

            for (const request of pendingRequests) {
                await this.acceptFriendRequest(account, request.xuid);
                this.emit('friendRequestAccepted', {
                    account: account.email,
                    from: request.gamertag || request.xuid
                });
            }

        } catch (error) {
            throw new Error(`Error checking incoming requests: ${error.message}`);
        }
    }

    async acceptFriendRequest(account, fromXuid) {
        try {
            const response = await fetch(`https://social.xboxlive.com/users/me/people/xuid(${fromXuid})`, {
                method: 'PUT',
                headers: {
                    'Authorization': account.authHeader,
                    'Content-Type': 'application/json',
                    'x-xbl-contract-version': '1'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to accept friend request: ${response.status}`);
            }

            this.logger.info(`✅ [${this.serverId}] Friend request accepted: ${account.email} ← ${fromXuid}`);

        } catch (error) {
            throw new Error(`Error accepting friend request: ${error.message}`);
        }
    }

    getFriendshipStats() {
        const total = this.friendships.size;
        const established = Array.from(this.friendships.values()).filter(f => f.established).length;
        
        return {
            total,
            established,
            pending: total - established,
            accounts: this.accounts.length
        };
    }

    async getHealthStatus() {
        try {
            const stats = this.getFriendshipStats();
            const expectedFriendships = this.accounts.length * (this.accounts.length - 1);
            const healthPercentage = expectedFriendships > 0 ? (stats.established / expectedFriendships) * 100 : 100;

            if (healthPercentage < 50) {
                return { 
                    healthy: false, 
                    reason: `Only ${healthPercentage.toFixed(1)}% of friendships established`,
                    stats 
                };
            }

            return { 
                healthy: true, 
                healthPercentage: healthPercentage.toFixed(1),
                stats 
            };

        } catch (error) {
            return { healthy: false, reason: `Health check error: ${error.message}` };
        }
    }

    async stop() {
        this.logger.info(`🛑 [${this.serverId}] Stopping friend manager...`);
        
        // Clear queues and caches
        this.requestQueue = [];
        this.pendingRequests.clear();
        this.isProcessing = false;
        
        this.logger.success(`✅ [${this.serverId}] Friend manager stopped`);
    }
}

module.exports = { FriendManager };
