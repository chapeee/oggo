const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const FuseImport = require("fuse.js");
const stripAnsiImport = require("strip-ansi");
const ansiRegexImport = require("ansi-regex");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db/database");
const { getoggoDataDir } = require("./platformService");

const TLDR_ZIP_URL = "https://github.com/tldr-pages/tldr/releases/latest/download/tldr-pages.zip";
const TLDR_DIR = path.join(getoggoDataDir(), "tldr");
const TLDR_META_FILE = path.join(TLDR_DIR, ".meta.json");
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const dangerousPatternsPath = path.join(__dirname, "..", "data", "dangerous-commands.json");
const snippetsPath = path.join(__dirname, "..", "data", "snippets.json");
const commandsSeedPath = path.join(__dirname, "..", "data", "commands-seed.json");

let cachedFuse = null;
let cachedCommandList = [];
const FuseCtor =
  typeof FuseImport === "function"
    ? FuseImport
    : typeof FuseImport?.default === "function"
      ? FuseImport.default
      : null;
const getAnsiRegex =
  typeof ansiRegexImport === "function"
    ? ansiRegexImport
    : typeof ansiRegexImport?.default === "function"
      ? ansiRegexImport.default
      : () => /\u001b\[[0-9;]*m/g;
const stripAnsiFn =
  typeof stripAnsiImport === "function"
    ? stripAnsiImport
    : typeof stripAnsiImport?.default === "function"
      ? stripAnsiImport.default
      : (value) => String(value || "");

function parseTldrMarkdown(content, fallbackName) {
  const lines = content.split("\n");
  const name = (lines[0] || `# ${fallbackName}`).replace(/^#\s+/, "").trim();
  const descLine = lines.find((line) => line.trim().startsWith(">")) || "";
  const description = descLine.replace(/^>\s*/, "").trim();
  const examples = [];
  let currentDesc = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      currentDesc = line.replace(/^- /, "").replace(/:$/, "").trim();
      continue;
    }
    if (line.startsWith("`") && line.endsWith("`")) {
      examples.push({
        desc: currentDesc || "Example",
        cmd: line.replace(/`/g, "").trim(),
      });
    }
  }

  return { name, description, examples };
}

function upsertCommand(parsed, platform) {
  getDb()
    .prepare(`
      INSERT INTO commands (name, description, examples, platform, use_count)
      VALUES (?, ?, ?, ?, COALESCE((SELECT use_count FROM commands WHERE name = ?), 0))
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        examples = excluded.examples,
        platform = excluded.platform
    `)
    .run(parsed.name, parsed.description, JSON.stringify(parsed.examples), platform, parsed.name);
}

function ensureCommandSeedData() {
  if (!fs.existsSync(commandsSeedPath)) return;
  const rows = fs.readJSONSync(commandsSeedPath);
  for (const row of rows) {
    upsertCommand(
      {
        name: row.name,
        description: row.description || "",
        examples: row.examples || [],
      },
      row.platform || "common"
    );
  }
  invalidateCommandIndex();
}

function isSubsequence(needle, haystack) {
  const a = String(needle || "").toLowerCase();
  const b = String(haystack || "").toLowerCase();
  if (!a || !b) return false;
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j += 1) {
    if (a[i] === b[j]) i += 1;
  }
  return i === a.length;
}

async function parseTldrIntoDatabase() {
  const base = path.join(TLDR_DIR, "pages");
  const platforms = ["common", "linux", "osx", "windows"];
  for (const platform of platforms) {
    const platformDir = path.join(base, platform);
    if (!fs.existsSync(platformDir)) continue;
    const files = (await fs.readdir(platformDir)).filter((name) => name.endsWith(".md"));
    for (const file of files) {
      const markdown = await fs.readFile(path.join(platformDir, file), "utf8");
      const parsed = parseTldrMarkdown(markdown, file.replace(/\.md$/, ""));
      upsertCommand(parsed, platform);
    }
  }
  invalidateCommandIndex();
}

function shouldRefreshTldr() {
  if (!fs.existsSync(TLDR_META_FILE)) return true;
  try {
    const meta = fs.readJSONSync(TLDR_META_FILE);
    return Date.now() - Number(meta.updatedAt || 0) > ONE_WEEK_MS;
  } catch (_error) {
    return true;
  }
}

async function downloadAndCacheTldrPages() {
  await fs.ensureDir(TLDR_DIR);
  const response = await axios.get(TLDR_ZIP_URL, { responseType: "arraybuffer", timeout: 15000 });
  const zip = new AdmZip(response.data);
  zip.extractAllTo(TLDR_DIR, true);
  await parseTldrIntoDatabase();
  await fs.writeJSON(TLDR_META_FILE, { updatedAt: Date.now() }, { spaces: 2 });
}

async function ensureTldrDatabaseReady() {
  ensureCommandSeedData();
  const countBefore = getDb().prepare("SELECT COUNT(*) as c FROM commands").get().c;
  if (!shouldRefreshTldr() && countBefore > 0) return;
  try {
    await downloadAndCacheTldrPages();
  } catch (_error) {
    // Keep app resilient if external source is unavailable.
    // Seed data remains available for suggestions.
  }
}

function invalidateCommandIndex() {
  cachedFuse = null;
  cachedCommandList = [];
}

function buildCommandIndex() {
  const rows = getDb()
    .prepare("SELECT name, description, examples, platform, use_count FROM commands ORDER BY use_count DESC")
    .all()
    .map((row) => ({
      ...row,
      examples: (() => {
        try {
          return JSON.parse(row.examples || "[]");
        } catch (_error) {
          return [];
        }
      })(),
    }));
  cachedCommandList = rows;
  if (!FuseCtor) {
    cachedFuse = null;
    return;
  }
  cachedFuse = new FuseCtor(rows, {
    keys: ["name", "description", "examples.cmd"],
    threshold: 0.35,
    minMatchCharLength: 2,
    includeScore: true,
  });
}

function getSuggestions(query, serverId = "local") {
  const q = String(query || "").trim();
  if (!q) return { suggestions: [] };
  if (!cachedFuse) buildCommandIndex();

  const historyMatches = getDb()
    .prepare(`
      SELECT command, COUNT(*) as freq
      FROM terminal_history
      WHERE command LIKE ? AND server_id = ?
      GROUP BY command
      ORDER BY freq DESC
      LIMIT 5
    `)
    .all(`%${q}%`, serverId)
    .map((row) => ({
      cmd: row.command,
      source: "history",
      freq: row.freq,
    }));

  const fuseMatches = [];
  if (cachedFuse) {
    const hits = cachedFuse.search(q).slice(0, 10);
    for (const entry of hits) {
      const item = entry.item;
      const base = {
        cmd: item.name,
        source: "tldr",
        desc: item.description,
        examples: item.examples,
      };
      fuseMatches.push(base);
      const ex = Array.isArray(item.examples) ? item.examples : [];
      for (const example of ex) {
        if (!example?.cmd) continue;
        const normalized = String(example.cmd).toLowerCase();
        if (normalized.includes(q.toLowerCase()) || item.name.toLowerCase().startsWith(q.toLowerCase())) {
          fuseMatches.push({
            cmd: example.cmd,
            source: "tldr",
            desc: example.desc || item.description,
          });
        }
      }
    }
  }

  const subsequenceMatches = (cachedCommandList || [])
    .filter((item) => {
      const name = String(item.name || "");
      return name.toLowerCase().startsWith(q.toLowerCase()) || isSubsequence(q, name);
    })
    .slice(0, 8)
    .flatMap((item) => {
      const out = [
        {
          cmd: item.name,
          source: "shell",
          desc: item.description,
        },
      ];
      const ex = Array.isArray(item.examples) ? item.examples.slice(0, 2) : [];
      for (const example of ex) {
        if (example?.cmd) {
          out.push({
            cmd: example.cmd,
            source: "shell",
            desc: example.desc || item.description,
          });
        }
      }
      return out;
    });

  const seen = new Set();
  const merged = [...historyMatches, ...subsequenceMatches, ...fuseMatches].filter((item) => {
    if (seen.has(item.cmd)) return false;
    seen.add(item.cmd);
    return true;
  });
  return { suggestions: merged.slice(0, 10) };
}

function detectRisk(command) {
  const patterns = fs.readJSONSync(dangerousPatternsPath);
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex, "i");
    if (regex.test(command)) {
      return { match: true, ...pattern };
    }
  }
  return { match: false };
}

async function explainCommand(command) {
  const encoded = encodeURIComponent(command.trim().replace(/\s+/g, "+"));
  let cheat = null;
  let mankier = null;
  try {
    const cheatRes = await axios.get(`https://cheat.sh/${encoded}?T`, { timeout: 5000 });
    cheat = String(cheatRes.data || "");
  } catch (_error) {}
  try {
    const mankierRes = await axios.get(`https://www.mankier.com/api/v2/explain/?cols=80&q=${encoded}`, { timeout: 5000 });
    mankier = mankierRes.data || null;
  } catch (_error) {}
  return { cheat, mankier };
}

const ERROR_PATTERNS = [
  {
    pattern: /command not found/i,
    code: "CMD_NOT_FOUND",
    title: "Command not found",
    explain: (output) => {
      const cmd = output.match(/(\w+): command not found/i)?.[1] || "command";
      return {
        what: `"${cmd}" is not installed on this server`,
        why: "The program is not installed or not in PATH.",
        fixes: [
          { desc: "Install on Ubuntu/Debian", cmd: `sudo apt install ${cmd}` },
          { desc: "Install on CentOS/RHEL", cmd: `sudo yum install ${cmd}` },
          { desc: "Find command location", cmd: `which ${cmd}` },
        ],
      };
    },
  },
  {
    pattern: /permission denied/i,
    code: "PERM_DENIED",
    title: "Permission denied",
    explain: () => ({
      what: "You do not have permission to run this action.",
      why: "File ownership or permissions block this command.",
      fixes: [
        { desc: "Try with sudo", cmd: "sudo !!" },
        { desc: "Check permissions", cmd: "ls -la" },
      ],
    }),
  },
  {
    pattern: /address already in use|eaddrinuse/i,
    code: "PORT_IN_USE",
    title: "Port already in use",
    explain: (output) => {
      const port = output.match(/:(\d+)/)?.[1] || "PORT";
      return {
        what: `Port ${port} is already used by another process.`,
        why: "A previous process is still listening.",
        fixes: [
          { desc: `Find process on port ${port}`, cmd: `lsof -ti:${port}` },
          { desc: `Kill process on port ${port}`, cmd: `lsof -ti:${port} | xargs kill -9` },
        ],
      };
    },
  },
  {
    pattern: /no space left on device/i,
    code: "DISK_FULL",
    title: "Disk is full",
    explain: () => ({
      what: "No storage is left on this server.",
      why: "Filesystem is at capacity.",
      fixes: [
        { desc: "Check disk usage", cmd: "df -h" },
        { desc: "Find largest directories", cmd: "du -sh /* 2>/dev/null | sort -rh | head -20" },
      ],
    }),
  },
];

function detectError(outputRaw) {
  const noAnsi = String(outputRaw || "").replace(getAnsiRegex(), "");
  const output = stripAnsiFn(noAnsi);
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(output)) {
      return {
        code: pattern.code,
        title: pattern.title,
        ...pattern.explain(output),
      };
    }
  }
  return null;
}

function recordTerminalHistory(serverId, command, output = "", status = "success") {
  getDb()
    .prepare("INSERT INTO terminal_history (id, server_id, command, output, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(uuidv4(), serverId, command, output, status, new Date().toISOString());
}

function getHistory(serverId, limit = 1000) {
  return getDb()
    .prepare("SELECT command, output, status, created_at FROM terminal_history WHERE server_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(serverId, Number(limit));
}

function ensureBuiltinSnippets() {
  if (!fs.existsSync(snippetsPath)) return;
  const rows = fs.readJSONSync(snippetsPath);
  const stmt = getDb().prepare(`
    INSERT INTO snippets (id, title, command, description, tags, category, builtin, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const now = new Date().toISOString();
  for (const row of rows) {
    stmt.run(
      row.id,
      row.title,
      row.command,
      row.description || "",
      JSON.stringify(row.tags || []),
      row.category || "general",
      row.builtin ? 1 : 0,
      now
    );
  }
}

function listSnippets() {
  return getDb()
    .prepare("SELECT * FROM snippets ORDER BY builtin DESC, created_at DESC")
    .all()
    .map((row) => {
      try {
        return { ...row, tags: JSON.parse(row.tags || "[]") };
      } catch (_error) {
        return { ...row, tags: [] };
      }
    });
}

function addSnippet(payload) {
  const record = {
    id: uuidv4(),
    title: payload.title,
    command: payload.command,
    description: payload.description || "",
    tags: JSON.stringify(payload.tags || []),
    category: payload.category || "general",
    builtin: 0,
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare("INSERT INTO snippets (id, title, command, description, tags, category, builtin, created_at) VALUES (@id, @title, @command, @description, @tags, @category, @builtin, @created_at)")
    .run(record);
  return record;
}

function deleteSnippet(id) {
  getDb().prepare("DELETE FROM snippets WHERE id = ? AND builtin = 0").run(id);
}

module.exports = {
  ensureTldrDatabaseReady,
  ensureCommandSeedData,
  getSuggestions,
  detectRisk,
  explainCommand,
  detectError,
  recordTerminalHistory,
  getHistory,
  ensureBuiltinSnippets,
  listSnippets,
  addSnippet,
  deleteSnippet,
};
