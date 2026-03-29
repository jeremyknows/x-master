#!/usr/bin/env node
/**
 * x-search — CLI for X/Twitter research.
 *
 * Requires: X_BEARER_TOKEN env var
 *
 * Commands:
 *   search <query> [options]    Search recent tweets
 *   thread <tweet_id>           Fetch full conversation thread
 *   profile <username>          Recent tweets from a user
 *   tweet <tweet_id>            Fetch a single tweet
 *   cache clear                 Clear search cache
 *
 * Search options:
 *   --sort likes|impressions|retweets|recent   Sort order (default: likes)
 *   --since 1h|3h|12h|1d|7d   Time filter (default: last 7 days)
 *   --min-likes N              Filter by minimum likes
 *   --min-impressions N        Filter by minimum impressions
 *   --pages N                  Number of pages to fetch (default: 1, max 5)
 *   --no-replies               Exclude replies
 *   --limit N                  Max results to display (default: 15)
 *   --quick                    Quick mode: 1 page, noise filter, 1hr cache
 *   --from <username>          Shorthand for from:username in query
 *   --quality                  Post-hoc filter: min 10 likes
 *   --save                     Save results to ./output/ (relative to skill dir)
 *   --json                     Output raw JSON
 *   --markdown                 Output as markdown
 */

"use strict";

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const api = require("./lib/api");
const cache = require("./lib/cache");
const fmt = require("./lib/format");

const SKILL_DIR = __dirname;
const OUTPUT_DIR = join(SKILL_DIR, "output");

// --- Arg parsing ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0) { args.splice(idx, 1); return true; }
  return false;
}

function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) {
    const val = args[idx + 1];
    args.splice(idx, 2);
    return val;
  }
  return undefined;
}

// --- Commands ---

async function cmdSearch() {
  const quick = getFlag("quick");
  const quality = getFlag("quality");
  const fromUser = getOpt("from");
  const sortOpt = getOpt("sort") || "likes";
  const minLikes = parseInt(getOpt("min-likes") || "0");
  const minImpressions = parseInt(getOpt("min-impressions") || "0");
  let pages = Math.min(parseInt(getOpt("pages") || "1"), 5);
  let limit = parseInt(getOpt("limit") || "15");
  const since = getOpt("since");
  const noReplies = getFlag("no-replies");
  const save = getFlag("save");
  const asJson = getFlag("json");
  const asMarkdown = getFlag("markdown");

  if (quick) { pages = 1; limit = Math.min(limit, 10); }

  const queryParts = args.slice(1).filter((a) => !a.startsWith("--"));
  let query = queryParts.join(" ");

  if (!query) {
    console.error("Usage: x-search.js search <query> [options]");
    process.exit(1);
  }

  if (fromUser && !query.toLowerCase().includes("from:")) {
    query += ` from:${fromUser.replace(/^@/, "")}`;
  }
  if (!query.includes("is:retweet")) query += " -is:retweet";
  if (quick && !query.includes("is:reply")) query += " -is:reply";
  else if (noReplies && !query.includes("is:reply")) query += " -is:reply";

  const cacheTtlMs = quick ? 3_600_000 : 900_000;
  const cacheParams = `sort=${sortOpt}&pages=${pages}&since=${since || "7d"}`;
  const cached = cache.get(query, cacheParams, cacheTtlMs);
  let tweets;

  if (cached) {
    tweets = cached;
    console.error(`(cached — ${tweets.length} tweets)`);
  } else {
    tweets = await api.search(query, {
      pages,
      sortOrder: sortOpt === "recent" ? "recency" : "relevancy",
      since: since || undefined,
    });
    cache.set(query, cacheParams, tweets);
  }

  const rawTweetCount = tweets.length;

  if (minLikes > 0 || minImpressions > 0) {
    tweets = api.filterEngagement(tweets, { minLikes: minLikes || undefined, minImpressions: minImpressions || undefined });
  }
  if (quality) tweets = api.filterEngagement(tweets, { minLikes: 10 });
  if (sortOpt !== "recent") tweets = api.sortBy(tweets, sortOpt);
  tweets = api.dedupe(tweets);

  if (asJson) {
    console.log(JSON.stringify(tweets.slice(0, limit), null, 2));
  } else if (asMarkdown) {
    console.log(fmt.formatResearchMarkdown(query, tweets, { queries: [query] }));
  } else {
    console.log(fmt.formatResults(tweets, { query, limit }));
  }

  if (save) {
    if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
    const slug = query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    const outPath = join(OUTPUT_DIR, `x-research-${slug}-${date}.md`);
    writeFileSync(outPath, fmt.formatResearchMarkdown(query, tweets, { queries: [query] }));
    console.error(`\nSaved to ${outPath}`);
  }

  const cost = (rawTweetCount * 0.005).toFixed(2);
  const filtered = rawTweetCount !== tweets.length ? ` → ${tweets.length} after filters` : "";
  const sinceLabel = since ? ` | since ${since}` : "";
  if (quick) {
    console.error(`\n⚡ quick mode · ${rawTweetCount} tweets read (~$${cost})`);
  } else {
    console.error(`\n📊 ${rawTweetCount} tweets${filtered} · ~$${cost} | sorted by ${sortOpt} | ${pages} page(s)${sinceLabel}`);
  }
}

