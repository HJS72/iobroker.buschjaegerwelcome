# ioBroker Busch-Jaeger Welcome IP Gateway Adapter

Control and monitor a **Busch-Jaeger Welcome IP Gateway** (models 83341/83342) locally from ioBroker via HTTP API and SIP doorbell detection.

## Features

- **Doorbell Detection**: Passive SIP listener captures INVITE packets from the gateway
- **Door Control**: Trigger door opener relay via local API
- **Camera Snapshots**: Retrieve door camera images on-demand or during ring events
- **Health Monitoring**: Periodic connection checks and automatic reconnection
- **Masked Credentials**: Password hidden in adapter settings
- **Full TypeScript Support**: Strict typing, no `any` types

## Installation

1. Install the adapter in ioBroker (Admin 6 or newer required)
2. Configure gateway IP, port, and credentials in adapter settings
3. Set local SIP listener port (default: 5060) if needed

## Configuration

### Basic Settings
- **Gateway IP Address**: Local IP of your Welcome IP Gateway (e.g., 192.168.1.100)
- **Gateway Port**: HTTP port (default: 80, or 443 for HTTPS)
- **Username**: Login credentials (from MyBuildings portal or local admin)
- **Password**: Authentication password (stored unencrypted in adapter configuration)

### Advanced Settings
- **SIP Listener Port**: Local UDP port for monitoring doorbell events (default: 5060)
- **Poll Interval**: Seconds between health checks (default: 30s)
- **Ring Auto-Reset Duration**: Seconds before ring state resets to false (default: 5s)

## States

### Info
- `info.connection` *(boolean, read-only)*: Gateway connection status

### Doorbell
- `doorbell.ring` *(boolean, read-only)*: Triggers when gateway sends INVITE packet
- `doorbell.lastRing` *(string, read-only)*: ISO timestamp of last ring
- `doorbell.callerId` *(string, read-only)*: Caller ID from SIP header

### Door
- `door.open` *(button, write-only)*: Trigger primary door opener
- `door.openSecondary` *(button, write-only)*: Trigger secondary door opener (optional)

### Camera
- `camera.snapshotBase64` *(string, read-only)*: Current image as base64 data URL
- `camera.triggerSnapshot` *(button, write-only)*: Manually fetch new snapshot

## API Endpoint Configuration

The adapter includes placeholders for Welcome API endpoints in `src/lib/welcomeClient.ts`.
Verify and adjust these based on your gateway's actual API by:

1. Capturing network traffic with Wireshark during login/control
2. Inspecting browser DevTools when using the gateway web interface
3. Checking gateway documentation

Key endpoints requiring adaptation:
- `loginEndpoint`: Default `/admin/login`
- `doorbellOpenEndpoint`: Default `/command/unlock`
- `snapshotEndpoint`: Default `/video/snapshot.jpg`
- `healthCheckEndpoint`: Default `/admin/status`

## Security Considerations

- Passwords are stored unencrypted in adapter configuration
- HTTPS gateway connections bypass self-signed certificate validation (required for local gateways)
- SIP listener is passive (does not respond to packets, avoiding interference)

## Troubleshooting

### Doorbell Not Detected
- Verify SIP listener port is open and not blocked by firewall
- Check gateway sends INVITE packets to configured SIP port
- Review adapter logs for SIP parsing errors

### Cannot Connect to Gateway
- Verify gateway IP and port are correct
- Check username/password are valid
- Ensure HTTP/HTTPS port is accessible from ioBroker host
- Review adapter logs for authentication errors

### No Snapshots
- Verify camera is functional on gateway web interface
- Check endpoint configuration matches actual gateway API
- Ensure session is authenticated before snapshot requests

## Development

### Build
```bash
npm install
npm run build
```

### Linting
```bash
npm run lint
```

### Watch Mode
```bash
npm run watch
```

## License

MIT

## References

- [ioBroker Adapter Core](https://github.com/ioBroker/adapter-core)
- [Node.js dgram (UDP)](https://nodejs.org/api/dgram.html)
- [Axios HTTP Client](https://axios-http.com/)
- [SIP Protocol RFC 3261](https://tools.ietf.org/html/rfc3261)
