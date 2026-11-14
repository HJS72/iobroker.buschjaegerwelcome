# Quick Start: Development & Testing

## Installation

### Prerequisites
- Node.js 16+ (check with `node --version`)
- npm (comes with Node.js)
- ioBroker installation (for testing in actual environment)

### Setup

```bash
cd /path/to/iobroker.buschjaegerwelcome
npm install
npm run build
```

## Development Workflow

### Watch Mode (Auto-Compile on Save)
```bash
npm run watch
```
TypeScript files in `src/` automatically compile to `build/` on change.

### Linting
```bash
npm run lint
```
Checks TypeScript code for style and type errors.

### Build
```bash
npm run build
```
One-time compilation to `build/` directory.

## Testing Before Deployment

### 1. Verify API Endpoints

Before installing in ioBroker, verify your gateway API works:

```bash
# Create test-api.ts in project root
cat > test-api.ts << 'EOF'
import { WelcomeClient } from "./src/lib/welcomeClient";

async function testGateway() {
    const client = new WelcomeClient(
        "192.168.1.100",  // Replace with your gateway IP
        80,               // Replace with your gateway port
        "admin",          // Replace with your username
        "yourpassword"    // Replace with your password
    );

    try {
        console.log("1. Testing login...");
        const loginOk = await client.login();
        console.log(`   Result: ${loginOk ? "✓ Success" : "✗ Failed"}`);

        if (loginOk) {
            console.log("\n2. Testing health check...");
            const healthOk = await client.checkHealth();
            console.log(`   Result: ${healthOk ? "✓ Success" : "✗ Failed"}`);

            console.log("\n3. Testing snapshot retrieval...");
            const snapshot = await client.getSnapshot();
            console.log(`   Result: ${snapshot ? "✓ Success (base64 received)" : "✗ Failed"}`);
            if (snapshot) {
                console.log(`   Size: ${snapshot.length} characters`);
            }

            console.log("\n4. Testing door opener trigger...");
            const doorOk = await client.triggerDoorOpener(0);
            console.log(`   Result: ${doorOk ? "✓ Command sent" : "✗ Failed"}`);
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        client.close();
    }
}

testGateway();
EOF

# Run the test
npx ts-node test-api.ts
```

### 2. Test SIP Listener Locally

```bash
# Create test-sip.ts in project root
cat > test-sip.ts << 'EOF'
import { SipListener } from "./src/lib/sipListener";

async function testSipListener() {
    const listener = new SipListener(5060, "0.0.0.0");

    listener.on("ring", (event) => {
        console.log("✓ Ring detected!");
        console.log(`  Caller ID: ${event.callerId}`);
        console.log(`  Time: ${event.timestamp.toISOString()}`);
        console.log(`  Data: ${event.rawData}`);
    });

    listener.on("error", (error) => {
        console.error("✗ Listener error:", error.message);
    });

    try {
        await listener.start();
        console.log("✓ SIP listener started on port 5060");
        console.log("Waiting for incoming INVITE packets...");
        console.log("(Press Ctrl+C to stop)\n");
    } catch (error) {
        console.error("✗ Failed to start listener:", error);
    }

    process.on("SIGINT", () => {
        console.log("\nShutting down...");
        listener.stop();
        process.exit(0);
    });
}

testSipListener();
EOF

# Run the test (requires port 5060 to be available)
npx ts-node test-sip.ts
```

## Installation in ioBroker

### Option A: Local Development Install
```bash
# Copy adapter to ioBroker
cp -r /path/to/iobroker.buschjaegerwelcome /opt/iobroker/node_modules/iobroker.buschjaegerwelcome

# Or create symlink (if using npm link)
npm link
```

### Option B: Package for Distribution
```bash
npm run pack
# Creates iobroker.buschjaegerwelcome-0.1.0.tgz
```

Then install via ioBroker Admin UI → Adapters → Upload Custom Adapter.

## Configuration in ioBroker

1. **Open ioBroker Admin** → Adapters → Busch-Jaeger Welcome
2. **Click Install** (if not yet installed)
3. **Create Instance** (usually auto-created)
4. **Configure settings**:
   - Gateway IP: `192.168.1.100` (your gateway)
   - Gateway Port: `80` (or `443` for HTTPS)
   - Username: `admin` (or your username)
   - Password: `***` (your password)
   - SIP Port: `5060` (or alternative if port busy)
   - Poll Interval: `30` seconds
   - Door Duration: `5` seconds (ring auto-reset)

