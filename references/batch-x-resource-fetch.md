# Batch X resource fetching pattern

Use when a user provides many X URLs and explicitly asks to fetch/read/save all of them.

## Pattern

1. Create a stable resource folder, e.g. `references/YYYY-MM-DD-topic/`.
2. Save the input link set as `links.json` before fetching.
3. For each X URL, transform `https://x.com/<user>/status/<id>` to `https://api.fxtwitter.com/<user>/status/<id>`.
4. Save raw JSON under `raw/x/<category>-<n>-<user>-<id>.json`.
5. Parse both root tweet text and article blocks:
   - `.tweet.text`
   - `.tweet.article.content.blocks[] | select(.text) | .text`
6. Write a `fetch-records.json` manifest with URL, raw file, author, created_at, engagement stats, article flag, media count, and any fetch errors.
7. Write a human-readable `fetch-manifest.md` listing every URL and local file.
8. If synthesizing with subagents, pass the saved resource folder and require category coverage checks so no link is skipped.

## Pitfalls

- X Articles often have root tweet text that is just a `t.co` link. The real content is in `tweet.article.content.blocks`.
- Preserve raw JSON; extracted markdown/text is a convenience view, not the source of truth.
- fxtwitter can fail transiently; retry once and record failures explicitly instead of silently omitting links.
