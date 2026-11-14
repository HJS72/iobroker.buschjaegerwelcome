import axios, { AxiosInstance } from "axios";
import https from "https";

/**
 * Interface for API configuration endpoints and payloads.
 * Door and camera endpoints remain placeholders.
 */
interface ApiConfig {
    doorbellOpenEndpoint: string;
    snapshotEndpoint: string;
}

/**
 * Welcome API Client for local HTTP/HTTPS communication with Busch-Jaeger Welcome IP Gateway.
 * Handles SSL certificate validation bypass and session management.
 */
export class WelcomeClient {
    private client: AxiosInstance;
    private sessionId: string | null = null;
    private config: ApiConfig;
    private logger: ((msg: string) => void) | null = null;

    constructor(
        private gatewayIp: string,
        private gatewayPort: number,
        private username: string,
        private password: string,
    ) {
        this.config = {
            doorbellOpenEndpoint: "/command/unlock",
            snapshotEndpoint: "/video/snapshot.jpg",
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
     * Set logger function for debug output
     */
    setLogger(logger: (msg: string) => void): void {
        this.logger = logger;
    }

    private log(msg: string): void {
        if (this.logger) {
            this.logger(msg);
        }
    }

    /**
     * Authenticate with the gateway and store session ID.
     * @returns true if authentication successful
     */
    async login(): Promise<boolean> {
        this.sessionId = null;
        delete this.client.defaults.headers.common["Cookie"];
        try {
            const password = encodeURIComponent(this.password).replace(
                /[!'()*]/g,
                (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
            );
            const response = await this.client.post("/cgi-bin/checklogin.cgi", {
                username: this.username,
                password,
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
            this.sessionId = "authenticated";
            return true;
        } catch (error) {
            this.logRequestFailure("Gateway login", error);
            return false;
        }
    }

    private logRequestFailure(operation: string, error: unknown): void {
        if (axios.isAxiosError(error)) {
            this.log(`${operation} failed (${error.response ? `HTTP ${error.response.status}` : error.code || "network error"})`);
        } else {
            this.log(`${operation} failed (unexpected error)`);
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
        if (!this.sessionId) {
            return false;
        }
        try {
            const origin = `http${this.gatewayPort === 443 ? "s" : ""}://${this.gatewayIp}:${this.gatewayPort}`;
            const response = await this.client.post(
                "/cgi-bin/portalclient.cgi",
                JSON.stringify({ op: "6" }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Origin": origin,
                        "Referer": `${origin}/config.html?v=0.1`,
                    },
                },
            );
            if (response.status === 200 && typeof response.data?.uuid === "string" && response.data.uuid) {
                return true;
            }
            this.log(`Gateway health check returned an invalid response (HTTP ${response.status})`);
            return false;
        } catch (error) {
            this.logRequestFailure("Gateway health check", error);
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
