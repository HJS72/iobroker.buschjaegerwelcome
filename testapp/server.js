const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { WelcomeClient } = require("../build/lib/welcomeClient");

const files = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};

function createServer() {
    const server = http.createServer((request, response) => {
        const origin = `http://127.0.0.1:${server.address().port}`;
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'");

        if (request.headers.host !== new URL(origin).host) {
            response.writeHead(403).end("Forbidden");
            return;
        }

        const file = files[request.url];
        if (request.method === "GET" && file) {
            fs.readFile(path.join(__dirname, file[0]), (error, content) => {
                if (error) {
                    console.error(`Cannot read ${file[0]}: ${error.message}`);
                    response.writeHead(500).end("Internal error");
                    return;
                }
                response.writeHead(200, { "Content-Type": file[1] }).end(content);
            });
            return;
        }

        if (request.method !== "POST" || request.url !== "/api/test") {
            response.writeHead(404).end("Not found");
            return;
        }
        if (request.headers.origin !== origin || request.headers["content-type"] !== "application/json") {
            response.writeHead(403).end("Forbidden");
            return;
        }

        let body = "";
        let size = 0;
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            size += Buffer.byteLength(chunk);
            if (size > 8192) {
                response.writeHead(413).end("Request too large");
                request.removeAllListeners("data");
                request.resume();
            } else {
                body += chunk;
            }
        });
        request.on("end", async () => {
            if (response.writableEnded) {
                return;
            }
            let settings;
            try {
                settings = JSON.parse(body);
            } catch {
                response.writeHead(400).end("Invalid JSON");
                return;
            }
            if (!settings || net.isIP(settings.gatewayIp) !== 4 ||
                !Number.isInteger(settings.gatewayPort) || settings.gatewayPort < 1 || settings.gatewayPort > 65535 ||
                typeof settings.username !== "string" || !settings.username ||
                typeof settings.password !== "string" || !settings.password) {
                response.writeHead(400).end("Invalid gateway settings");
                return;
            }

            const gateway = new WelcomeClient(
                settings.gatewayIp, settings.gatewayPort, settings.username, settings.password,
            );
            const messages = [];
            gateway.setLogger((message) => messages.push(message));
            try {
                const login = await gateway.login();
                const health = login ? await gateway.checkHealth() : null;
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" })
                    .end(JSON.stringify({ login, health, messages }));
            } catch {
                console.error("Gateway test failed unexpectedly");
                response.writeHead(500).end("Gateway test failed");
            } finally {
                gateway.close();
            }
        });
    });
    return server;
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error("PORT must be an integer from 1 to 65535");
        process.exitCode = 1;
    } else {
        const server = createServer();
        server.on("error", (error) => {
            console.error(`Cannot start test app: ${error.message}`);
            process.exitCode = 1;
        });
        server.listen(port, "127.0.0.1", () => {
            console.log(`Gateway test: http://127.0.0.1:${port}/`);
        });
    }
}

module.exports = { createServer };
