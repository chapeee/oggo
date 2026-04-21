const { executeGuiCommand } = require("./terminalSessionManager");
const { validationError } = require("../errors/app-error");

const LOG_PATH_CANDIDATES = [
  "/var/log/nginx/access.log",
  "/var/log/nginx/error.log",
  "/var/log/apache2/access.log",
  "/var/log/apache2/error.log",
  "/var/log/mysql/error.log",
  "/var/log/syslog",
  "/var/log/auth.log",
  "/var/log/dpkg.log",
];

/**
 * Parse a single `ls -la --time-style=long-iso` row to structured metadata.
 *
 * @param {string} line
 * @returns {null|{name: string, type: "file"|"directory"|"symlink"|"other", permissions: string, owner: string, group: string, size: number, modifiedAt: string, linkTarget: string|null}}
 */
function parseLsEntry(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("total ")) return null;
  const match = trimmed.match(
    /^([\-dlbcps])([rwxstST\-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/
  );
  if (!match) return null;
  const [, typeChar, perms, owner, group, sizeText, dateText, timeText, rawName] = match;
  const parts = rawName.split(" -> ");
  const name = parts[0];
  const linkTarget = parts[1] || null;
  const type =
    typeChar === "d" ? "directory" : typeChar === "l" ? "symlink" : typeChar === "-" ? "file" : "other";
  return {
    name,
    type,
    permissions: `${typeChar}${perms}`,
    owner,
    group,
    size: Number(sizeText || 0),
    modifiedAt: `${dateText} ${timeText}`,
    linkTarget,
  };
}

/**
 * Parse `ls` output into structured entries array.
 *
 * @param {string} output
 * @returns {Array<Object>}
 */
function parseLsEntries(output) {
  const rows = String(output || "")
    .split(/\r?\n/)
    .map((line) => parseLsEntry(line))
    .filter(Boolean)
    .filter((entry) => entry.name !== "." && entry.name !== "..");
  rows.sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/**
 * Quote an arbitrary value for shell-safe path and argument usage.
 *
 * @param {string} value
 * @returns {string}
 */
function shQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\\''`)}'`;
}

/**
 * Run command with session-bound GUI echo and return plain result.
 *
 * @param {string} sessionId
 * @param {string} command
 * @param {number|{timeoutMs?: number, stdin?: string}} [timeoutMs]
 * @returns {Promise<{output: string, errorOutput: string, exitCode: number}>}
 */
async function run(sessionId, command, timeoutMs = 15000) {
  if (!sessionId) {
    throw validationError("sessionId is required");
  }
  if (typeof timeoutMs === "object" && timeoutMs !== null) {
    const { timeoutMs: tm, stdin } = timeoutMs;
    return executeGuiCommand(sessionId, command, { timeoutMs: tm, stdin });
  }
  return executeGuiCommand(sessionId, command, { timeoutMs });
}

/**
 * List files in a remote directory.
 *
 * @param {string} sessionId
 * @param {string} path
 * @param {{ showHidden?: boolean }} [options]
 * @returns {Promise<{path: string, command: string, output: string}>}
 */
async function listFiles(sessionId, path, options = {}) {
  const target = path || "~";
  const showHidden = Boolean(options.showHidden);
  const hiddenClause = showHidden ? "" : " | grep -vE '^\\.'";
  const command = `ls -la --time-style=long-iso ${shQuote(target)}${hiddenClause}`;
  const result = await run(sessionId, command, 20000);
  return {
    path: target,
    command,
    output: result.output,
    errorOutput: result.errorOutput,
    entries: parseLsEntries(result.output),
  };
}

/**
 * List process table for process manager tab.
 *
 * @param {string} sessionId
 * @returns {Promise<{command: string, output: string}>}
 */
async function listProcesses(sessionId) {
  const command = "ps aux --sort=-%cpu";
  const result = await run(sessionId, command, 15000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * Kill process by PID and signal.
 *
 * @param {string} sessionId
 * @param {number|string} pid
 * @param {number|string} signal
 * @returns {Promise<{command: string, output: string}>}
 */
async function killProcess(sessionId, pid, signal = 15) {
  if (!pid) throw validationError("pid is required");
  const sig = Number(signal || 15);
  const command = `kill -${sig} ${Number(pid)}`;
  const result = await run(sessionId, command, 10000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * List systemd services.
 *
 * @param {string} sessionId
 * @returns {Promise<{command: string, output: string}>}
 */
async function listServices(sessionId) {
  const command = "systemctl list-units --type=service --all --no-pager";
  const result = await run(sessionId, command, 20000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * Perform systemctl action for a service.
 *
 * @param {string} sessionId
 * @param {string} service
 * @param {"start"|"stop"|"restart"|"reload"|"enable"|"disable"} action
 * @returns {Promise<{command: string, output: string}>}
 */
async function serviceAction(sessionId, service, action) {
  if (!service) throw validationError("service is required");
  const allowed = new Set(["start", "stop", "restart", "reload", "enable", "disable"]);
  if (!allowed.has(action)) throw validationError("Invalid service action");
  const command = `sudo systemctl ${action} ${shQuote(service)}`;
  const result = await run(sessionId, command, 25000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * Discover common log files available on host.
 *
 * @param {string} sessionId
 * @returns {Promise<{command: string, paths: string[]}>}
 */
async function listLogSources(sessionId) {
  const checks = LOG_PATH_CANDIDATES.map((path) => `[ -f ${shQuote(path)} ] && echo ${shQuote(path)} || true`).join(" ; ");
  const command = `${checks} ; [ -d ~/.pm2/logs ] && ls -1 ~/.pm2/logs | sed 's#^#~/.pm2/logs/#' || true`;
  const result = await run(sessionId, command, 15000);
  const paths = String(result.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { command, paths };
}

/**
 * Read recent lines from selected log path.
 *
 * @param {string} sessionId
 * @param {string} path
 * @param {number} [lines]
 * @returns {Promise<{command: string, output: string}>}
 */
async function readLog(sessionId, path, lines = 100) {
  if (!path) throw validationError("path is required");
  const lineCount = Math.min(Math.max(Number(lines || 100), 1), 5000);
  const command = `tail -n ${lineCount} ${shQuote(path)}`;
  const result = await run(sessionId, command, 15000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * Get partition usage and drill-down output for a directory.
 *
 * @param {string} sessionId
 * @param {string} [path]
 * @returns {Promise<{overview: {command: string, output: string}, usage: {command: string, output: string}}>}
 */
async function diskOverview(sessionId, path = "/") {
  const overviewCommand = "df -h";
  const usagePath = path || "/";
  const usageCommand = `du -sh ${shQuote(usagePath)}/* 2>/dev/null | sort -rh`;
  const [overview, usage] = await Promise.all([
    run(sessionId, overviewCommand, 12000),
    run(sessionId, usageCommand, 25000),
  ]);
  return {
    overview: { command: overviewCommand, output: overview.output, errorOutput: overview.errorOutput },
    usage: { command: usageCommand, output: usage.output, errorOutput: usage.errorOutput },
  };
}

/**
 * Find large files.
 *
 * @param {string} sessionId
 * @returns {Promise<{command: string, output: string}>}
 */
async function findLargeFiles(sessionId) {
  const command = "find / -size +100M -type f 2>/dev/null | head -20";
  const result = await run(sessionId, command, 30000);
  return { command, output: result.output, errorOutput: result.errorOutput };
}

/**
 * Get network interface and port data.
 *
 * @param {string} sessionId
 * @returns {Promise<{interfaces: {command: string, output: string}, connections: {command: string, output: string}, ports: {command: string, output: string}}>}
 */
async function networkInfo(sessionId) {
  const ifaceCommand = "ip addr show";
  const connCommand = "ss -tulpn";
  const portCommand = "ss -tlnp";
  const [interfaces, connections, ports] = await Promise.all([
    run(sessionId, ifaceCommand, 15000),
    run(sessionId, connCommand, 15000),
    run(sessionId, portCommand, 15000),
  ]);
  return {
    interfaces: { command: ifaceCommand, output: interfaces.output, errorOutput: interfaces.errorOutput },
    connections: { command: connCommand, output: connections.output, errorOutput: connections.errorOutput },
    ports: { command: portCommand, output: ports.output, errorOutput: ports.errorOutput },
  };
}

module.exports = {
  listFiles,
  listProcesses,
  killProcess,
  listServices,
  serviceAction,
  listLogSources,
  readLog,
  diskOverview,
  findLargeFiles,
  networkInfo,
  run,
};
