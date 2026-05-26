# xint live reply smoke pattern

Use this when a user authorizes a read-only X/Twitter reply sample for a specific tweet and wants local artifacts/recommendations without any X engagement.

## Scope guard

- Read-only only: no posting, liking, replying, bookmarking, following, or giveaway execution.
- Name the sample type precisely: `recent API sample` when using recent search pages. Do not imply full conversation coverage unless all pages were fetched and validated.
- Recommendation labels are internal human-review guidance only unless the user separately authorizes execution.

## Recommended sequence

1. Verify the root tweet through fxtwitter (`https://api.fxtwitter.com/{user}/status/{id}`), not raw x.com.
2. Preflight `xint` and capture cost state before search.
3. If the local xint budget blocks the approved read-only search and the operator already authorized reset/continuation, capture budget before reset, run the local reset, and record that caveat in the summary.
4. Fetch replies with one recent-search page for first smoke:
   ```bash
   xint search "conversation_id:<tweet_id> is:reply" --json --sort recent --pages 1 --limit <cap>
   ```
   Note: `--limit` caps displayed/output tweets, not necessarily billable page read volume.
5. Preserve raw output and also write a pure JSON payload file if command/timestamp wrappers were added around stdout.
6. Normalize into JSONL with at least: reply id, created_at, username/name, tweet_url, text, metrics, extracted wallets, label, score/reasons.
7. Extract wallet candidates conservatively:
   - ETH addresses: `0x` + 40 hex chars.
   - ENS/domain candidates: prefer `.eth`; treat other wallet-like domains cautiously.
8. Split artifacts into candidates and rejects/no-wallet.
9. Build a CSV for human review and validate counts/schema before reporting.
10. Summary must include: sample type, page count, output cap, xint internal-found count if available, normalized count, candidate/reject counts, top recommendations, artifact paths, and caveats.
11. For Dispatch/Command Deck lanes, send a concise Dispatch-back with artifact paths and counts, fetch the Dispatch receipt, then emit raw `task_completed` with the inbound Dispatch kickoff message ID as `task_id`.

## Artifact set

Use a stable local directory with these files when possible:

- `root_tweet_fxtwitter.json`
- `preflight.txt`
- `cost_reset.txt` when used
- `raw_replies_xint.json`
- `raw_replies_xint_payload.json`
- `xint_search.stderr`
- `normalized_replies.jsonl`
- `wallet_candidates.jsonl`
- `wallet_rejects.jsonl`
- `validated_wallet_recommendations.csv`
- `summary.md`
- `summary.json`
- `checksums.sha256`

## Caveat language

Suggested wording:

> This is a recent API sample, not full conversation coverage. xint may return/report more tweets internally than the capped output artifact. Recommendation labels are internal human-review guidance only; no X engagement or automated giveaway execution was performed.
