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
        this.config = {
            doorbellOpenEndpoint: "/command/unlock",
            snapshotEndpoint: "/video/snapshot.jpg",
        };
        // Create axios instance with SSL bypass for self-signed certificates
        this.httpsAgent = new https_1.default.Agent({
            rejectUnauthorized: false,
            keepAlive: true,
        });
        this.client = axios_1.default.create({
            baseURL: `http${gatewayPort === 443 ? "s" : ""}://${gatewayIp}:${gatewayPort}`,
            httpsAgent: this.httpsAgent,
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
        this.sessionId = null;
        delete this.client.defaults.headers.common["Cookie"];
        try {
            const password = encodeURIComponent(this.password).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
            const origin = new URL(`http${this.gatewayPort === 443 ? "s" : ""}://${this.gatewayIp}:${this.gatewayPort}`).origin;
            const response = await this.client.post("/cgi-bin/checklogin.cgi", JSON.stringify({ username: this.username, password }), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": origin,
                    "Referer": `${origin}/`,
                },
            });
            if (response.status !== 200 || !["1", "2"].includes(String(response.data).trim())) {
                this.log(`Gateway login rejected (HTTP ${response.status})`);
                return false;
            }
            const cookies = (response.headers["set-cookie"] || [])
                .map((cookie) => cookie.split(";", 1)[0])
                .filter((cookie) => /^[^=;\s]+=[^;]+$/.test(cookie));
            if (cookies.length === 0) {
                this.log("Gateway login did not return a session cookie");
                return false;
            }
            this.client.defaults.headers.common["Cookie"] = cookies.join("; ");
            this.log(`Gateway login returned code ${String(response.data).trim()} and ${cookies.length} cookie(s)`);
            this.sessionId = "authenticated";
            return true;
        }
        catch (error) {
            this.logRequestFailure("Gateway login", error);
            return false;
        }
    }
    logRequestFailure(operation, error) {
        if (axios_1.default.isAxiosError(error)) {
            this.log(`${operation} failed (${error.response ? `HTTP ${error.response.status}` : error.code || "network error"})`);
        }
        else {
            this.log(`${operation} failed (unexpected error)`);
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
        if (!this.sessionId) {
            return false;
        }
        try {
            const origin = new URL(`http${this.gatewayPort === 443 ? "s" : ""}://${this.gatewayIp}:${this.gatewayPort}`).origin;
            const response = await this.client.get("/cgi-bin/getinfo.cgi?type=getversion", {
                responseType: "text",
                headers: {
                    "Content-Type": "text/html",
                    "Referer": `${origin}/config.html?v=0.1`,
                },
            });
            const body = typeof response.data === "string" ? response.data.trim() : "";
            const parts = body.split(";");
            if (response.status === 200 && parts.length >= 3 && parts.slice(0, 3).every((part) => part.trim())) {
                return true;
            }
            const reason = body === "-6" ? "session rejected (-6)" :
                !body ? "empty response" : `unexpected version format (${parts.length} fields)`;
            this.log(`Gateway health check: ${reason} (HTTP ${response.status})`);
            return false;
        }
        catch (error) {
            this.logRequestFailure("Gateway health check", error);
            return false;
        }
    }
    /**
     * Close client and clean up resources.
     */
    close() {
        this.httpsAgent.destroy();
    }
}
exports.WelcomeClient = WelcomeClient;
//# sourceMappingURL=welcomeClient.js.map