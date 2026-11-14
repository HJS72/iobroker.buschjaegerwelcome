# Implementation Guide: Verifying and Adapting API Endpoints

This guide explains how to verify and customize the Busch-Jaeger Welcome IP Gateway API endpoints for your specific firmware version.

## Why Endpoint Customization is Necessary

Different gateway firmware versions or regional variants (83341 vs 83342, etc.) may use different:
- HTTP request paths (`/login` vs `/admin/login`)
- JSON payload structures
- Response header formats (session tokens, cookies)
- Authentication mechanisms (Bearer token vs session cookie)

## Methods to Discover Actual Endpoints

### Method 1: Browser Developer Tools (Easiest)

1. **Open gateway web interface**:
   - Navigate to `http://<gateway-ip>:80` (or `:443` for HTTPS)
   - Open Browser DevTools (F12 → Network tab)

2. **Perform login**:
   - Log in with your credentials
   - Look for `POST` requests in Network tab
   - Click on the login request and check:
     - Request URL (e.g., `/admin/login`, `/api/login`, `/v1/auth`)
     - Request body (form data or JSON)
     - Response headers (`Set-Cookie`, `Authorization`)
     - Response body (check for `sessionId`, `token`, etc.)

3. **Document findings**:
   ```
   Login Endpoint: POST /v1/auth/login
   Request Body: { "username": "admin", "password": "...", "session": true }
   Response Header: Authorization: Bearer {token}
   ```

4. **Perform door open**:
   - Click "unlock" button on web interface
   - Find corresponding `POST` request
   - Note URL path, body structure, and response

5. **Capture snapshot**:
   - Trigger camera snapshot in web interface
   - Look for `GET` request to image endpoint
   - Note the exact URL path

### Method 2: Wireshark Network Capture

1. **Start Wireshark** and filter to gateway IP:
   ```
   ip.addr == 192.168.1.100
   ```

2. **Log in via web interface**, capture traffic

3. **Analyze HTTP requests**:
   - Find login request: check method, path, headers, body
   - Identify response: session token/cookie location
   - Document exact payload structure

4. **Repeat for door open and snapshot commands**

### Method 3: Gateway API Documentation

1. Check gateway web interface for API documentation link
2. Search manufacturer support site for API reference
3. Contact Busch-Jaeger support for technical documentation

---

## Adapting WelcomeClient for Your Gateway

### Step 1: Update API Config

Edit `src/lib/welcomeClient.ts` and update the `ApiConfig` object:

**Current placeholder**:
```typescript
this.config = {
    loginEndpoint: "/admin/login",
    doorbellOpenEndpoint: "/command/unlock",
    snapshotEndpoint: "/video/snapshot.jpg",
    healthCheckEndpoint: "/admin/status",
};
```

**Example with actual endpoint** (adjust to your findings):
```typescript
this.config = {
    loginEndpoint: "/v1/auth/login",              // UPDATE
    doorbellOpenEndpoint: "/v1/devices/unlock",   // UPDATE
    snapshotEndpoint: "/v1/camera/snapshot",      // UPDATE
    healthCheckEndpoint: "/v1/system/health",     // UPDATE
};
```

### Step 2: Update Login Request Payload

Current placeholder:
```typescript
const response = await this.client.post(this.config.loginEndpoint, {
    username: this.username,
    password: this.password,
});
```

**If your gateway expects different structure**, adjust:
```typescript
// Example: Form-encoded instead of JSON
const params = new URLSearchParams();
params.append("username", this.username);
params.append("password", this.password);
params.append("persistent", "true");

const response = await this.client.post(
    this.config.loginEndpoint,
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
);
```

### Step 3: Update Session Token Extraction

Current placeholder handles two patterns (cookies or JSON response):
```typescript
const setCookie = response.headers["set-cookie"];
if (setCookie) {
    const sessionMatch = setCookie[0]?.match(/SESSIONID=([^;]+)/);
    if (sessionMatch) {
        this.sessionId = sessionMatch[1];
        this.client.defaults.headers.common["Cookie"] = `SESSIONID=${this.sessionId}`;
        return true;
    }
}

if (response.data?.sessionId) {
    this.sessionId = response.data.sessionId;
    this.client.defaults.headers.common["Authorization"] = `Bearer ${this.sessionId}`;
    return true;
}
```

**If your gateway uses different token format**:
```typescript
// Example: Token in response body with different name
if (response.data?.accessToken) {
    this.sessionId = response.data.accessToken;
    this.client.defaults.headers.common["X-API-Token"] = this.sessionId;
    return true;
}

// Or if token is in custom header
const token = response.headers["x-session-token"];
if (token) {
    this.sessionId = token;
    this.client.defaults.headers.common["X-Session-Token"] = token;
    return true;
}
```

### Step 4: Update Door Opener Command

Current placeholder:
```typescript
await this.client.post(
    this.config.doorbellOpenEndpoint,
    {
        door: doorId,
        action: "unlock",
    },
);
```

