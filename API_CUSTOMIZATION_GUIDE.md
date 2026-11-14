# Gateway API Configuration

The adapter uses `POST /cgi-bin/checklogin.cgi` for local gateway admin login and
`POST /cgi-bin/portalclient.cgi` with operation `6` for the authenticated health
check. The request format is based on the public
[ABB Welcome integration](https://github.com/rankjie/ha-abb-welcome); it has not
been verified against every firmware version.

Use the gateway's local administrator credentials, not the MyBuildings portal
credentials. For an HTTPS gateway using the standard port, set the gateway port
to 443. The adapter currently selects HTTPS only for port 443.

The door-opener and snapshot endpoints in `src/lib/welcomeClient.ts` are still
placeholders. Verify their paths, request formats, and responses against the
gateway before relying on these features.

To investigate compatibility, use browser developer tools to inspect requests
made by the gateway web interface. Do not share passwords, cookies, tokens,
authorization headers, or unredacted network captures. Debug logging reports
HTTP status or network error codes without logging login responses or cookies.
