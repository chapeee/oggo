const { all } = require("../db/database");

const QUICK_ACTIONS = [
  { id: "action:add-job", category: "quick-actions", title: "Add job", description: "Create a new scheduled job", route: "jobs", action: "add-job", keywords: ["create", "schedule", "cron"] },
  { id: "action:add-server", category: "quick-actions", title: "Add server", description: "Create a new SSH server connection", route: "servers", action: "add-server", keywords: ["ssh", "host", "connection"] },
  { id: "action:new-workspace", category: "quick-actions", title: "New workspace", description: "Create a new AWS workspace", route: "workspaces", action: "new-workspace", keywords: ["aws", "project", "group"] },
  { id: "action:terminal", category: "quick-actions", title: "Open terminal", description: "Open SSH terminal", route: "terminal", action: "terminal", keywords: ["shell", "console", "ssh"] },
  { id: "action:settings", category: "quick-actions", title: "Open settings", description: "Open settings page", route: "settings", action: "settings", keywords: ["config", "preferences"] },
];

const NAV_ITEMS = [
  { id: "nav:dashboard", category: "navigation", title: "Dashboard", description: "Overview page", route: "dashboard", keywords: ["home", "overview", "stats"] },
  { id: "nav:jobs", category: "navigation", title: "Jobs", description: "Cron jobs list and management", route: "jobs", keywords: ["cron", "schedule", "run"] },
  { id: "nav:logs", category: "navigation", title: "Logs", description: "Execution logs and output", route: "logs", keywords: ["history", "errors", "output"] },
  { id: "nav:servers", category: "navigation", title: "Servers", description: "Server inventory and SSH config", route: "servers", keywords: ["ssh", "host", "client"] },
  { id: "nav:terminal", category: "navigation", title: "SSH Terminal", description: "Interactive remote shell", route: "terminal", keywords: ["shell", "console", "command"] },
  { id: "nav:software-pm", category: "navigation", title: "Package Manager", description: "Package scan/update/pin", route: "software-package-manager", keywords: ["apt", "yum", "packages"] },
  { id: "nav:software-installer", category: "navigation", title: "Software Installer", description: "Install software and custom commands", route: "software-installer", keywords: ["install", "setup"] },
  { id: "nav:s3-connections", category: "navigation", title: "S3 Buckets", description: "S3 connection management", route: "s3", keywords: ["storage", "bucket"] },
  { id: "nav:s3-browser", category: "navigation", title: "S3 File Browser", description: "Browse and manage S3 files", route: "s3-browser", keywords: ["files", "upload", "download"] },
  { id: "nav:workspaces", category: "navigation", title: "Workspaces", description: "AWS grouped views", route: "workspaces", keywords: ["project", "aws"] },
  { id: "nav:aws-connections", category: "navigation", title: "AWS Connections", description: "AWS credentials and permissions", route: "aws-connections", keywords: ["iam", "access key"] },
  { id: "nav:http-checks", category: "navigation", title: "HTTP Checks", description: "HTTP uptime monitoring", route: "http-checks", keywords: ["health", "uptime"] },
  { id: "nav:ssl-monitor", category: "navigation", title: "SSL Monitor", description: "SSL certificate checks", route: "ssl-monitor", keywords: ["certificate", "expiry"] },
  { id: "nav:dns-monitor", category: "navigation", title: "DNS Monitor", description: "DNS record checks", route: "dns-monitor", keywords: ["record", "domain"] },
  { id: "nav:port-scanner", category: "navigation", title: "Port Scanner", description: "Port and service checks", route: "port-scanner", keywords: ["tcp", "host", "service"] },
  { id: "nav:env-vars", category: "navigation", title: "Environment Variables", description: "Secret and env management", route: "env-vars", keywords: ["secret", "config"] },
  { id: "nav:settings", category: "navigation", title: "Settings", description: "Application settings", route: "settings", keywords: ["preferences", "configuration"] },
];

const SEARCH_INDEX = { builtAt: null, items: [] };
const REBUILD_TTL_MS = 30 * 1000;

function normalizeString(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreItem(item, query, activeWorkspaceId) {
  const title = normalizeString(item.title);
  const description = normalizeString(item.description);
  const keywords = normalizeString((item.keywords || []).join(" "));
  const haystack = `${title} ${description} ${keywords}`;
  if (!haystack) return 0;

  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.length) return 0;
  let score = 0;
  for (const token of tokens) {
    if (title === token) score += 120;
    else if (title.startsWith(token)) score += 80;
    else if (title.includes(token)) score += 55;
    else if (haystack.includes(token)) score += 30;
    else return 0;
  }
  if (activeWorkspaceId && item.workspaceId && item.workspaceId === activeWorkspaceId) score += 8;
  return score;
}

