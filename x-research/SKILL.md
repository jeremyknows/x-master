---
name: x-research
description: >
  Deep X/Twitter research agent. Searches X for real-time discourse, expert perspectives,
  product feedback, dev discussions, cultural takes, and breaking news.
  Use when: (1) "search x for", "what are people saying about", "what's twitter saying",
  "x research", "check x for" (2) recent X discourse would add useful context to a topic
  (library releases, API changes, launches, industry drama) (3) need to understand
  what devs/experts/community thinks about something.
  NOT for: posting tweets, account management, or archive searches beyond 7 days.
  Routes through x-master for reading tweets by URL — use fxtwitter for that.
compatibility: Requires node (v18+). X_BEARER_TOKEN env var must be set.
metadata:
  based_on: rohunvora/x-research-skill v2.3.0
  version: 1.0.0
  tags:
    - x
    - twitter
    - research
    - search
---

# X Research

Deep agentic research over X/Twitter. Decompose research questions into targeted searches, iteratively refine, follow threads, deep-dive linked content, synthesize into sourced briefings.

For X API details (endpoints, operators, costs, rate limits): read `references/x-api.md`.

## Setup

Requires `X_BEARER_TOKEN` to be set in your environment:

```bash
export X_BEARER_TOKEN=your_token_here
```

All CLI commands run from the skill directory:

```bash
cd path/to/x-master/x-research
```

## CLI Tool

### Search

```bash
node x-search.js search "<query>" [options]
```

**Options:**
- `--sort likes|impressions|retweets|recent` — sort order (default: likes)
- `--since 1h|3h|12h|1d|7d` — time filter (default: last 7 days). Also accepts `30m` or ISO timestamps.
- `--min-likes N` — filter by minimum likes
- `--min-impressions N` — filter by minimum impressions
- `--pages N` — pages to fetch, 1–5 (default: 1, 100 tweets/page)
- `--limit N` — max results to display (default: 15)
- `--quick` — quick mode: 1 page, max 10 results, auto noise filter, 1hr cache
- `--from <username>` — shorthand for `from:username` in query
- `--quality` — post-hoc filter: min 10 likes
- `--no-replies` — exclude replies
- `--save` — save results to `./output/` (relative to skill dir, portable)
- `--json` — raw JSON output
- `--markdown` — markdown output

Auto-adds `-is:retweet` unless already in query. All searches display estimated cost.

**Examples:**
```bash
node x-search.js search "BNKR" --sort likes --limit 10
node x-search.js search "from:frankdegods" --sort recent
node x-search.js search "(claude opus) trading" --pages 2 --save
node x-search.js search "AI agents" --quality --quick
node x-search.js search "BNKR" --from voidcider --quick
```

### Profile

```bash
node x-search.js profile <username> [--count N] [--replies] [--json]
```

### Thread

```bash
node x-search.js thread <tweet_id> [--pages N]
```

### Single Tweet

```bash
node x-search.js tweet <tweet_id> [--json]
```

### Cache

```bash
node x-search.js cache clear    # Clear all cached results
```

15-minute TTL. Cache stored in `./data/cache/` (relative to skill dir).

---

## Research Loop (Agentic)

When doing deep research (not just a quick lookup), follow this loop:

### 1. Decompose the Question into Queries

Turn the research question into 3–5 keyword queries using X search operators:

- **Core query**: Direct keywords for the topic
- **Expert voices**: `from:` specific known experts
- **Pain points**: `(broken OR bug OR issue OR migration)`
- **Positive signal**: `(shipped OR love OR fast OR benchmark)`
- **Links**: `url:github.com` or `url:` specific domains
- **Noise reduction**: `-is:retweet` (auto-added), add `-is:reply` if needed
- **Crypto spam**: Add `-airdrop -giveaway -whitelist` if flooding results

### 2. Search and Extract

Run each query. After each, assess:
- Signal or noise? Adjust operators.
- Key voices worth searching `from:` specifically?
- Threads worth following?
- Linked resources worth fetching with `web_fetch`?

### 3. Follow Threads

When a tweet has high engagement or starts a thread:
```bash
node x-search.js thread <tweet_id>
```

### 4. Deep-Dive Linked Content

When tweets link to GitHub, blog posts, or docs, fetch them. Prioritize links that:
- Multiple tweets reference
- Come from high-engagement tweets
- Point to resources directly relevant to the question

### 5. Synthesize

Group findings by theme, not by query:

```
### [Theme/Finding]

[1–2 sentence summary]

- @username: "[key quote]" (likes, impressions) [Tweet](url)
- @username2: "[another perspective]" [Tweet](url)

Resources shared:
- [Resource title](url) — [what it is]
```

### 6. Save

Use `--save` to auto-save, or save manually:
```bash
node x-search.js search "topic" --markdown --save
```
Output goes to `./output/x-research-{slug}-{date}.md` — portable, no hardcoded paths.

---

## Refinement Heuristics

- **Too much noise?** Add `-is:reply`, use `--sort likes`, narrow keywords
- **Too few results?** Broaden with `OR`, remove restrictive operators
- **Crypto spam?** Add `-$ -airdrop -giveaway -whitelist`
- **Expert takes only?** Use `from:` or `--min-likes 50`
- **Substance over hot takes?** Add `has:links`

---

## File Structure

```
x-master/x-research/
├── SKILL.md            (this file)
├── x-search.js         (CLI entry point — node, no bun required)
├── lib/
│   ├── api.js          (X API v2 wrapper)
│   ├── cache.js        (file-based cache, 15min TTL)
│   └── format.js       (terminal + markdown formatters)
├── data/
│   └── cache/          (auto-managed, .gitignore this)
├── output/             (--save results land here)
└── references/
    └── x-api.md        (X API endpoint + pricing reference)
```
