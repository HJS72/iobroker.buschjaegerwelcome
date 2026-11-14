const assert = require("assert");
const http = require("http");
const { createServer } = require("../testapp/server");

function listen(server) {
    return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
    return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function request(port, method, path, body, origin = `http://127.0.0.1:${port}`) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port,
            method,
            path,
            headers: { Origin: origin, "Content-Type": "application/json" },
        }, (res) => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, data }));
        });
        req.on("error", reject);
        req.end(body);
    });
}

async function run() {
    const calls = [];
    const gateway = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
            calls.push({ path: req.url, body, cookie: req.headers.cookie });
            if (req.url === "/cgi-bin/checklogin.cgi") {
                res.writeHead(200, { "Set-Cookie": "sid=secret; HttpOnly" });
                res.end("1");
            } else {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("UPNP;firmware;board");
            }
        });
    });
    const app = createServer();
    await listen(gateway);
    await listen(app);
    try {
        const port = app.address().port;
        const settings = JSON.stringify({
            gatewayIp: "127.0.0.1",
            gatewayPort: gateway.address().port,
            username: "admin",
            password: "example-secret",
        });

        assert.strictEqual((await request(port, "GET", "/")).status, 200);
        assert.strictEqual((await request(port, "GET", "/app.js")).status, 200);
        assert.strictEqual((await request(port, "POST", "/api/test", settings, "https://other.example")).status, 403);
        assert.strictEqual((await request(port, "POST", "/api/test", '{"gatewayIp":"invalid"}')).status, 400);
        assert.strictEqual((await request(port, "POST", "/api/test", "x".repeat(8193))).status, 413);
        assert.strictEqual(calls.length, 0);

        const result = await request(port, "POST", "/api/test", settings);
        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(JSON.parse(result.data), {
            login: true, health: true, messages: ["Gateway login returned code 1 and 1 cookie(s)"],
        });
        assert.ok(!result.data.includes("example-secret") && !result.data.includes("sid=secret"));
        assert.strictEqual(calls[0].path, "/cgi-bin/checklogin.cgi");
        assert.strictEqual(calls[1].path, "/cgi-bin/getinfo.cgi?type=getversion");
        assert.strictEqual(calls[1].cookie, "sid=secret");
    } finally {
        await close(app);
        await close(gateway);
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
