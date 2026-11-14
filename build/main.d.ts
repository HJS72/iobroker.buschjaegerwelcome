import * as utils from "@iobroker/adapter-core";
/**
 * Configuration interface for the adapter.
 */
interface AdapterConfig {
    gatewayIp: string;
    gatewayPort: number;
    username: string;
    password: string;
    sipPort: number;
    pollInterval: number;
    doorOpenDuration: number;
}
/**
 * Main adapter class for Busch-Jaeger Welcome IP Gateway.
 */
declare class BuschJaegerWelcomeAdapter extends utils.Adapter {
    config: AdapterConfig;
    private welcomeClient;
    private sipListener;
    private healthCheckInterval;
    private ringResetTimeout;
    constructor(options?: Partial<utils.AdapterOptions>);
    /**
     * Adapter startup: initialize objects and connect to gateway.
     */
    private onReady;
    /**
     * Initialize ioBroker object structure.
     */
    private initializeObjects;
    /**
     * Handle state changes (button presses, control commands).
     */
    private onStateChange;
    /**
     * Handle door open button press.
     */
    private handleDoorOpen;
    /**
     * Handle snapshot trigger button press.
     */
    private handleSnapshotTrigger;
    /**
     * Handle doorbell ring event from SIP listener.
     */
    private onDoorbell;
    /**
     * Periodic health check to verify gateway connection.
     */
    private performHealthCheck;
    /**
     * Adapter unload: clean up resources.
     */
    private onUnload;
}
export = BuschJaegerWelcomeAdapter;