function groupSearchResults(items, maxPerGroup) {
  const grouped = {};
  for (const row of items) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }
  return Object.entries(grouped).map(([category, rows]) => ({
    category,
    total: rows.length,
    hasMore: rows.length > maxPerGroup,
    results: rows.slice(0, maxPerGroup),
  }));
}

function pushItem(items, item) {
  if (!item.title) return;
  items.push({
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description || "",
    route: item.route || "dashboard",
    entityId: item.entityId || null,
    action: item.action || null,
    workspaceId: item.workspaceId || null,
    keywords: item.keywords || [],
  });
}

async function buildSearchIndex() {
  const [
    jobs,
    logs,
    servers,
    snippets,
    terminalHistory,
    sshKeys,
    workspaces,
    awsConnections,
    s3Connections,
    sslMonitors,
    dnsMonitors,
    portMonitors,
    envVars,
    httpChecks,
    packagePins,
    packageHistory,
  ] = await Promise.all([
    all("SELECT id, name, command, description, schedule, last_status FROM jobs"),
    all("SELECT id, job_name, status, created_at FROM logs ORDER BY created_at DESC LIMIT 300"),
    all("SELECT id, name, host, tags, last_status FROM servers"),
    all("SELECT id, title, command, description, category FROM snippets"),
    all("SELECT id, server_id, command, created_at FROM terminal_history ORDER BY created_at DESC LIMIT 300"),
    all("SELECT id, name, algorithm FROM ssh_keys"),
    all("SELECT id, name, description, color, default_region FROM workspaces"),
    all("SELECT id, name, default_region, account_id FROM aws_connections"),
    all("SELECT id, name, bucket_name, region FROM s3_connections"),
    all("SELECT id, domain, days_remaining, status FROM ssl_monitors"),
    all("SELECT id, domain, record_type, status FROM dns_monitors"),
    all("SELECT id, name, host, port, protocol, status FROM port_monitors"),
    all("SELECT id, name, description, scope_type, group_name FROM env_variables"),
    all("SELECT id, name, url, method, status FROM http_checks"),
    all("SELECT id, package_manager, package_name, version, server_id FROM package_pins"),
    all("SELECT id, package_manager, package_name, action, status, server_id FROM package_history ORDER BY created_at DESC LIMIT 300"),
  ]);

  const items = [];
  [...NAV_ITEMS, ...QUICK_ACTIONS].forEach((row) => pushItem(items, row));

  jobs.forEach((row) =>
    pushItem(items, { id: `job:${row.id}`, category: "jobs", title: row.name, description: `${row.schedule || "no schedule"} • ${row.last_status || "never run"}`, route: "jobs", entityId: row.id, keywords: [row.command, row.description, row.schedule] })
  );
  logs.forEach((row) =>
    pushItem(items, { id: `log:${row.id}`, category: "logs", title: `${row.job_name || "Job"} log`, description: `${row.status || "unknown"} • ${row.created_at || ""}`, route: "logs", entityId: row.id, keywords: [row.job_name, row.status] })
  );
  servers.forEach((row) =>
    pushItem(items, { id: `server:${row.id}`, category: "servers", title: row.name, description: `${row.host} • ${row.last_status || "unknown"}`, route: "servers", entityId: row.id, keywords: [row.host, row.tags] })
  );
  snippets.forEach((row) =>
    pushItem(items, { id: `snippet:${row.id}`, category: "snippets", title: row.title, description: `${row.category || "snippet"} • ${row.description || ""}`, route: "terminal", entityId: row.id, keywords: [row.command, row.description, row.category] })
  );
  terminalHistory.forEach((row) =>
    pushItem(items, { id: `history:${row.id}`, category: "terminal-history", title: row.command, description: `${row.server_id || "local"} • ${row.created_at || ""}`, route: "terminal", entityId: row.server_id, keywords: [row.command, row.created_at] })
  );
  sshKeys.forEach((row) =>
    pushItem(items, { id: `ssh-key:${row.id}`, category: "ssh-keys", title: row.name, description: `${row.algorithm || "key"} key`, route: "servers", entityId: row.id, keywords: [row.algorithm] })
  );
  workspaces.forEach((row) =>
    pushItem(items, { id: `workspace:${row.id}`, category: "workspaces", title: row.name, description: `${row.default_region || "us-east-1"} • ${row.description || "AWS workspace"}`, route: "workspace-detail", entityId: row.id, workspaceId: row.id, keywords: [row.description, row.color, row.default_region] })
  );
  awsConnections.forEach((row) =>
    pushItem(items, { id: `aws:${row.id}`, category: "aws-connections", title: row.name, description: `${row.default_region || "us-east-1"} • ${row.account_id || "no account id"}`, route: "aws-connections", entityId: row.id, keywords: [row.default_region, row.account_id] })
  );
  s3Connections.forEach((row) =>
    pushItem(items, { id: `s3:${row.id}`, category: "s3-buckets", title: row.name, description: `${row.bucket_name} • ${row.region}`, route: "s3-browser", entityId: row.id, keywords: [row.bucket_name, row.region] })
  );
  sslMonitors.forEach((row) =>
    pushItem(items, { id: `ssl:${row.id}`, category: "ssl-monitors", title: row.domain, description: `${row.days_remaining ?? "?"} days • ${row.status || "unknown"}`, route: "ssl-monitor", entityId: row.id, keywords: [row.domain, row.status] })
  );
  dnsMonitors.forEach((row) =>
    pushItem(items, { id: `dns:${row.id}`, category: "dns-monitors", title: row.domain, description: `${row.record_type || "A"} • ${row.status || "unknown"}`, route: "dns-monitor", entityId: row.id, keywords: [row.domain, row.record_type, row.status] })
  );
  portMonitors.forEach((row) =>
    pushItem(items, { id: `port:${row.id}`, category: "port-monitors", title: row.name, description: `${row.host}:${row.port} (${row.protocol || "tcp"}) • ${row.status || "unknown"}`, route: "port-scanner", entityId: row.id, keywords: [row.host, row.port, row.protocol, row.status] })
  );
  envVars.forEach((row) =>
    pushItem(items, { id: `env:${row.id}`, category: "environment-variables", title: row.name, description: `${row.scope_type || "global"} scope • ${row.group_name || "default"}`, route: "env-vars", entityId: row.id, keywords: [row.description, row.scope_type, row.group_name] })
  );
  httpChecks.forEach((row) =>
    pushItem(items, { id: `http:${row.id}`, category: "http-checks", title: row.name, description: `${row.method || "GET"} ${row.url} • ${row.status || "unknown"}`, route: "http-checks", entityId: row.id, keywords: [row.url, row.method, row.status] })
  );
  packagePins.forEach((row) =>
    pushItem(items, { id: `pin:${row.id}`, category: "package-pins", title: row.package_name, description: `${row.package_manager || "pkg"} • pinned ${row.version || "latest"}`, route: "software-package-manager", entityId: row.server_id, keywords: [row.package_manager, row.version, row.server_id] })
  );
  packageHistory.forEach((row) =>
    pushItem(items, { id: `pkg-history:${row.id}`, category: "package-history", title: row.package_name, description: `${row.action || "action"} • ${row.status || "unknown"} • ${row.package_manager || "pkg"}`, route: "software-package-manager", entityId: row.server_id, keywords: [row.action, row.status, row.package_manager, row.server_id] })
  );

  SEARCH_INDEX.items = items;
  SEARCH_INDEX.builtAt = new Date().toISOString();
  return { builtAt: SEARCH_INDEX.builtAt, count: SEARCH_INDEX.items.length };
}

