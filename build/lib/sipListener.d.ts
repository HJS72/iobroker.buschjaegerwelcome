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
export declare class SipListener extends EventEmitter {
    private localPort;
    private localAddress;
    private socket;
    private isListening;
    constructor(localPort: number, localAddress?: string);
    /**
     * Start listening for SIP packets.
     */
    start(): Promise<void>;
    /**
     * Stop listening and clean up socket.
     */
    stop(): void;
    /**
     * Parse incoming SIP message and extract INVITE data.
     */
    private onMessage;
    /**
     * Parse SIP INVITE and extract caller ID and call information.
     * TODO: Adapt extraction logic to actual gateway SIP header format.
     * Common patterns: From: sip:caller@domain, P-Asserted-Identity, Diversion, etc.
     */
    private parseSipInvite;
    /**
     * Check if listener is active.
     */
    isActive(): boolean;
}
