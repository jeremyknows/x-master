# xint reply intake for giveaway/radar workflows

Use this when the task is to read replies to a known X/Twitter post without posting, liking, replying, bookmarking, or otherwise mutating the account.

## Read-only route

Given a root tweet ID or URL:

```bash
# Root tweet metadata
xint tweet <tweet_id> --json

# Replies with author handles, timestamps, conversation_id, entities, and public metrics
xint search "conversation_id:<tweet_id> is:reply" --json --sort recent --pages 5 --limit 500

# Convenience wrapper for root + conversation search (current versions may be terminal-only)
xint thread <tweet_id> --pages 5
```

Underlying X API v2 endpoint used by xint search/thread:

```text
GET https://api.x.com/2/tweets/search/recent
  ?query=conversation_id:<tweet_id>%20is:reply
  &max_results=100
  &tweet.fields=created_at,public_metrics,author_id,conversation_id,entities
  &expansions=author_id
  &user.fields=username,name,public_metrics
  &sort_order=recency
  &next_token=...
```

For older giveaways outside the recent-search window, use full archive deliberately:

```bash
xint search "conversation_id:<tweet_id> is:reply" --full --confirm --json --pages 5 --limit 500
```

## Expected normalized fields

`xint search --json` returns tweet objects with:

- `id`, `text`, `author_id`, `username`, `name`
- `created_at`, `conversation_id`, `tweet_url`
- `metrics.{likes,retweets,replies,quotes,impressions,bookmarks}`
- `urls`, `mentions`, `hashtags`
- `_meta` wrapper in JSON mode: `source`, `latency_ms`, `cached`, `api_endpoint`, `estimated_cost_usd`

## Practical checks before live collection

- Confirm the command is read-only: use `xint capabilities` and ensure the selected command is in `mode: read_only`.
- Check budget before high-volume pulls: `xint costs` and/or `xint health`.
  - If the daily budget is already exceeded, report **HOLD** and do not run the first live pull unless the source deck/operator explicitly approves an over-budget pull or raises/resets the budget.
  - A capped command like `--pages 1 --limit 25` limits displayed/processed results, but X recent-search billing may still be page-sized (commonly ~100 tweets / ~$0.50). Surface that cost caveat in the recommendation.
- If `X_BEARER_TOKEN` is absent from the current shell, check approved host config sources by presence/shape only before declaring auth missing. On Watson's Mac, the OpenClaw gateway LaunchAgent plist may contain the token; export it only for the exact read-only command and never print the value.
- Do not use OAuth engagement commands (`likes`, `like`, `bookmark`, `follow`, etc.) for reply intake.
- If a task explicitly says no live collection until a tweet/link is supplied, stop at route/schema/auth/budget reporting; do not run search/thread against sample tweets.

## Version pitfall

Some xint builds advertise `xint capabilities --json`, but the installed CLI may reject `--json` while plain `xint capabilities` still emits JSON. If `--json` fails with “unexpected argument '--json'”, rerun without the flag before declaring capabilities unavailable.
