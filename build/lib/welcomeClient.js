"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
/**
 * Welcome API Client for local HTTP/HTTPS communication with Busch-Jaeger Welcome IP Gateway.
 * Handles SSL certificate validation bypass and session management.
 */
class WelcomeClient {
    constructor(gatewayIp, gatewayPort, username, password) {
        this.gatewayIp = gatewayIp;
        this.gatewayPort = gatewayPort;
        this.username = username;
        this.password = password;
        this.sessionId = null;
        this.logger = null;
        // TODO: Verify exact endpoints by Wireshark capture or gateway documentation.
        // These are educated guesses based on typical IP-camera/gateway patterns.
        this.config = {
            loginEndpoint: "/admin/login",
            doorbellOpenEndpoint: "/command/unlock",
            snapshotEndpoint: "/video/snapshot.jpg",
            healthCheckEndpoint: "/admin/status",
        };
        // Create axios instance with SSL bypass for self-signed certificates
        this.client = axios_1.default.create({
            baseURL: `http${gatewayPort === 443 ? "s" : ""}://${gatewayIp}:${gatewayPort}`,
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: false,
            }),
            timeout: 10000,
        });
    }
    /**
     * Set logger function for debug output
     */
    setLogger(logger) {
        this.logger = logger;
    }
    log(msg) {
        if (this.logger) {
            this.logger(msg);
        }
    }
    /**
     * Authenticate with the gateway and store session ID.
     * @returns true if authentication successful
     */
    async login() {
        try {
            this.log(`Attempting login to ${this.gatewayIp}:${this.gatewayPort}...`);
            // Try login with JSON body
            const response = await this.client.post(this.config.loginEndpoint, {
                username: this.username,
                password: this.password,
            });
            this.log(`Login response status: ${response.status}`);
            this.log(`Response headers: ${JSON.stringify(response.headers, null, 2)}`);
            this.log(`Response data: ${JSON.stringify(response.data)}`);
            // Try multiple session extraction methods
            // Method 1: Extract from Set-Cookie header
            const setCookie = response.headers["set-cookie"];
            if (setCookie) {
                const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
                this.log(`Found Set-Cookie: ${cookieStr}`);
                // Try SESSIONID
                let sessionMatch = cookieStr.match(/SESSIONID=([^;]+)/i);
                if (sessionMatch) {
                    this.sessionId = sessionMatch[1];
                    this.log(`Extracted sessionId (SESSIONID): ${this.sessionId}`);
                    this.client.defaults.headers.common["Cookie"] = `SESSIONID=${this.sessionId}`;
                    return true;
                }
                // Try other common session cookie names
                sessionMatch = cookieStr.match(/(SID|SESSION|JSESSIONID|PHPSESSID)=([^;]+)/i);
                if (sessionMatch) {
                    this.sessionId = sessionMatch[2];
                    this.log(`Extracted sessionId (${sessionMatch[1]}): ${this.sessionId}`);
                    this.client.defaults.headers.common["Cookie"] = `${sessionMatch[1]}=${this.sessionId}`;
                    return true;
                }
            }
            // Method 2: Check response body for session info
            if (response.data?.sessionId) {
                this.sessionId = response.data.sessionId;
                this.log(`Found sessionId in response.data: ${this.sessionId}`);
                this.client.defaults.headers.common["Authorization"] = `Bearer ${this.sessionId}`;
                return true;
            }
            // Method 3: Check for auth token
            if (response.data?.token) {
                this.sessionId = response.data.token;
                this.log(`Found token in response.data: ${this.sessionId}`);
                this.client.defaults.headers.common["Authorization"] = `Bearer ${this.sessionId}`;
                return true;
            }
            // Method 4: Success on 200/201 with any response (implicit auth)
            if (response.status === 200 || response.status === 201) {
                this.log("Login succeeded (implicit auth based on 200 response)");
                // Store response data as fallback
                this.sessionId = "authenticated";
                return true;
            }
            this.log("No session identifier found in response");
            return false;
        }
        catch (error) {
            this.log(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
            if (axios_1.default.isAxiosError(error)) {
                this.log(`Response status: ${error.response?.status}`);
                this.log(`Response data: ${JSON.stringify(error.response?.data)}`);
            }
            return false;
        }
    }
    /**
     * Trigger door opener via gateway API.
     * @param doorId ID of the door/opener (default 0 for primary door)
     * @returns true if command sent successfully
     */
    async triggerDoorOpener(doorId = 0) {
        if (!this.sessionId) {
            return false;
        }
        try {
            // TODO: Verify exact payload and endpoint for door opener.
            // May involve: doorId parameter, unlock command, or relay activation.
            await this.client.post(this.config.doorbellOpenEndpoint, {
                door: doorId,
                action: "unlock",
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Retrieve current snapshot from door camera as base64-encoded data URL.
     * @returns Base64 data URL (data:image/jpeg;base64,...) or null on error
     */
    async getSnapshot() {
        if (!this.sessionId) {
            return null;
        }
        try {
            const response = await this.client.get(this.config.snapshotEndpoint, {
                responseType: "arraybuffer",
            });
            const base64 = Buffer.from(response.data).toString("base64");
            return `data:image/jpeg;base64,${base64}`;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Health check: verify gateway is reachable and authenticated.
     * @returns true if gateway responds
     */
    async checkHealth() {
        try {
            const response = await this.client.get(this.config.healthCheckEndpoint);
            // TODO: Adapt health check response validation to actual endpoint.
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Close client and clean up resources.
     */
    close() {
        // Axios doesn't require explicit cleanup, but can add if needed
    }
}
exports.WelcomeClient = WelcomeClient;
//# sourceMappingURL=welcomeClient.js.map