async function ensureSearchIndex(forceRebuild = false) {
  const builtAtMs = SEARCH_INDEX.builtAt ? new Date(SEARCH_INDEX.builtAt).getTime() : 0;
  const stale = !builtAtMs || Date.now() - builtAtMs > REBUILD_TTL_MS;
  if (forceRebuild || !SEARCH_INDEX.items.length || stale) {
    await buildSearchIndex();
  }
  return SEARCH_INDEX;
}

async function getSearchIndex(forceRebuild = false) {
  await ensureSearchIndex(forceRebuild);
  return SEARCH_INDEX;
}

async function searchIndex(query, options = {}) {
  await ensureSearchIndex(Boolean(options.forceRebuild));
  const q = normalizeString(query);
  const maxPerGroup = Math.max(4, Math.min(20, Number(options.maxPerGroup || 8)));
  const activeWorkspaceId = options.activeWorkspaceId || null;

  if (!q) {
    return { grouped: [], builtAt: SEARCH_INDEX.builtAt, total: SEARCH_INDEX.items.length };
  }

  const ranked = SEARCH_INDEX.items
    .map((item) => ({ ...item, _score: scoreItem(item, q, activeWorkspaceId) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);
  return { grouped: groupSearchResults(ranked, maxPerGroup), builtAt: SEARCH_INDEX.builtAt, total: ranked.length };
}

module.exports = { buildSearchIndex, getSearchIndex, searchIndex };
