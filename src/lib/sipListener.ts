import dgram from "dgram";
import { EventEmitter } from "events";

/**
 * Interface for SIP ring event data.
 */
export interface SipRingEvent {
    callerId: string;
    timestamp: Date;
    rawData: string;
}

/**
 * Lightweight passive SIP listener for detecting doorbell INVITE packets.
 * Listens on local UDP port for SIP INVITE messages from gateway.
 * Does NOT respond with 200 OK to avoid interfering with other SIP endpoints.
 */
export class SipListener extends EventEmitter {
    private socket: dgram.Socket | null = null;
    private isListening = false;

    constructor(
        private localPort: number,
        private localAddress: string = "0.0.0.0",
    ) {
        super();
    }

    /**
     * Start listening for SIP packets.
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.socket = dgram.createSocket("udp4");

                this.socket.on("message", (msg: Buffer, rinfo) => {
                    this.onMessage(msg, rinfo);
                });

                this.socket.on("error", (error) => {
                    this.emit("error", error);
                });

                this.socket.bind(this.localPort, this.localAddress, () => {
                    this.isListening = true;
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop listening and clean up socket.
     */
    stop(): void {
        if (this.socket) {
            this.isListening = false;
            this.socket.close();
            this.socket = null;
        }
    }

    /**
     * Parse incoming SIP message and extract INVITE data.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
        try {
            const data = msg.toString("utf-8", 0, Math.min(msg.length, 4096));

            // Check if this is an INVITE request
            if (!data.startsWith("INVITE")) {
                return;
            }

            const event = this.parseSipInvite(data);
            if (event) {
                this.emit("ring", event);
            }
        } catch (error) {
            // Silently ignore parse errors
        }
    }

    /**
     * Parse SIP INVITE and extract caller ID and call information.
     * TODO: Adapt extraction logic to actual gateway SIP header format.
     * Common patterns: From: sip:caller@domain, P-Asserted-Identity, Diversion, etc.
     */
    private parseSipInvite(data: string): SipRingEvent | null {
        try {
            // Extract From header (caller ID)
            const fromMatch = data.match(/From:.*<sip:([^@>]+)/i);
            const callerId = fromMatch ? fromMatch[1] : "unknown";

            // Extract Call-ID for tracking
            const callIdMatch = data.match(/Call-ID:\s*([^\r\n]+)/i);
            const callId = callIdMatch ? callIdMatch[1] : "unknown";

            return {
                callerId,
                timestamp: new Date(),
                rawData: `CallID: ${callId}`,
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if listener is active.
     */
    isActive(): boolean {
        return this.isListening;
    }
}
