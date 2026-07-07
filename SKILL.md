---
name: x-master
description: Master routing skill for all X/Twitter operations — reading, researching, posting, and engaging. Routes to the correct sub-tool based on the task. Covers reading tweets by URL, searching X, trend research, posting tweets/replies, and handling mentions.
license: MIT
compatibility: Requires fxtwitter API access. All X/Twitter operations route through this skill.
metadata:
  author: x-master-contributors
  version: 1.1.0
  tags:
    - x
    - twitter
    - social-media
    - routing
    - content
---

# X Master Skill — Master Routing for X/Twitter Operations

This skill is the single entry point for all X/Twitter work. Read it first, then route to the correct sub-tool based on your task. Never attempt raw x.com fetches. Never guess at routing.

---

## ⚠️ ABSOLUTE RULE: Never fetch x.com directly

Direct `web_fetch` of x.com or twitter.com URLs will fail silently or return garbage.

**Always use fxtwitter for reading tweet content:**
```
https://api.fxtwitter.com/{username}/status/{tweet_id}
```

Extract `username` and `tweet_id` from the x.com URL:
- `https://x.com/example/status/1234567890` → `api.fxtwitter.com/example/status/1234567890`
- `https://twitter.com/example/status/1234567890` → same pattern

This is a hard rule. No exceptions. See `references/fxtwitter-pattern.md` for full details.

---

## Account Configuration

This skill routes posting operations to one or more X accounts. Before using, configure your target account(s):

| Configuration | What It Means | Approval Required? |
|---------------|---------------|--------------------|
| Single account | All posts go to one account | Yes — always. Get human approval before posting. |
| Multiple accounts | Route based on content type | Yes — always. Confirm account + text before posting. |
| Draft-only mode | Generate drafts, never auto-post | Recommended for new users. Learn the flow first. |

**Golden rule:** Never post autonomously to X. Always draft first, get human approval before publishing.

Posting flow:
1. Draft the post in your voice
2. Share draft with the human for approval (via chat, email, or local review)
3. Only after approval: execute posting script
4. Log the URL and confirmation

---

## Task Router

### 1. Read a tweet or thread by URL
**Tool:** fxtwitter API via `web_fetch`
**When:** You have an x.com/twitter.com link and need to read the content
**How:**
```
web_fetch("https://api.fxtwitter.com/{username}/status/{id}")
```
**Response includes:** full text, author, engagement stats, media URLs, thread context via `reply_to`

**If fxtwitter is unavailable** (5xx errors or timeout): fall back to `x-research` (`node x-research/x-search.js tweet <id>`) for tweet content retrieval.

**fxtwitter error responses:**

| Response | Cause | Action |
|----------|-------|--------|
| `{"code": 404}` | Tweet deleted or doesn't exist | Inform user tweet not found |
| `{"code": 401}` | Protected account | Cannot access — inform user |
| Empty response | Network issue | Retry once, then report failure |
| No `.article` field | Not an X Article | Use `.tweet.text` for a regular tweet |
| 5xx | Service down | See the 5xx fallback chain above and in Gotchas |

**X Articles (long-form posts):** check the `.tweet.article` field. If present, extract content
from `.tweet.article.content.blocks[] | select(.text) | .text` and summarize from that, not the
root tweet text — X Article posts commonly have a root `.tweet.text` that is only a `t.co` link,
so an empty/short root tweet is not the whole content until `tweet.article.content.blocks` is
inspected.

**Fetching/saving many X links at once:** if a user provides several X URLs and explicitly asks to
fetch/read/save all of them, use the batch pattern at `references/batch-x-resource-fetch.md`
(stable resource folder, raw JSON preserved per link, a `fetch-records.json` manifest, and
category-coverage checks so no link is silently skipped).

**When NOT to fetch:**
- User shared the link without asking about content and it has no operational/safety implication
- Link is in quoted/referenced context (not a direct ask)
- Multiple links present — ask which one to fetch

**Exception:** if the user shares an X link as an operational warning (security advisory, outage,
dependency compromise, active incident) and the answer depends on the warning's content, fetch the
linked post with minimal disclosure so you can ground the safety posture.

---

### 2. Search X for real-time opinions or discourse
**Tool:** `xai-grok-search` skill
**When:** "What are people saying about X", "search X for Y", real-time pulse check, breaking news context
**Notes:**
- Responses may take 30–60s (involves reasoning)
- Results include citations with URLs
- Use for real-time social sentiment

---

