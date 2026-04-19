const { all } = require("../db/database");

const QUICK_ACTIONS = [
  { id: "action:add-job", category: "quick-actions", title: "Add job", description: "Create a new scheduled job", route: "jobs" },
  { id: "action:add-server", category: "quick-actions", title: "Add server", description: "Create a new SSH server connection", route: "servers" },
  { id: "action:new-workspace", category: "quick-actions", title: "New workspace", description: "Create a new AWS workspace", route: "workspaces" },
  { id: "action:terminal", category: "quick-actions", title: "Open terminal", description: "Open SSH terminal", route: "terminal" },
  { id: "action:settings", category: "quick-actions", title: "Open settings", description: "Open settings page", route: "settings" },
];

const SEARCH_INDEX = {
  builtAt: null,
  items: [],
};

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreItem(item, query, activeWorkspaceId) {
  const name = normalizeString(item.title);
  const desc = normalizeString(item.description);
  const keywords = normalizeString((item.keywords || []).join(" "));
  if (!name && !desc && !keywords) return 0;

  const exactMatch = name === query ? 100 : 0;
  const startsWith = exactMatch ? 0 : name.startsWith(query) ? 80 : 0;
  const nameContains = exactMatch || startsWith ? 0 : name.includes(query) ? 60 : 0;
  const descContains = desc.includes(query) || keywords.includes(query) ? 40 : 0;

  let score = Math.max(exactMatch, startsWith, nameContains, descContains);
  if (!score) return 0;

  if (activeWorkspaceId && item.workspaceId && item.workspaceId === activeWorkspaceId) {
    score += 8;
  }
  return score;
}

function groupSearchResults(items, maxPerGroup) {
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return Object.entries(grouped).map(([category, rows]) => ({
    category,
    total: rows.length,
    results: rows.slice(0, maxPerGroup),
    hasMore: rows.length > maxPerGroup,
  }));
}

