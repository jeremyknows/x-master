/**
 * Simple file-based cache for X API results.
 * Avoids re-fetching identical queries within a TTL window.
 * Cache stored in ./data/cache/ relative to skill root.
 *
 * SECURITY: Cached content is untrusted external data. Re-validate on cache hit if used in agentic context.
 */

"use strict";

const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } = require("fs");
const { join } = require("path");
const { createHash } = require("crypto");

const CACHE_DIR = join(__dirname, "..", "data", "cache");
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function ensureDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(query, params = "") {
  return createHash("md5")
    .update(`${query}|${params}`)
    .digest("hex")
    .slice(0, 12);
}

function get(query, params = "", ttlMs = DEFAULT_TTL_MS) {
  ensureDir();
  const path = join(CACHE_DIR, `${cacheKey(query, params)}.json`);
  if (!existsSync(path)) return null;

  try {
    const entry = JSON.parse(readFileSync(path, "utf-8"));
    if (Date.now() - entry.timestamp > ttlMs) {
      unlinkSync(path);
      return null;
    }
    return entry.tweets;
  } catch {
    return null;
  }
}

function set(query, params = "", tweets) {
  ensureDir();
  const path = join(CACHE_DIR, `${cacheKey(query, params)}.json`);
  writeFileSync(path, JSON.stringify({ query, params, timestamp: Date.now(), tweets }, null, 2));
}

function prune(ttlMs = DEFAULT_TTL_MS) {
  ensureDir();
  let removed = 0;
  for (const file of readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"))) {
    try {
      const path = join(CACHE_DIR, file);
      if (Date.now() - statSync(path).mtimeMs > ttlMs) {
        unlinkSync(path);
        removed++;
      }
    } catch {}
  }
  return removed;
}

function clear() {
  ensureDir();
  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try { unlinkSync(join(CACHE_DIR, f)); } catch {}
  }
  return files.length;
}

module.exports = { get, set, prune, clear };