### 3. Deep X research — threads, profiles, discourse
**Tool:** `x-research` (bundled at `x-master/x-research/`)
**When:** Need to research a topic across many tweets, follow a conversation, understand discourse depth, or cache results
**How:** Read `x-research/SKILL.md` then run `node x-research/x-search.js`
**Supports:** Filtering by handle, sorting by engagement, `--quick` mode, saving results to `./output/`

---

### 4. Multi-platform trend research (last 30 days)
**Tool:** `last30days-skill`
**When:** "What's trending about X topic", understanding broader cultural moments across Reddit + X + HN + YouTube
**Triggers:** Trend research requests, topic popularity analysis

---

### 5. Post a tweet, reply, or quote tweet
**Tool:** Custom posting script (see Setup)
**When:** Any posting action. Always requires human approval first.

**Posting flow:**
1. Draft the tweet in your voice
2. Share draft with human for approval
3. After approval: execute posting script
4. Log the URL in your conversation/record

**Never skip the approval step.** Even if you think you have permission, confirm the exact text before executing.

> ⚠️ **x-post.js status: not bundled by default** — `scripts/x-post.js` is referenced below but is NOT included in this skill package. You must provide your own implementation or use `xint` CLI for posting. See Key Resources table for alternatives.

#### Quote tweet error handling (MANDATORY)
If `x-post.js quote` returns HTTP 403 "Quoting this post is not allowed":
1. **Like the target post first:** `node x-post.js like <tweet_id> --account <account>`
2. **Retry the quote tweet** — liking establishes interaction and unblocks the API
3. Only fall back to a standalone tweet if the retry also fails

Do NOT silently fall back to standalone on the first 403. Always try like → retry first.

#### Thread posting with images
When posting a thread where tweet 1 is a quote tweet and tweets 2–N have images:
- Images go in `/tmp/` by default when downloaded during the session
- Use `--media /path/to/image.jpg` flag on the reply command
- Chain replies using the `id` field from each JSON response as the next `reply_to` ID
- The `@mention` prepended by X on replies is normal — it won't affect rendering for followers

#### Humanizing AI-drafted threads before posting
For any tweet thread drafted by an AI (including Watson), run it through the humanizer skill first:
1. Install: `Install humanizer from ClaHub or your skill catalog to your agent's skills directory`
2. Spawn a subagent to apply the skill to the full thread text
3. Key patterns it catches: em dashes, "groundbreaking/legendary" marketing language, overly abstract metaphors ("compounds"), passive voice
4. Always preserve specific facts (dates, prices, names, URLs) through the humanizer pass

---

### 6. Handle mentions / replies to your account
**Tool:** `x-engage` skill
**When:** Your account receives a mention, reply, or engagement
**Notes:**
- Drafts replies automatically
- Always get human approval before posting
- Provides thread context for informed responses

---

### 7. Official X MCP / Docs MCP (hosted MCP servers)
**Tool:** X-hosted MCP servers documented at `https://docs.x.com/tools/mcp`.
**When:** Connecting MCP-compatible agents/IDEs to X API capabilities or X developer docs.

Two hosted servers exist:
- **X MCP:** `https://api.x.com/mcp` — X API tools: post lookup, search/full archive, user lookup/timeline/mentions, bookmarks/folders, news/trends, Articles drafts/publish.
- **Docs MCP:** `https://docs.x.com/mcp` — docs tools: `search_x`, `query_docs_filesystem_x`, `submit_feedback`.

Authentication modes:
- **App-only Bearer:** direct remote HTTP with `headers.Authorization = "Bearer ..."`; read-only/no user context.
- **Full user context:** stdio bridge via `xurl mcp`; requires an X Developer app with OAuth 2.0 enabled, `CLIENT_ID`, `CLIENT_SECRET`, and registered redirect URI `http://localhost:8080/callback` unless `REDIRECT_URI` is overridden. First run may open browser; headless machines should pre-auth with `xurl auth oauth2 --headless`.

Generic stdio config:
```json
{
  "mcpServers": {
    "xapi": {
      "command": "npx",
      "args": ["-y", "@xdevplatform/xurl", "mcp", "https://api.x.com/mcp"],
      "env": {
        "CLIENT_ID": "YOUR_X_APP_CLIENT_ID",
        "CLIENT_SECRET": "YOUR_X_APP_CLIENT_SECRET"
      }
    },
    "x-docs": {
      "url": "https://docs.x.com/mcp"
    }
  }
}
```

Hermes config shape:
```yaml
mcp_servers:
  xapi:
    command: "npx"
    args: ["-y", "@xdevplatform/xurl", "mcp", "https://api.x.com/mcp"]
    env:
      CLIENT_ID: "..."
      CLIENT_SECRET: "..."
    connect_timeout: 300
  x_docs:
    url: "https://docs.x.com/mcp"
```