async function cmdThread() {
  const tweetId = args[1];
  if (!tweetId) { console.error("Usage: x-search.js thread <tweet_id>"); process.exit(1); }

  const pages = Math.min(parseInt(getOpt("pages") || "2"), 5);
  const tweets = await api.thread(tweetId, { pages });

  if (tweets.length === 0) { console.log("No tweets found in thread."); return; }

  console.log(`🧵 Thread (${tweets.length} tweets)\n`);
  for (const t of tweets) {
    console.log(fmt.formatTweet(t, undefined, { full: true }));
    console.log();
  }
}

async function cmdProfile() {
  const username = args[1]?.replace(/^@/, "");
  if (!username) { console.error("Usage: x-search.js profile <username>"); process.exit(1); }

  const count = parseInt(getOpt("count") || "20");
  const includeReplies = getFlag("replies");
  const asJson = getFlag("json");
  const { user, tweets } = await api.profile(username, { count, includeReplies });

  if (asJson) {
    console.log(JSON.stringify({ user, tweets }, null, 2));
  } else {
    console.log(fmt.formatProfile(user, tweets));
  }
}

async function cmdTweet() {
  const tweetId = args[1];
  if (!tweetId) { console.error("Usage: x-search.js tweet <tweet_id>"); process.exit(1); }

  const tweet = await api.getTweet(tweetId);
  if (!tweet) { console.log("Tweet not found."); return; }

  if (getFlag("json")) {
    console.log(JSON.stringify(tweet, null, 2));
  } else {
    console.log(fmt.formatTweet(tweet, undefined, { full: true }));
  }
}

async function cmdCache() {
  const sub = args[1];
  if (sub === "clear") {
    console.log(`Cleared ${cache.clear()} cached entries.`);
  } else {
    console.log(`Pruned ${cache.prune()} expired entries.`);
  }
}

function usage() {
  console.log(`x-search — X/Twitter research CLI

Requires: X_BEARER_TOKEN env var

Commands:
  search <query> [options]    Search recent tweets (last 7 days)
  thread <tweet_id>           Fetch full conversation thread
  profile <username>          Recent tweets from a user
  tweet <tweet_id>            Fetch a single tweet
  cache clear                 Clear search cache

Search options:
  --sort likes|impressions|retweets|recent   (default: likes)
  --since 1h|3h|12h|1d|7d   Time filter
  --min-likes N              Filter minimum likes
  --min-impressions N        Filter minimum impressions
  --pages N                  Pages to fetch, 1-5 (default: 1)
  --limit N                  Results to display (default: 15)
  --quick                    Quick mode: 1 page, max 10, auto noise filter, 1hr cache
  --from <username>          Shorthand for from:username in query
  --quality                  Post-hoc filter: min 10 likes
  --no-replies               Exclude replies
  --save                     Save to ./output/ (relative to skill dir)
  --json                     Raw JSON output
  --markdown                 Markdown output`);
}

async function main() {
  switch (command) {
    case "search": case "s": await cmdSearch(); break;
    case "thread": case "t": await cmdThread(); break;
    case "profile": case "p": await cmdProfile(); break;
    case "tweet": await cmdTweet(); break;
    case "cache": await cmdCache(); break;
    default: usage();
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