**Adapt to your gateway's expected format**:
```typescript
// Example: Different payload structure
await this.client.post(
    `${this.config.doorbellOpenEndpoint}/${doorId}`,  // doorId in URL
    {
        command: "open",
        duration: 3,
    },
);

// Or if using query parameters
await this.client.post(
    `${this.config.doorbellOpenEndpoint}?door=${doorId}&action=unlock`,
);
```

### Step 5: Update Snapshot Endpoint

Current placeholder:
```typescript
const response = await this.client.get(
    this.config.snapshotEndpoint,
    { responseType: "arraybuffer" }
);
```

**If your gateway requires additional parameters**:
```typescript
const response = await this.client.get(
    `${this.config.snapshotEndpoint}?resolution=640x480&quality=80`,
    { responseType: "arraybuffer" }
);
```

### Step 6: Update Health Check

Current placeholder:
```typescript
const response = await this.client.get(
    this.config.healthCheckEndpoint,
);
return response.status === 200;
```

**If response includes state data to validate**:
```typescript
const response = await this.client.get(
    this.config.healthCheckEndpoint,
);
return response.status === 200 && response.data?.status === "online";
```

---

## Verifying Changes with a Test Script

After updating endpoints, test them locally before deploying:

```typescript
// test-api.ts - Quick validation script
import { WelcomeClient } from "./src/lib/welcomeClient";

async function test() {
    const client = new WelcomeClient(
        "192.168.1.100",  // Your gateway IP
        80,
        "admin",          // Your username
        "password"        // Your password
    );

    console.log("Testing login...");
    const loginOk = await client.login();
    console.log("Login:", loginOk ? "✓ Success" : "✗ Failed");

    if (loginOk) {
        console.log("Testing health check...");
        const healthOk = await client.checkHealth();
        console.log("Health:", healthOk ? "✓ Success" : "✗ Failed");

        console.log("Testing snapshot...");
        const snapshot = await client.getSnapshot();
        console.log("Snapshot:", snapshot ? "✓ Success" : "✗ Failed");
    }

    client.close();
}

test().catch(console.error);
```

Run with:
```bash
npx ts-node test-api.ts
```

---

## Debugging Failed Requests

If endpoints still don't work after adaptation:

### 1. Enable Verbose Logging

Add to `welcomeClient.ts` after creating axios instance:
```typescript
this.client.interceptors.request.use(request => {
    console.log("Request:", request.method?.toUpperCase(), request.url);
    console.log("Data:", request.data);
    return request;
});

this.client.interceptors.response.use(
    response => {
        console.log("Response:", response.status);
        console.log("Headers:", response.headers);
        console.log("Data:", response.data);
        return response;
    },
    error => {
        console.log("Error:", error.response?.status, error.message);
        throw error;
    }
);
```

### 2. Use Postman or curl

Test endpoints manually:
```bash
# Test login
curl -v -X POST http://192.168.1.100/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Test door open (replace SESSIONID with actual token)
curl -v -X POST http://192.168.1.100/command/unlock \
  -H "Cookie: SESSIONID=abc123" \
  -d '{"door":0}'

# Test snapshot
curl -v http://192.168.1.100/video/snapshot.jpg \
  -H "Cookie: SESSIONID=abc123" \
  -o snapshot.jpg
```

### 3. Check Gateway Logs

Access gateway admin interface and review logs for API access errors or invalid requests.

---

## Common Variations by Gateway Model

### Busch-Welcome 83341 (Legacy)
- Often uses form-encoded login
- Session token in cookies (SESSIONID or custom name)
- Door open: `/admin/command` with POST body
- Snapshot: `/admin/image`

### Busch-Welcome 83342 (Modern)
- May use JSON login
- Bearer token in Authorization header
- Door open: `/api/v2/unlock` or `/command/unlock`
- Snapshot: `/api/camera/snapshot` or `/video/snapshot`

---

## Documenting Your Configuration

Once verified, document your findings for future reference:

```markdown
# My Gateway Configuration

**Model**: 83342
**Firmware**: 1.2.3

## API Endpoints
- Login: POST /v1/auth/login
- Door Open: POST /v1/devices/unlock
- Snapshot: GET /v1/camera/snapshot
- Health: GET /v1/system/health

## Authentication
- Type: Bearer token
- Header: Authorization
- Extracted from: response.data.accessToken

## Payload Examples
Login request: { "username", "password" }
Door open: { "door": 0, "action": "unlock" }
```

---

## Need Help?

If you cannot discover endpoints or they still don't work:

1. **Check ioBroker logs** (`Settings → Logs → buschjaegerwelcome.0`)
2. **Share Wireshark capture** of a login attempt (redact credentials)
3. **Try different port** (some gateways use 8080, 8443, etc.)
4. **Verify gateway firmware** is up-to-date
5. **Contact Busch-Jaeger support** for API documentation
