# Adapter Architecture

## Project Structure

```
iobroker.buschjaegerwelcome/
├── src/
│   ├── lib/
│   │   ├── welcomeClient.ts      # HTTP/HTTPS API client
│   │   └── sipListener.ts        # Passive SIP INVITE listener
│   └── main.ts                   # ioBroker adapter integration
├── admin/
│   ├── jsonConfig.json           # Modern UI configuration
│   └── i18n/
│       ├── en/translations.json  # English strings
│       └── de/translations.json  # German strings
├── build/                        # Compiled JavaScript (generated)
├── io-package.json               # Adapter metadata & configuration schema
├── package.json                  # npm dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # User documentation
```

## Component Overview

### 1. WelcomeClient (`src/lib/welcomeClient.ts`)

**Purpose**: Encapsulates HTTP/HTTPS communication with Busch-Jaeger Welcome IP Gateway.

**Key Methods**:
- `login()` → Authenticate and establish session
- `triggerDoorOpener(doorId)` → Send unlock command
- `getSnapshot()` → Fetch camera image as base64 data URL
- `checkHealth()` → Verify gateway connectivity
- `close()` → Clean up resources

**Configuration**:
```typescript
interface ApiConfig {
    loginEndpoint: string;           // Default: "/admin/login"
    doorbellOpenEndpoint: string;    // Default: "/command/unlock"
    snapshotEndpoint: string;        // Default: "/video/snapshot.jpg"
    healthCheckEndpoint: string;     // Default: "/admin/status"
}
```

**Features**:
- Self-signed SSL certificate bypass (https.Agent)
- Session token management (cookies or bearer tokens)
- 10-second request timeout
- TODO markers for endpoint customization per gateway firmware

### 2. SipListener (`src/lib/sipListener.ts`)

**Purpose**: Lightweight passive UDP listener for SIP INVITE packets (doorbell signals).

**Key Methods**:
- `start()` → Begin listening on configured UDP port
- `stop()` → Shut down listener and release socket
- `isActive()` → Check listener status

**Events**:
- `ring` → Fired when INVITE received, emits `SipRingEvent`
- `error` → Network/parse errors

**SipRingEvent Structure**:
```typescript
interface SipRingEvent {
    callerId: string;      // Extracted from SIP From header
    timestamp: Date;       // Event time
    rawData: string;       // Call-ID and debug info
}
```

**Features**:
- Passive listener (no response packets sent to avoid interference)
- Parses INVITE requests and extracts caller ID
- EventEmitter pattern for integration
- Silent error handling (non-blocking parse errors)

### 3. Main Adapter (`src/main.ts`)

**Purpose**: ioBroker integration layer connecting clients to Adapter lifecycle.

**Lifecycle**:
1. `onReady()` → Initialize objects, login to gateway, start SIP listener
2. `onStateChange()` → Handle button presses (door open, snapshot)
3. `onUnload()` → Clean up intervals, close listeners/clients

**Object Initialization**:
Automatically creates ioBroker state tree:
```
buschjaegerwelcome.0
├── info.connection        (boolean, read-only)
├── doorbell
│   ├── ring              (boolean, read-only)
│   ├── lastRing          (string, read-only)
│   └── callerId          (string, read-only)
├── door
│   ├── open              (button, write-only)
│   └── openSecondary     (button, write-only)
└── camera
    ├── snapshotBase64    (string, read-only)
    └── triggerSnapshot   (button, write-only)
```

**Key Features**:
- Health check interval (configurable, default 30s)
- Auto-reconnect on health check failure
- Ring state auto-reset after configurable duration
- Snapshot capture on doorbell or manual trigger
- Comprehensive error logging and handling
- Timer cleanup in onUnload

## Data Flow

### Doorbell Ring Event
```
1. SIP INVITE received on UDP port
2. SipListener parses packet, extracts caller ID
3. Emits "ring" event with SipRingEvent data
4. Adapter handler sets doorbell.ring = true
5. Adapter attempts snapshot capture
6. After doorOpenDuration seconds, ring state resets to false
```

### Door Open Command
```
1. User writes to door.open state
2. Adapter calls welcomeClient.triggerDoorOpener(0)
3. WelcomeClient POSTs unlock command to gateway
4. Gateway activates relay/door opener
```

### Health Check
```
1. Timer fires every pollInterval seconds
2. WelcomeClient.checkHealth() sends request
3. If failed: attempt re-login
4. Update info.connection state
```

## Configuration

### Native Config (io-package.json)
```json
{
  "gatewayIp": "192.168.1.100",
  "gatewayPort": 80,
  "username": "",
  "password": "",              // Encrypted by ioBroker
  "sipPort": 5060,
  "pollInterval": 30,
  "doorOpenDuration": 5
}
```

### Admin UI (admin/jsonConfig.json)
- Modern JSON schema-based configuration
- Two tabs: Settings (IP, port, credentials) and Advanced (SIP, intervals)
- i18n support for English and German
- Password field with encryption

## Error Handling

### WelcomeClient
- Login failure → Returns false, adapter sets connection to false
- Request timeout → Caught and logged, returns null/false
- SSL certificate bypass → Allows self-signed certs for local gateways

### SipListener
- Port binding error → Emits error event, adapter logs warning
- Parse errors → Silent (don't crash listener)
- UDP buffer overflow → Truncated to 4096 bytes max

### Main Adapter
- Initialization errors → Logged, connection set to false
- State change handlers wrapped in try/catch
- All timers cleared in onUnload
- Graceful degradation (continues if SIP fails)

## Security Considerations

1. **Password Encryption**: Stored encrypted via ioBroker's native config
2. **HTTPS Support**: Supports gateway HTTPS port with self-signed cert bypass
3. **SIP Passivity**: Never sends responses, avoids interference with other endpoints
4. **No External Dependencies**: Uses only Node.js stdlib + axios (well-maintained)
5. **Strict TypeScript**: No `any` types, full type safety

## Customization Points

### API Endpoint Adjustment
Edit `ApiConfig` in `welcomeClient.ts`:
- Capture network traffic with Wireshark during login
- Verify endpoints in browser DevTools
- Update `loginEndpoint`, `doorbellOpenEndpoint`, etc.
- Adjust request payload and response parsing

### SIP Header Parsing
Edit `parseSipInvite()` method in `sipListener.ts`:
- Adjust regex patterns for From/P-Asserted-Identity headers
- Handle gateway-specific caller ID formats
- Add additional header extraction as needed

### Poll Intervals and Timeouts
Configurable via Admin UI:
- `pollInterval`: Health check frequency
- `doorOpenDuration`: Ring auto-reset delay
- `sipPort`: Alternative UDP port if default taken

## Testing

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Watch Mode (Development)
```bash
npm run watch
```

## Known Limitations

1. **SIP Passive Mode**: Doorbell events recognized by INVITE arrival only
2. **No Video Stream**: Snapshots only (JPEG), H.264/RTP stream not captured
3. **Single Gateway**: Adapter instance per gateway (no multi-gateway in one instance)
4. **No Authentication Refresh**: Session assumed valid, requires manual restart if expired
5. **API Endpoint Placeholders**: Requires Wireshark/DevTools verification for actual gateway

## Future Enhancements

- [ ] Event-based authentication retry
- [ ] Multiple door/opener support (secondary already implemented)
- [ ] Video stream capture via RTSP/RTP
- [ ] Configuration validation/test button in Admin UI
- [ ] Gateway firmware version detection
- [ ] SIP OPTIONS ping for keep-alive
- [ ] Configurable snapshot resolution/quality
