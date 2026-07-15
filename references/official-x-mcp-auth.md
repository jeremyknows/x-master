# Official X MCP auth + Hermes wiring notes

Use when connecting the official X API MCP (`https://api.x.com/mcp`) through `xurl mcp`, especially on Jeremy/Atlas machines that already have xint credentials.

## Known-good flow

1. Check existing xint auth first:
   ```bash
   HOME=/Users/watson PATH=/opt/homebrew/bin:/Users/watson/.local/bin:$PATH xint auth status
   ```
   If authenticated, the same X app credentials may already live in `~/.xint/.env` as `X_CLIENT_ID`, `X_CLIENT_SECRET`, and often `X_BEARER_TOKEN`.

2. Register/update the app in xurl using those credentials:
   ```bash
   HOME=/Users/watson PATH=/Users/watson/.local/bin:$PATH bash -lc '
     set -a
     . /Users/watson/.xint/.env
     set +a
     npx -y @xdevplatform/xurl auth apps add atlas-x \
       --client-id "$X_CLIENT_ID" \
       --client-secret "$X_CLIENT_SECRET" \
       --redirect-uri http://127.0.0.1:3333/callback || true
     npx -y @xdevplatform/xurl auth apps update atlas-x \
       --client-id "$X_CLIENT_ID" \
       --client-secret "$X_CLIENT_SECRET" || true
     npx -y @xdevplatform/xurl auth apps redirect-uri set atlas-x http://127.0.0.1:3333/callback
     npx -y @xdevplatform/xurl auth default atlas-x
   '
   ```

3. Start headless OAuth and have Jeremy paste back the full redirected URL or just `code=`:
   ```bash
   HOME=/Users/watson PATH=/Users/watson/.local/bin:$PATH \
     npx -y @xdevplatform/xurl auth oauth2 --app atlas-x --headless
   ```

4. Verify account auth:
   ```bash
   HOME=/Users/watson PATH=/Users/watson/.local/bin:$PATH \
     npx -y @xdevplatform/xurl whoami
   ```

5. Verify MCP tool discovery before claiming ready:
   ```bash
   HOME=/Users/watson PATH=/Users/watson/.local/bin:$PATH \
     npx -y mcporter list --stdio 'npx -y @xdevplatform/xurl mcp https://api.x.com/mcp' --name xapi --schema
   ```

6. Smoke the MCP server with a harmless read:
   ```bash
   HOME=/Users/watson PATH=/Users/watson/.local/bin:$PATH \
     npx -y mcporter call --stdio 'npx -y @xdevplatform/xurl mcp https://api.x.com/mcp' get_users_me --output json
   ```

## Callback mismatch pitfall

X docs default to `http://localhost:8080/callback`, but the existing Atlas/xint X app may be registered for `http://127.0.0.1:3333/callback`. If the browser says something is wrong with the callback, do not retry the same URL. Inspect/set xurl's stored redirect URI:

```bash
npx -y @xdevplatform/xurl auth apps list
npx -y @xdevplatform/xurl auth apps redirect-uri set atlas-x http://127.0.0.1:3333/callback
```

Then restart the headless OAuth flow so the authorize URL contains the registered callback.

## Hermes MCP config pitfall

`hermes mcp add` may connect successfully but then prompt interactively to enable tools, causing a non-interactive run to cancel without saving. Also, `hermes config set mcp_servers.xapi.args '[...]'` can serialize the list as a string, which makes MCP validation fail (`args Input should be a valid list`). If that happens, edit through a safe YAML-aware path or verify the final YAML has an actual list:

```yaml
mcp_servers:
  xapi:
    command: /opt/homebrew/bin/npx
    args:
    - -y
    - @xdevplatform/xurl
    - mcp
    - https://api.x.com/mcp
    enabled: true
    connect_timeout: 300
    timeout: 180
  x_docs:
    url: https://docs.x.com/mcp
    enabled: true
    connect_timeout: 60
    timeout: 120
```

Verify with:

```bash
hermes -p sax mcp list
hermes -p sax mcp test xapi
hermes -p sax mcp test x_docs
```

A live conversation/session may still need `/reload-mcp`, `/new`, or gateway restart before newly configured MCP tools appear as native first-class tools.