async function buildSearchIndex() {
  const [jobs, servers, workspaces, s3Connections, httpChecks, sslMonitors, dnsMonitors, envVars, terminalHistory] =
    await Promise.all([
      all("SELECT id, name, command, description, schedule, last_status FROM jobs"),
      all("SELECT id, name, host, tags, last_status FROM servers"),
      all("SELECT id, name, description, color FROM workspaces"),
      all(
        `SELECT s.id, s.name, s.bucket_name, s.region, w.workspace_id
         FROM s3_connections s
         LEFT JOIN workspace_s3_configs w ON w.s3_config_id = s.id`
      ),
      all("SELECT id, name, url, status FROM http_checks"),
      all("SELECT id, domain, days_remaining, status FROM ssl_monitors"),
      all("SELECT id, domain, record_type, status FROM dns_monitors"),
      all("SELECT id, name, description, scope_type FROM env_variables"),
      all(
        `SELECT th.id, th.server_id, th.command, th.created_at, s.name AS server_name
         FROM terminal_history th
         LEFT JOIN servers s ON s.id = th.server_id
         ORDER BY th.created_at DESC
         LIMIT 300`
      ),
    ]);

  const items = [];

  for (const row of jobs) {
    items.push({
      id: `job:${row.id}`,
      category: "jobs",
      title: row.name,
      description: `${row.schedule || "no schedule"} • ${row.last_status || "never run"}`,
      route: "jobs",
      entityId: row.id,
      keywords: [row.command, row.description, row.schedule],
    });
  }
  for (const row of servers) {
    items.push({
      id: `server:${row.id}`,
      category: "servers",
      title: row.name,
      description: `${row.host} • ${row.last_status || "unknown"}`,
      route: "servers",
      entityId: row.id,
      keywords: [row.host, row.tags],
    });
  }
  for (const row of workspaces) {
    items.push({
      id: `workspace:${row.id}`,
      category: "workspaces",
      title: row.name,
      description: row.description || "AWS workspace",
      route: "workspace-detail",
      entityId: row.id,
      keywords: [row.description, row.color],
      workspaceId: row.id,
    });
  }
  for (const row of s3Connections) {
    items.push({
      id: `s3:${row.id}`,
      category: "s3-buckets",
      title: row.name,
      description: `${row.bucket_name} • ${row.region}`,
      route: "s3-browser",
      entityId: row.id,
      keywords: [row.bucket_name, row.region],
      workspaceId: row.workspace_id || null,
    });
  }
  for (const row of httpChecks) {
    items.push({
      id: `http:${row.id}`,
      category: "health-checks",
      title: row.name,
      description: `${row.url} • ${row.status || "unknown"}`,
      route: "http-checks",
      entityId: row.id,
      keywords: [row.url, row.status],
    });
  }
  for (const row of sslMonitors) {
    items.push({
      id: `ssl:${row.id}`,
      category: "ssl-domains",
      title: row.domain,
      description: `${row.days_remaining ?? "?"} days • ${row.status || "unknown"}`,
      route: "ssl-monitor",
      entityId: row.id,
      keywords: [row.domain, row.status],
    });
  }
  for (const row of dnsMonitors) {
    items.push({
      id: `dns:${row.id}`,
      category: "dns-records",
      title: row.domain,
      description: `${row.record_type || "A"} • ${row.status || "unknown"}`,
      route: "dns-monitor",
      entityId: row.id,
      keywords: [row.domain, row.record_type],
    });
  }
  for (const row of envVars) {
    items.push({
      id: `env:${row.id}`,
      category: "environment-variables",
      title: row.name,
      description: `${row.scope_type || "global"} scope`,
      route: "env-vars",
      entityId: row.id,
      keywords: [row.description, row.scope_type],
    });
  }
  for (const row of terminalHistory) {
    items.push({
      id: `history:${row.id}`,
      category: "terminal-history",
      title: row.command,
      description: `${row.server_name || row.server_id || "local"} • ${row.created_at || ""}`,
      route: "terminal",
      entityId: row.server_id,
      keywords: [row.server_name, row.created_at],
    });
  }

  for (const section of ["Appearance", "General", "Notifications", "S3 Storage", "Security", "Danger Zone"]) {
    items.push({
      id: `settings:${section.toLowerCase().replace(/\s+/g, "-")}`,
      category: "settings",
      title: section,
      description: "Settings section",
      route: "settings",
      entityId: section.toLowerCase(),
      keywords: [section],
    });
  }

  SEARCH_INDEX.items = [...items, ...QUICK_ACTIONS];
  SEARCH_INDEX.builtAt = new Date().toISOString();
  return { builtAt: SEARCH_INDEX.builtAt, count: SEARCH_INDEX.items.length };
}

async function ensureSearchIndex() {
  if (!SEARCH_INDEX.items.length) {
    await buildSearchIndex();
  }
  return SEARCH_INDEX;
}

async function getSearchIndex() {
  await ensureSearchIndex();
  return SEARCH_INDEX;
}

async function searchIndex(query, options = {}) {
  await ensureSearchIndex();
  const q = normalizeString(query);
  const maxPerGroup = Number(options.maxPerGroup || 4);
  const activeWorkspaceId = options.activeWorkspaceId || null;

  if (!q) {
    return {
      grouped: [],
      quickActions: QUICK_ACTIONS,
      builtAt: SEARCH_INDEX.builtAt,
      total: SEARCH_INDEX.items.length,
    };
  }

  const ranked = SEARCH_INDEX.items
    .map((item) => ({ ...item, _score: scoreItem(item, q, activeWorkspaceId) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);

  return {
    grouped: groupSearchResults(ranked, maxPerGroup),
    builtAt: SEARCH_INDEX.builtAt,
    total: ranked.length,
  };
}

module.exports = {
  buildSearchIndex,
  getSearchIndex,
  searchIndex,
};
