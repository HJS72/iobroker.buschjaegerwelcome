import * as utils from "@iobroker/adapter-core";
import { WelcomeClient } from "./lib/welcomeClient";
import { SipListener, SipRingEvent } from "./lib/sipListener";

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
class BuschJaegerWelcomeAdapter extends utils.Adapter {
    declare config: AdapterConfig;
    private welcomeClient: WelcomeClient | null = null;
    private sipListener: SipListener | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private ringResetTimeout: NodeJS.Timeout | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "buschjaegerwelcome",
        });

        this.on("ready", () => this.onReady());
        this.on("stateChange", (id, state) => this.onStateChange(id, state ?? null));
        this.on("unload", () => this.onUnload());
    }

    /**
     * Adapter startup: initialize objects and connect to gateway.
     */
    private async onReady(): Promise<void> {
        this.log.info("Starting Busch-Jaeger Welcome adapter...");

        try {
            // Get configuration
            const gatewayIp = this.config.gatewayIp;
            const gatewayPort = this.config.gatewayPort || 80;
            const username = this.config.username || "";
            const password = this.config.password || "";
            const sipPort = this.config.sipPort || 5060;
            const pollInterval = this.config.pollInterval || 30;

            // Create client
            this.welcomeClient = new WelcomeClient(
                gatewayIp,
                gatewayPort,
                username,
                password,
            );

            // Create SIP listener
            this.sipListener = new SipListener(sipPort, "0.0.0.0");
            this.sipListener.on("ring", (event: SipRingEvent) =>
                this.onDoorbell(event),
            );
            this.sipListener.on("error", (error) => {
                this.log.warn(`SIP listener error: ${error.message}`);
            });

            // Initialize adapter objects
            await this.initializeObjects();

            // Try to connect to gateway
            const connected = await this.welcomeClient.login();
            if (connected) {
                this.log.info("Successfully authenticated with gateway");
                await this.setState("info.connection", true, true);
            } else {
                this.log.warn("Could not authenticate with gateway");
                await this.setState("info.connection", false, true);
            }

            // Start SIP listener
            try {
                await this.sipListener.start();
                this.log.info(
                    `SIP listener started on port ${sipPort}`,
                );
            } catch (error) {
                this.log.warn(
                    `Could not start SIP listener on port ${sipPort}: ${String(error)}`,
                );
            }

            // Start health check interval
            this.healthCheckInterval = setInterval(
                () => this.performHealthCheck(),
                pollInterval * 1000,
            );

            this.log.info("Adapter ready");
        } catch (error) {
            this.log.error(`Startup failed: ${String(error)}`);
            this.setState("info.connection", false, true).catch(() => {});
        }
    }

    /**
     * Initialize ioBroker object structure.
     */
    private async initializeObjects(): Promise<void> {
        const prefix = this.namespace;

        // Info channel
        await this.setObjectNotExists(`${prefix}.info`, {
            type: "channel",
            common: {
                name: "Info",
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.info.connection`, {
            type: "state",
            common: {
                name: "Connection Status",
                type: "boolean",
                role: "indicator.connected",
                read: true,
                write: false,
            },
            native: {},
        });

        // Doorbell channel
        await this.setObjectNotExists(`${prefix}.doorbell`, {
            type: "channel",
            common: {
                name: "Doorbell",
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.doorbell.ring`, {
            type: "state",
            common: {
                name: "Ring Detected",
                type: "boolean",
                role: "sensor.alarm",
                read: true,
                write: false,
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.doorbell.lastRing`, {
            type: "state",
            common: {
                name: "Last Ring Time",
                type: "string",
                role: "value.datetime",
                read: true,
                write: false,
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.doorbell.callerId`, {
            type: "state",
            common: {
                name: "Caller ID",
                type: "string",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });

        // Door channel
        await this.setObjectNotExists(`${prefix}.door`, {
            type: "channel",
            common: {
                name: "Door Control",
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.door.open`, {
            type: "state",
            common: {
                name: "Open Door",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.door.openSecondary`, {
            type: "state",
            common: {
                name: "Open Secondary Door",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
            },
            native: {},
        });

        // Camera channel
        await this.setObjectNotExists(`${prefix}.camera`, {
            type: "channel",
            common: {
                name: "Camera",
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.camera.snapshotBase64`, {
            type: "state",
            common: {
                name: "Snapshot (Base64)",
                type: "string",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });

        await this.setObjectNotExists(`${prefix}.camera.triggerSnapshot`, {
            type: "state",
            common: {
                name: "Trigger Snapshot",
                type: "boolean",
                role: "button",
                read: false,
                write: true,
            },
            native: {},
        });

        // Subscribe to state changes
        this.subscribeStates(`${prefix}.door.open`);
        this.subscribeStates(`${prefix}.door.openSecondary`);
        this.subscribeStates(`${prefix}.camera.triggerSnapshot`);
    }

    /**
     * Handle state changes (button presses, control commands).
     */
    private async onStateChange(
        id: string,
        state: ioBroker.State | null,
    ): Promise<void> {
        if (!state || state.ack) {
            return;
        }

        try {
            if (id.endsWith(".door.open")) {
                await this.handleDoorOpen(0);
            } else if (id.endsWith(".door.openSecondary")) {
                await this.handleDoorOpen(1);
            } else if (id.endsWith(".camera.triggerSnapshot")) {
                await this.handleSnapshotTrigger();
            }
        } catch (error) {
            this.log.error(`State change handler error: ${String(error)}`);
        }
    }

    /**
     * Handle door open button press.
     */
    private async handleDoorOpen(doorId: number): Promise<void> {
        if (!this.welcomeClient) {
            this.log.warn("Welcome client not initialized");
            return;
        }

        try {
            const success = await this.welcomeClient.triggerDoorOpener(doorId);
            if (success) {
                this.log.info(`Door opener ${doorId} triggered`);
            } else {
                this.log.warn(`Failed to trigger door opener ${doorId}`);
            }
        } catch (error) {
            this.log.error(`Error triggering door opener: ${String(error)}`);
        }
    }

    /**
     * Handle snapshot trigger button press.
     */
    private async handleSnapshotTrigger(): Promise<void> {
        if (!this.welcomeClient) {
            this.log.warn("Welcome client not initialized");
            return;
        }

        try {
            const snapshot = await this.welcomeClient.getSnapshot();
            if (snapshot) {
                await this.setState(
                    `${this.namespace}.camera.snapshotBase64`,
                    snapshot,
                    true,
                );
                this.log.debug("Snapshot captured and stored");
            } else {
                this.log.warn("Failed to capture snapshot");
            }
        } catch (error) {
            this.log.error(`Error capturing snapshot: ${String(error)}`);
        }
    }

    /**
     * Handle doorbell ring event from SIP listener.
     */
    private async onDoorbell(event: SipRingEvent): Promise<void> {
        try {
            this.log.info(`Doorbell detected from ${event.callerId}`);

            // Set ring state to true
            await this.setState(`${this.namespace}.doorbell.ring`, true, true);
            await this.setState(
                `${this.namespace}.doorbell.lastRing`,
                event.timestamp.toISOString(),
                true,
            );
            await this.setState(
                `${this.namespace}.doorbell.callerId`,
                event.callerId,
                true,
            );

            // Attempt to capture snapshot
            try {
                if (this.welcomeClient) {
                    const snapshot =
                        await this.welcomeClient.getSnapshot();
                    if (snapshot) {
                        await this.setState(
                            `${this.namespace}.camera.snapshotBase64`,
                            snapshot,
                            true,
                        );
                    }
                }
            } catch (error) {
                this.log.debug(
                    `Could not capture snapshot: ${String(error)}`,
                );
            }

            // Auto-reset ring state after configured duration
            if (this.ringResetTimeout) {
                clearTimeout(this.ringResetTimeout);
            }

            const duration = this.config.doorOpenDuration || 5;
            this.ringResetTimeout = setTimeout(() => {
                this.setState(
                    `${this.namespace}.doorbell.ring`,
                    false,
                    true,
                ).catch(() => {});
            }, duration * 1000);
        } catch (error) {
            this.log.error(`Error handling doorbell: ${String(error)}`);
        }
    }

    /**
     * Periodic health check to verify gateway connection.
     */
    private async performHealthCheck(): Promise<void> {
        if (!this.welcomeClient) {
            return;
        }

        try {
            const isHealthy = await this.welcomeClient.checkHealth();
            await this.setState(`${this.namespace}.info.connection`, isHealthy, true);

            if (!isHealthy) {
                this.log.warn("Gateway health check failed");
                // Attempt reconnection
                const reconnected = await this.welcomeClient.login();
                if (reconnected) {
                    this.log.info("Reconnected to gateway");
                    await this.setState(`${this.namespace}.info.connection`, true, true);
                }
            }
        } catch (error) {
            this.log.error(`Health check error: ${String(error)}`);
        }
    }

    /**
     * Adapter unload: clean up resources.
     */
    private async onUnload(): Promise<void> {
        this.log.info("Unloading adapter...");

        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.ringResetTimeout) {
            clearTimeout(this.ringResetTimeout);
        }

        // Stop SIP listener
        if (this.sipListener) {
            this.sipListener.stop();
        }

        // Close welcome client
        if (this.welcomeClient) {
            this.welcomeClient.close();
        }

        this.log.info("Adapter unloaded");
    }
}

// Start adapter
if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const adapter = new BuschJaegerWelcomeAdapter();
}

export = BuschJaegerWelcomeAdapter;
