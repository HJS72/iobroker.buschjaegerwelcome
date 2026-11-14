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
     * Authenticate with the gateway and store session ID.
     * @returns true if authentication successful
     */
    async login() {
        try {
            // TODO: Adapt payload and response handling to actual gateway API.
            // Typical patterns: form-data with username/password or JSON body.
            const response = await this.client.post(this.config.loginEndpoint, {
                username: this.username,
                password: this.password,
            });
            // TODO: Extract session ID from response headers or body.
            // Common patterns: response.headers["set-cookie"], response.data.sessionId, etc.
            const setCookie = response.headers["set-cookie"];
            if (setCookie) {
                const sessionMatch = setCookie[0]?.match(/SESSIONID=([^;]+)/);
                if (sessionMatch) {
                    this.sessionId = sessionMatch[1];
                    // Add session cookie to all future requests
                    this.client.defaults.headers.common["Cookie"] = `SESSIONID=${this.sessionId}`;
                    return true;
                }
            }
            // Alternative: check if response.data contains session info
            if (response.data?.sessionId) {
                this.sessionId = response.data.sessionId;
                this.client.defaults.headers.common["Authorization"] = `Bearer ${this.sessionId}`;
                return true;
            }
            return false;
        }
        catch (error) {
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