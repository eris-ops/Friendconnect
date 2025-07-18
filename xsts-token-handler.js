/**
 * Custom XSTS Token Handler to work around Xbox Live JSON parsing issues
 * Handles the "Unexpected end of JSON input" error by implementing custom request handling
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class XSTSTokenHandler {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 2000;
    }

    /**
     * Custom XSTS token request with enhanced error handling
     */
    async getXSTSTokenCustom(userToken, deviceToken, titleToken, relyingParty) {
        const xstsUrl = 'https://xsts.auth.xboxlive.com/xsts/authorize';
        
        const requestBody = {
            Properties: {
                SandboxId: 'RETAIL',
                UserTokens: [userToken]
            },
            RelyingParty: relyingParty,
            TokenType: 'JWT'
        };

        // Add device and title tokens if available
        if (deviceToken) {
            requestBody.Properties.DeviceToken = deviceToken;
            this.logger.debug(`📱 Added device token to XSTS request`);
        }
        if (titleToken) {
            requestBody.Properties.TitleToken = titleToken;
            this.logger.debug(`🎮 Added title token to XSTS request`);
        }

        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.debug(`🔄 XSTS token request attempt ${attempt}/${this.maxRetries}`);
                
                const response = await this.makeXSTSRequest(xstsUrl, requestBody);
                
                // Parse response with enhanced error handling
                const tokenData = this.parseXSTSResponse(response);
                
                if (tokenData && tokenData.Token && tokenData.DisplayClaims) {
                    this.logger.debug(`✅ XSTS token obtained successfully`);
                    return tokenData;
                }
                
                throw new Error('Invalid XSTS token response structure');
                
            } catch (error) {
                lastError = error;
                
                if (error.message.includes('Unexpected end of JSON input')) {
                    this.logger.info(`⚠️ XSTS JSON parse error on attempt ${attempt}/${this.maxRetries}`);
                    
                    if (attempt < this.maxRetries) {
                        const delay = this.retryDelay * Math.pow(2, attempt - 1);
                        this.logger.info(`⏳ Retrying XSTS request in ${delay}ms...`);
                        await this.delay(delay);
                        continue;
                    }
                } else if (error.message.includes('2148916233')) {
                    // Xbox Live account doesn't exist or doesn't have Xbox Live access
                    throw new Error('Xbox Live account not found or lacks Xbox Live access');
                } else if (error.message.includes('2148916238')) {
                    // Child account restrictions
                    throw new Error('Child account restrictions prevent Xbox Live access');
                } else if (attempt < this.maxRetries) {
                    this.logger.info(`⚠️ XSTS request error on attempt ${attempt}/${this.maxRetries}: ${error.message}`);
                    const delay = this.retryDelay * attempt;
                    await this.delay(delay);
                    continue;
                }
                
                break;
            }
        }
        
        throw lastError;
    }

    /**
     * Make HTTP request with custom timeout and error handling
     */
    async makeXSTSRequest(url, requestBody) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const postData = JSON.stringify(requestBody);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Accept': 'application/json',
                    'User-Agent': 'XboxServicesAPI/2021.11.20201204.000 c',
                    'x-xbl-contract-version': '1'
                },
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
                
                res.on('error', (error) => {
                    reject(error);
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('XSTS request timeout'));
            });
            
            req.on('error', (error) => {
                this.logger.error(`❌ XSTS request failed: ${error.message}`);
                reject(error);
            });
            
            req.write(postData);
            req.end();
        });
    }

    /**
     * Parse XSTS response with enhanced error handling
     */
    parseXSTSResponse(responseData) {
        try {
            // First, try to clean up the response data
            let cleanData = responseData.trim();
            
            // Remove any potential BOM or invisible characters
            cleanData = cleanData.replace(/^\uFEFF/, '');
            
            // Check if response is truncated
            if (!cleanData.endsWith('}') && !cleanData.endsWith(']')) {
                this.logger.info(`⚠️ Response appears truncated: ${cleanData.length} chars`);
                
                // Try to find the last complete JSON object
                let lastBrace = cleanData.lastIndexOf('}');
                if (lastBrace > 0) {
                    cleanData = cleanData.substring(0, lastBrace + 1);
                    this.logger.debug(`🔧 Truncated response to: ${cleanData.length} chars`);
                }
            }
            
            // Try to parse JSON
            const parsedData = JSON.parse(cleanData);
            
            // Validate required fields
            if (!parsedData.Token) {
                throw new Error('Missing Token in XSTS response');
            }
            
            if (!parsedData.DisplayClaims) {
                throw new Error('Missing DisplayClaims in XSTS response');
            }
            
            return parsedData;
            
        } catch (error) {
            this.logger.error(`❌ XSTS response parsing failed: ${error.message}`);
            this.logger.debug(`🔍 Response data (first 500 chars): ${responseData.substring(0, 500)}`);
            
            // Try alternative parsing methods
            return this.attemptAlternativeParsing(responseData);
        }
    }

    /**
     * Attempt alternative parsing methods for malformed responses
     */
    attemptAlternativeParsing(responseData) {
        try {
            // Method 1: Try to extract token with regex
            const tokenMatch = responseData.match(/"Token":"([^"]+)"/);
            const displayClaimsMatch = responseData.match(/"DisplayClaims":(\{[^}]*\})/);
            
            if (tokenMatch && displayClaimsMatch) {
                this.logger.info(`🔧 Using regex extraction for XSTS token`);
                
                const token = tokenMatch[1];
                let displayClaims;
                
                try {
                    displayClaims = JSON.parse(displayClaimsMatch[1]);
                } catch (claimsError) {
                    // Create minimal display claims structure
                    displayClaims = {
                        xui: [{ uhs: "temp_hash" }]
                    };
                }
                
                return {
                    Token: token,
                    DisplayClaims: displayClaims,
                    IssueInstant: new Date().toISOString(),
                    NotAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };
            }
            
            // Method 2: Try to fix common JSON issues
            let fixedData = responseData
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')   // Remove trailing commas in arrays
                .replace(/\\"/g, '"')     // Fix escaped quotes
                .replace(/"\s*:\s*"/g, '":"'); // Fix spacing in key-value pairs
            
            return JSON.parse(fixedData);
            
        } catch (alternativeError) {
            this.logger.error(`❌ All parsing methods failed: ${alternativeError.message}`);
            throw new Error(`Unable to parse XSTS response: ${alternativeError.message}`);
        }
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate XSTS token structure
     */
    validateXSTSToken(tokenData) {
        if (!tokenData || typeof tokenData !== 'object') {
            return false;
        }

        // Check required fields
        if (!tokenData.Token || typeof tokenData.Token !== 'string') {
            return false;
        }

        if (!tokenData.DisplayClaims || typeof tokenData.DisplayClaims !== 'object') {
            return false;
        }

        // Check token format (should be JWT-like)
        if (!tokenData.Token.includes('.') || tokenData.Token.length < 100) {
            return false;
        }

        return true;
    }

    /**
     * Extract user info from XSTS token
     */
    extractUserInfo(tokenData) {
        try {
            const displayClaims = tokenData.DisplayClaims;
            
            if (displayClaims.xui && displayClaims.xui.length > 0) {
                const userInfo = displayClaims.xui[0];
                return {
                    userXUID: userInfo.xid || userInfo.uhs,
                    userHash: userInfo.uhs || userInfo.xid,
                    gamertag: userInfo.gtg || null
                };
            }
            
            return null;
        } catch (error) {
            this.logger.error(`❌ Failed to extract user info: ${error.message}`);
            return null;
        }
    }
}

module.exports = { XSTSTokenHandler };