Gotchas:
- `api.x.com/mcp` does not advertise native MCP OAuth discovery; use `xurl mcp` for OAuth/user-context flows.
- X full-archive search (`search_posts_all` / `/2/tweets/search/all`) rejects OAuth 2.0 user-context auth with 403 `Unsupported Authentication`; it requires OAuth 2.0 application-only bearer auth. If the `xurl mcp` bridge connects but full-archive calls fail, use app-only bearer direct HTTP / app-only remote MCP, or `xint search --full --confirm` with `X_BEARER_TOKEN`.
- Existing Atlas/xint credentials may already be present in `~/.xint/.env`; check `xint auth status` and reuse `X_CLIENT_ID` / `X_CLIENT_SECRET` before asking Jeremy for new app credentials.
- Callback mismatch is common: X docs default to `http://localhost:8080/callback`, while the existing Atlas app may be registered for `http://127.0.0.1:3333/callback`. If the user sees a callback error, set `xurl auth apps redirect-uri set <app> http://127.0.0.1:3333/callback` and restart the OAuth flow.
- Keep stdout clean JSON-RPC: do not run bridge with verbose output in an MCP client.
- `npx` stale/private-registry issue: add `--registry=https://registry.npmjs.org/` to args if needed.
- Treat `~/.xurl`, `~/.xint`, and cached OAuth tokens as secrets.
- X docs say clients need a startup timeout ≥300s for first-run browser auth; Hermes uses `connect_timeout`.
- Hermes config pitfall: `hermes mcp add` may prompt and cancel in non-interactive sessions, and `hermes config set ...args '[...]'` can serialize args as a string. Verify `args` is a YAML list and run `hermes -p <profile> mcp test xapi` before claiming native MCP is wired.

Session-specific detail: see `references/official-x-mcp-auth.md` for the Atlas/xint-to-xurl auth bridge, callback correction, Hermes config shape, and verification commands.

