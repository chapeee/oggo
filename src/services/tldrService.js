const path = require("path");
const fs = require("fs-extra");
const FuseImport = require("fuse.js");
const tldrConfig = require("tldr/lib/config");
const TldrCache = require("tldr/lib/cache");
const tldrSearch = require("tldr/lib/search");
const tldrIndex = require("tldr/lib/index");
const tldrParser = require("tldr/lib/parser");

const aliasMap = require("../data/command-aliases.json");

const FuseCtor =
  typeof FuseImport === "function"
    ? FuseImport
    : typeof FuseImport?.default === "function"
      ? FuseImport.default
      : null;

const cfg = tldrConfig.get();
const cache = new TldrCache(cfg);
const detailsCache = new Map();

let commandIndex = [];
let fuseInstance = null;

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function isSubsequence(query, value) {
  const q = normalizeToken(query);
  const v = normalizeToken(value);
  if (!q || !v) return false;
  let qi = 0;
  for (let vi = 0; vi < v.length && qi < q.length; vi += 1) {
    if (v[vi] === q[qi]) qi += 1;
  }
  return qi === q.length;
}

function shouldUpdate() {
  const cacheDir = path.join(cfg.cache, "cache");
  if (!fs.existsSync(cacheDir)) return true;
  const stats = fs.statSync(cacheDir);
  const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
  return ageInDays > 7;
}

async function ensureTldrCache(force = false) {
  const cacheDir = path.join(cfg.cache, "cache");
  if (!force && fs.existsSync(cacheDir) && !shouldUpdate()) return;
  await cache.update();
  try {
    // Maintains TLDR package's own search index in cache.
    await tldrSearch.createIndex();
  } catch (_error) {
    // Non-fatal for command completion.
  }
}

async function getCommand(name) {
  const key = normalizeToken(name);
  if (!key) return null;
  if (detailsCache.has(key)) return detailsCache.get(key);
  try {
    const markdown = await cache.getPage(key);
    if (!markdown) return null;
    const parsed = tldrParser.parse(markdown);
    const details = {
      name: key,
      description: parsed?.description || "",
      examples: Array.isArray(parsed?.examples)
        ? parsed.examples.map((example) => ({
            desc: example.description || "",
            cmd: example.code || "",
          }))
        : [],
    };
    detailsCache.set(key, details);
    return details;
  } catch (_error) {
    return null;
  }
}

function buildFuse(commands) {
  if (!FuseCtor) {
    fuseInstance = null;
    return;
  }
  const records = commands.map((name) => ({
    name,
    aliases: Array.isArray(aliasMap[name]) ? aliasMap[name] : [],
  }));
  fuseInstance = new FuseCtor(records, {
    keys: [
      { name: "name", weight: 0.85 },
      { name: "aliases", weight: 0.15 },
    ],
    threshold: 0.42,
    minMatchCharLength: 1,
    includeScore: true,
  });
}

async function initializeTldrIndex() {
  try {
    await ensureTldrCache();
    const allCommands = await tldrIndex.commands();
    commandIndex = Array.from(
      new Set((allCommands || []).map((cmd) => normalizeToken(cmd)).filter(Boolean))
    );
    buildFuse(commandIndex);
    return commandIndex;
  } catch (_error) {
    commandIndex = [];
    fuseInstance = null;
    return [];
  }
}

async function searchCommands(query, limit = 6) {
  const token = normalizeToken(String(query || "").split(" ")[0]);
  if (!token || !commandIndex.length) return [];

  const picked = [];
  const seen = new Set();
  const pushName = (name) => {
    const normalized = normalizeToken(name);
    if (!normalized || seen.has(normalized) || !commandIndex.includes(normalized)) return;
    picked.push(normalized);
    seen.add(normalized);
  };

  // Alias-first completion path for typo shortcuts like "mkd" -> "mkdir".
  for (const [name, aliases] of Object.entries(aliasMap)) {
    if (!Array.isArray(aliases)) continue;
    if (aliases.map((item) => normalizeToken(item)).includes(token)) pushName(name);
  }

  commandIndex.forEach((name) => {
    if (name.startsWith(token)) pushName(name);
  });
  commandIndex.forEach((name) => {
    if (!seen.has(name) && isSubsequence(token, name)) pushName(name);
  });

  if (fuseInstance) {
    fuseInstance.search(token, { limit: Math.max(limit * 3, 20) }).forEach((entry) => {
      pushName(entry.item.name);
    });
  }

  const top = picked.slice(0, Math.max(limit, 1));
  const detailed = await Promise.all(
    top.map(async (name) => {
      const details = await getCommand(name);
      return {
        name,
        description: details?.description || "",
        platform: "tldr",
        examples: details?.examples || [],
        score: 0,
      };
    })
  );
  return detailed;
}

function getAllCommandNames() {
  return [...commandIndex];
}

module.exports = {
  initializeTldrIndex,
  shouldUpdate,
  searchCommands,
  getCommand,
  getAllCommandNames,
  ensureTldrCache,
};