5. **Save & Close**
6. **Wait for adapter to start** (check Instances tab)

## Monitoring

### View Logs
```bash
# ioBroker command line
ioctl log buschjaegerwelcome.0

# Or in ioBroker Admin → Logs → Filter: buschjaegerwelcome.0
```

### Check States
ioBroker Admin → Objects → `buschjaegerwelcome.0.*`

You should see:
- `info.connection` (true/false)
- `doorbell.ring` (true/false, resets after configured duration)
- `doorbell.lastRing` (ISO timestamp)
- `doorbell.callerId` (string)
- `door.open` (button state)
- `door.openSecondary` (button state)
- `camera.snapshotBase64` (data URL string)
- `camera.triggerSnapshot` (button state)

## Troubleshooting

### Adapter Won't Start
```bash
# Check logs for errors
ioctl log buschjaegerwelcome.0 | tail -50

# Common issues:
# - Invalid gateway IP/port (unreachable gateway)
# - Wrong username/password (auth failure)
# - SIP port already in use (try different port in config)
```

### Doorbell Not Detected
1. Verify gateway sends INVITE packets:
   ```bash
   # On Linux, capture SIP traffic:
   tcpdump -i any port 5060
   # Or on macOS:
   sudo tcpdump -i any port 5060
   ```

2. Check if packets arrive on configured SIP port
3. Review adapter logs for SIP parsing errors

### Cannot Get Snapshots
1. Verify snapshot endpoint works manually:
   ```bash
   curl -H "Cookie: SESSIONID=..." http://192.168.1.100/video/snapshot.jpg -o test.jpg
   ```
2. Check if endpoint matches actual gateway API
3. See [API_CUSTOMIZATION_GUIDE.md](API_CUSTOMIZATION_GUIDE.md) for endpoint verification

### Door Open Not Working
1. Test endpoint manually with curl:
   ```bash
   curl -X POST -H "Cookie: SESSIONID=..." \
     -d '{"door":0,"action":"unlock"}' \
     http://192.168.1.100/command/unlock
   ```
2. Verify payload structure matches your gateway
3. Check gateway logs for authorization errors

## Clean Build

```bash
# Remove build artifacts and dependencies
rm -rf build node_modules

# Reinstall
npm install
npm run build
```

## VS Code Integration

### Recommended Extensions
- ESLint
- Prettier (optional)
- TypeScript Vue Plugin (if templates added)

### Debug Breakpoints
Add `debugger` statement in TypeScript, then:
```bash
node --inspect-brk build/main.js
```
Connect VS Code debugger to `localhost:9229`.

## Performance Tips

### Memory Usage
- SIP listener uses ~10-20 MB for UDP socket
- WelcomeClient adds ~5 MB overhead
- Total adapter typically 50-100 MB with ioBroker

### CPU Usage
- Idle: ~0.1-0.5% CPU
- During API call: ~1-2% CPU spike
- During doorbell: Brief spike (SIP parsing)

### Network
- Poll interval: ~1 KB per request (default 30s = ~2.8 KB/min)
- Snapshot: ~20-50 KB on demand
- Doorbell: ~1 KB per ring

## Code Debugging

### Add Logging
In `src/main.ts` or `src/lib/welcomeClient.ts`:
```typescript
this.log.debug(`Detailed debug info: ${JSON.stringify(data)}`);
```

Then in ioBroker Admin, set adapter log level to DEBUG.

### TypeScript Issues
```bash
# Check for type errors without compiling
npx tsc --noEmit

# Check specific file
npx tsc --noEmit src/main.ts
```

## Next Steps

1. **Verify gateway API endpoints** using Wireshark/DevTools (see [API_CUSTOMIZATION_GUIDE.md](API_CUSTOMIZATION_GUIDE.md))
2. **Test with test scripts** above
3. **Install and configure** in ioBroker
4. **Monitor logs** and verify states are updating
5. **Trigger doorbell** and verify ring event is detected
6. **Test door opener** button to ensure commands work

## Support

For issues or questions:
1. Check [README.md](README.md) - User documentation
2. Check [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
3. Check [API_CUSTOMIZATION_GUIDE.md](API_CUSTOMIZATION_GUIDE.md) - API endpoint verification
4. Review ioBroker logs for error details
