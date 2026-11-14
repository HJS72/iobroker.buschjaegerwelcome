const assert = require("assert");
const http = require("http");
const axios = require("axios");

const requests = [];
const replies = [];
const client = {
    defaults: { headers: { common: {} } },
    post: async (...args) => request(...args),
    get: async (...args) => request(...args),
};
function request(...args) {
    requests.push(args);
    const reply = replies.shift();
    if (reply instanceof Error) {
        throw reply;
    }
    assert.ok(reply, "Unexpected gateway request");
    return reply;
}

const originalCreate = axios.create;
let axiosOptions;
axios.create = (options) => {
    axiosOptions = options;
    return client;
};
const { WelcomeClient } = require("../build/lib/welcomeClient");

async function run() {
    const gateway = new WelcomeClient("gateway.local", 443, "admin", "p@ss !'()*");
    assert.strictEqual(axiosOptions.httpsAgent.keepAlive, true);
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
        '{"username":"admin","password":"p%40ss%20%21%27%28%29%2A"}',
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: "https://gateway.local",
                Referer: "https://gateway.local/",
            },
        },
    ]);
    assert.strictEqual(client.defaults.headers.common.Cookie, "sid=secret; other=value");

    replies.push({ status: 200, data: "UPNP;firmware;board", headers: {} });
    assert.strictEqual(await gateway.checkHealth(), true);
    assert.strictEqual(requests[1][0], "/cgi-bin/getinfo.cgi?type=getversion");
    assert.strictEqual(requests[1][1].headers.Referer, "https://gateway.local/config.html?v=0.1");

    replies.push({ status: 200, data: "<html>login</html>", headers: {} });
    assert.strictEqual(await gateway.checkHealth(), false);
    replies.push({ status: 200, data: "-6", headers: {} });
    assert.strictEqual(await gateway.checkHealth(), false);
    assert.ok(logs.some((message) => message.includes("session rejected (-6)")));
    replies.push({ status: 200, data: "version;;board", headers: {} });
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
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("UPNP;firmware;board");
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
        assert.strictEqual(received[1].url, "/cgi-bin/getinfo.cgi?type=getversion");
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
