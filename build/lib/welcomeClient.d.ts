/**
 * Welcome API Client for local HTTP/HTTPS communication with Busch-Jaeger Welcome IP Gateway.
 * Handles SSL certificate validation bypass and session management.
 */
export declare class WelcomeClient {
    private gatewayIp;
    private gatewayPort;
    private username;
    private password;
    private client;
    private sessionId;
    private config;
    constructor(gatewayIp: string, gatewayPort: number, username: string, password: string);
    /**
     * Authenticate with the gateway and store session ID.
     * @returns true if authentication successful
     */
    login(): Promise<boolean>;
    /**
     * Trigger door opener via gateway API.
     * @param doorId ID of the door/opener (default 0 for primary door)
     * @returns true if command sent successfully
     */
    triggerDoorOpener(doorId?: number): Promise<boolean>;
    /**
     * Retrieve current snapshot from door camera as base64-encoded data URL.
     * @returns Base64 data URL (data:image/jpeg;base64,...) or null on error
     */
    getSnapshot(): Promise<string | null>;
    /**
     * Health check: verify gateway is reachable and authenticated.
     * @returns true if gateway responds
     */
    checkHealth(): Promise<boolean>;
    /**
     * Close client and clean up resources.
     */
    close(): void;
}
