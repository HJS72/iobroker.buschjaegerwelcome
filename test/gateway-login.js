const assert = require("assert");
const http = require("http");
const axios = require("axios");

const requests = [];
const replies = [];
const client = {
    defaults: { headers: { common: {} } },
    post: async (...args) => {
        requests.push(args);
        const reply = replies.shift();
        if (reply instanceof Error) {
            throw reply;
        }
        assert.ok(reply, "Unexpected gateway request");
        return reply;
    },
};

const originalCreate = axios.create;
axios.create = () => client;
const { WelcomeClient } = require("../build/lib/welcomeClient");

async function run() {
    const gateway = new WelcomeClient("gateway.local", 443, "admin", "p@ss !'()*");
    const logs = [];
    gateway.setLogger((message) => logs.push(message));

    replies.push({
        status: 200,
        data: 1,
        headers: { "set-cookie": ["sid=secret; HttpOnly", "other=value; Path=/"] },
    });
    assert.strictEqual(await gateway.login(), true);
    assert.deepStrictEqual(requests[0], [
        "/cgi-bin/checklogin.cgi",
        { username: "admin", password: "p%40ss%20%21%27%28%29%2A" },
    ]);
    assert.strictEqual(client.defaults.headers.common.Cookie, "sid=secret; other=value");

    replies.push({ status: 200, data: { uuid: "gateway-id" }, headers: {} });
    assert.strictEqual(await gateway.checkHealth(), true);
    assert.strictEqual(requests[1][0], "/cgi-bin/portalclient.cgi");
    assert.strictEqual(requests[1][1], '{"op":"6"}');
    assert.strictEqual(requests[1][2].headers["Content-Type"], "application/x-www-form-urlencoded");

    replies.push({ status: 200, data: "<html>login</html>", headers: {} });
    assert.strictEqual(await gateway.checkHealth(), false);

    replies.push({ status: 200, data: "0", headers: { "set-cookie": ["sid=secret"] } });
    assert.strictEqual(await gateway.login(), false);
    assert.strictEqual(client.defaults.headers.common.Cookie, undefined);
    assert.strictEqual(await gateway.checkHealth(), false);

    replies.push({ status: 200, data: 2, headers: {} });
    assert.strictEqual(await gateway.login(), false);
    assert.ok(logs.every((message) => !message.includes("secret") && !message.includes("p@ss")));
    assert.strictEqual(replies.length, 0);
}

async function runHttp() {
    const received = [];
    const server = http.createServer((request, response) => {
        let body = "";
        request.on("data", (chunk) => { body += chunk; });
        request.on("end", () => {
            received.push({ url: request.url, headers: request.headers, body });
            if (request.url === "/cgi-bin/checklogin.cgi") {
                response.writeHead(200, { "Set-Cookie": "sid=example; HttpOnly" });
                response.end("1");
            } else {
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end('{"uuid":"gateway-id"}');
            }
        });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const gateway = new WelcomeClient("127.0.0.1", server.address().port, "admin", "test password");
        assert.strictEqual(await gateway.login(), true);
        assert.strictEqual(await gateway.checkHealth(), true);
        assert.strictEqual(received[0].url, "/cgi-bin/checklogin.cgi");
        assert.deepStrictEqual(JSON.parse(received[0].body), { username: "admin", password: "test%20password" });
        assert.strictEqual(received[1].headers.cookie, "sid=example");
        assert.strictEqual(received[1].body, '{"op":"6"}');
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

run().then(() => {
    axios.create = originalCreate;
    return runHttp();
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    axios.create = originalCreate;
});
