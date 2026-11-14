"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SipListener = void 0;
const dgram_1 = __importDefault(require("dgram"));
const events_1 = require("events");
/**
 * Lightweight passive SIP listener for detecting doorbell INVITE packets.
 * Listens on local UDP port for SIP INVITE messages from gateway.
 * Does NOT respond with 200 OK to avoid interfering with other SIP endpoints.
 */
class SipListener extends events_1.EventEmitter {
    constructor(localPort, localAddress = "0.0.0.0") {
        super();
        this.localPort = localPort;
        this.localAddress = localAddress;
        this.socket = null;
        this.isListening = false;
    }
    /**
     * Start listening for SIP packets.
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = dgram_1.default.createSocket("udp4");
                this.socket.on("message", (msg, rinfo) => {
                    this.onMessage(msg, rinfo);
                });
                this.socket.on("error", (error) => {
                    this.emit("error", error);
                });
                this.socket.bind(this.localPort, this.localAddress, () => {
                    this.isListening = true;
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop listening and clean up socket.
     */
    stop() {
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
    onMessage(msg, rinfo) {
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
        }
        catch (error) {
            // Silently ignore parse errors
        }
    }
    /**
     * Parse SIP INVITE and extract caller ID and call information.
     * TODO: Adapt extraction logic to actual gateway SIP header format.
     * Common patterns: From: sip:caller@domain, P-Asserted-Identity, Diversion, etc.
     */
    parseSipInvite(data) {
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
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Check if listener is active.
     */
    isActive() {
        return this.isListening;
    }
}
exports.SipListener = SipListener;
//# sourceMappingURL=sipListener.js.map