### 8. Direct X API v2 calls / advanced operations
**Tool:** `xint` CLI ([xint-rs](https://github.com/0xNyk/xint-rs)) — single Rust binary, 2.5MB, <5ms startup
**When:** Full-text search, real-time monitoring, follower tracking, bookmarks, AI analysis, media download, filtered streams, anything not covered above, especially when you need a non-MCP CLI workflow or existing Atlas xint cost ledger behavior.
**Requires:** `X_BEARER_TOKEN` (read ops) + `X_CLIENT_ID` + `xint auth setup` (write/OAuth ops)

**Install:**
```bash
brew tap 0xNyk/xint && brew install xint
# or: curl -fsSL https://raw.githubusercontent.com/0xNyk/xint-rs/main/install.sh | bash
```

**Key commands:**
```bash
xint search "AI agents" --since 1h --sort likes   # search with filters
xint watch "topic" -i 5m                           # real-time monitor
xint bookmarks                                      # read bookmarks (OAuth)
xint analyze "What's trending in crypto?"          # Grok AI analysis
xint report "topic" --save                         # full trend report
xint diff @username                                 # follower tracking
xint stream                                         # filtered stream
xint capabilities --json                            # machine-readable manifest
xint mcp                                            # MCP server mode
```

**Cost:** ~$0.005/tweet read, $0.01/full-archive tweet, $0.01/write action. Track with `xint costs`.

**Note:** `xint bookmarks` (OAuth) can replace `bookmark-poll.js` for a simpler pipeline. Consider migrating.

---

## Gotchas

- **fxtwitter 5xx errors** — Community service; no SLA. On 5xx, wait 30s and retry once. If still failing, fall back to `x-research` (bundled) or `xint` with `X_BEARER_TOKEN`. Do not attempt raw x.com fetch.
- **Quote-tweet 403** — Quoting a protected/deleted tweet returns 403. Like the post first and retry (see Task 5). Fall back to standalone tweet only if retry also fails.
- **OAuth split: 1.0a vs 2.0** — `x-post.js` uses OAuth 1.0a (write access). `x-research` / xint use OAuth 2.0 Bearer (read-only). Token manager handles 1.0a; `X_BEARER_TOKEN` env var handles 2.0.
- **Humanizer path** — Humanizer skill installs to your agent's skills directory. Verify path if you see "skill not found" errors during thread humanization.
- **fxtwitter fallback chain** — Priority order: `fxtwitter` → `xint` (if `X_BEARER_TOKEN` present and binary installed) → `x-research` (bundled). Use in that order.
- **Rate limits** — Twitter API v2 free tier: 500k tweets/month read; 1,500 posts/month write. Track spend; `xint costs` shows xint-specific usage (~$0.005/tweet).
- **Algo-intel expiry** — Algorithm intelligence last verified 2026-03-13. If today > 2026-06-13, treat engagement weight specifics as provisional until refreshed.

---

## Decision Tree (Quick Reference)

```
Got an x.com URL?
  → Read it: fxtwitter (NEVER direct web_fetch)

Need to search X for discourse?
  → Real-time pulse: xai-grok-search
  → Deep thread context: x-research (bundled)
  → Last 30 days across platforms: last30days-skill

Need to post/reply?
  → Draft → get human approval → execute script

Received a mention/reply?
  → x-engage (generates draft, awaits approval)

Need MCP-native X API/docs access?
  → Official X MCP (`https://api.x.com/mcp`) via `xurl mcp` bridge for OAuth/user context, or App-only Bearer direct HTTP for read-only
  → Official Docs MCP (`https://docs.x.com/mcp`) for X API docs search/read

Need raw CLI/API access, monitoring, bookmarks, follower tracking, AI analysis outside MCP?
  → xint CLI (xint-rs) — single binary, covers search/watch/bookmarks/analyze/stream/MCP
```

---

## Key Resources

| Resource | Location | Purpose |
|----------|----------|---------|
| Official X MCP docs | https://docs.x.com/tools/mcp | X-hosted X API MCP + Docs MCP setup, auth modes, client configs |
| Official X API MCP server | `https://api.x.com/mcp` | Hosted Streamable HTTP MCP server for X API tools; use `xurl mcp` bridge for OAuth user context |
| Official X Docs MCP server | `https://docs.x.com/mcp` | Hosted docs-search MCP server (`search_x`, docs filesystem query, feedback) |
| fxtwitter pattern | `references/fxtwitter-pattern.md` | How and why to use fxtwitter; error handling |
| Algorithm intelligence | `references/algo-intel.md` | 2026 X ranking signals, engagement weights, strategy |
| Skill dependencies | README.md § Sub-Skills | What to install and when |
| Account config template | `config/accounts.json.example` | Starting point for posting setup |
| Posting script | `scripts/x-post.js` (if bundled) | Executes approved posts |
| xint CLI | https://github.com/0xNyk/xint-rs | Search, watch, bookmarks, AI analysis, MCP, streams |
| x-engage skill docs | `x-engage/` (your skills dir) | Mention handling pipeline |

## What Was Deprecated / Removed from X Tooling

If you're migrating from older X agent setups, be aware:

| Tool/Pattern | Status | Replacement |
|-------------|--------|-------------|
| Herald/Barker agent | Deprecated — purpose-built X agents are fragile | x-engage skill handles mentions |
| x-twitter-api npm package | Deleted — third-party duplicate | xint CLI (xint-rs) |
| x-react.js / x-poll.js | Archived — standalone reaction scripts | Covered by xint |
| xurl skill | Superseded by xint-rs — faster, more capable, ships MCP server | xint CLI (xint-rs) |
| Direct x.com web_fetch | Never worked reliably | fxtwitter (mandatory) |

---

## Algorithm Intelligence (Updated 2026-03-13)

*For full details, see `references/algo-intel.md`*

### Key Takeaways
- **Engagement hierarchy:** Replies (27x) and conversations (150x) beat likes *(human accounts — see note below)*
- **Velocity window:** Posts live or die in first 30 minutes
- **Content format:** Native video > threads > articles > images > text
- **Account signals:** X Premium, verification, consistency matter
- **Posting frequency:** >5x/day triggers suppression

> ⚠️ **Bot/AI account note:** Engagement weights above apply to human accounts. AI assistant or bot accounts are weighted differently by the algorithm. See `references/algo-intel.md` § "Strategy by Account Type" for bot-specific guidance.

> ⚠️ **Freshness:** Algorithm data last verified 2026-03-13. If today is past 2026-06-13, check `references/algo-intel.md` for a newer version before relying on specific weights.

### For Best Results
- Lead with video (15–30s, captions, motion hook)
- Reply to your own posts within 15 minutes of publishing
- Post at your audience's peak times
- Engagement pods and clickbait are algorithmically penalized

---

*This skill was created for AI agents to route X/Twitter work correctly. Adapt the account routing and approval flow to your needs, but keep the fxtwitter rule and task router structure unchanged.*

*Version: 1.0.0 | License: MIT*
