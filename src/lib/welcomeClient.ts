import axios, { AxiosInstance } from "axios";
import https from "https";

/**
 * Interface for API configuration endpoints and payloads.
 * Adjust these values based on actual Busch-Welcome firmware responses
 * (obtain via Wireshark capture or browser DevTools during login/control).
 */
interface ApiConfig {
    loginEndpoint: string;
    doorbellOpenEndpoint: string;
    snapshotEndpoint: string;
    healthCheckEndpoint: string;
}

/**
 * Welcome API Client for local HTTP/HTTPS communication with Busch-Jaeger Welcome IP Gateway.
 * Handles SSL certificate validation bypass and session management.
 */
export class WelcomeClient {
    private client: AxiosInstance;
    private sessionId: string | null = null;
    private config: ApiConfig;

    constructor(
        private gatewayIp: string,
        private gatewayPort: number,
        private username: string,
        private password: string,
    ) {
        // TODO: Verify exact endpoints by Wireshark capture or gateway documentation.
        // These are educated guesses based on typical IP-camera/gateway patterns.
        this.config = {
            loginEndpoint: "/admin/login",
            doorbellOpenEndpoint: "/command/unlock",
            snapshotEndpoint: "/video/snapshot.jpg",
            healthCheckEndpoint: "/admin/status",
        };

        // Create axios instance with SSL bypass for self-signed certificates
        this.client = axios.create({
            baseURL: `http${gatewayPort === 443 ? "s" : ""}://${gatewayIp}:${gatewayPort}`,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
            timeout: 10000,
        });
    }

    /**
     * Authenticate with the gateway and store session ID.
     * @returns true if authentication successful
     */
    async login(): Promise<boolean> {
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
        } catch (error) {
            return false;
        }
    }

    /**
     * Trigger door opener via gateway API.
     * @param doorId ID of the door/opener (default 0 for primary door)
     * @returns true if command sent successfully
     */
    async triggerDoorOpener(doorId: number = 0): Promise<boolean> {
        if (!this.sessionId) {
            return false;
        }

        try {
            // TODO: Verify exact payload and endpoint for door opener.
            // May involve: doorId parameter, unlock command, or relay activation.
            await this.client.post(
                this.config.doorbellOpenEndpoint,
                {
                    door: doorId,
                    action: "unlock",
                },
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Retrieve current snapshot from door camera as base64-encoded data URL.
     * @returns Base64 data URL (data:image/jpeg;base64,...) or null on error
     */
    async getSnapshot(): Promise<string | null> {
        if (!this.sessionId) {
            return null;
        }

        try {
            const response = await this.client.get(
                this.config.snapshotEndpoint,
                {
                    responseType: "arraybuffer",
                },
            );

            const base64 = Buffer.from(response.data).toString("base64");
            return `data:image/jpeg;base64,${base64}`;
        } catch (error) {
            return null;
        }
    }

    /**
     * Health check: verify gateway is reachable and authenticated.
     * @returns true if gateway responds
     */
    async checkHealth(): Promise<boolean> {
        try {
            const response = await this.client.get(
                this.config.healthCheckEndpoint,
            );
            // TODO: Adapt health check response validation to actual endpoint.
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close client and clean up resources.
     */
    close(): void {
        // Axios doesn't require explicit cleanup, but can add if needed
    }
}
