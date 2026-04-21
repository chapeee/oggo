/**
 * sftpExplorerService.js
 *
 * SFTP-backed filesystem operations for terminal explorer.
 * Uses active SSH terminal sessions and avoids extra dependencies.
 */

const path = require("path");
const { getSession, executeGuiCommand } = require("./terminalSessionManager");
const { validationError } = require("../errors/app-error");

const MAX_EDITOR_SIZE = 10 * 1024 * 1024;
const WARN_EDITOR_SIZE = 2 * 1024 * 1024;

/**
 * Convert callback-style method to promise.
 *
 * @param {(cb: Function) => void} fn
 * @returns {Promise<unknown>}
 */
function fromCallback(fn) {
  return new Promise((resolve, reject) => {
    fn((error, value, extra) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(extra === undefined ? value : [value, extra]);
    });
  });
}

/**
 * Build unix-style permission text from mode.
 *
 * @param {number} mode
 * @param {"file"|"directory"|"symlink"|"other"} type
 * @returns {string}
 */
function modeToString(mode, type) {
  const head = type === "directory" ? "d" : type === "symlink" ? "l" : "-";
  const flags = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  const chars = ["r", "w", "x", "r", "w", "x", "r", "w", "x"];
  return `${head}${flags.map((bit, i) => ((mode & bit) !== 0 ? chars[i] : "-")).join("")}`;
}

/**
 * Resolve explorer path with home expansion.
 *
 * @param {string} sessionId
 * @param {string} inputPath
 * @returns {Promise<string>}
 */
async function resolveRemotePath(sessionId, inputPath) {
  const value = String(inputPath || "~").trim() || "~";
  if (value.startsWith("/")) return value;
  const homeRes = await executeGuiCommand(sessionId, "printf %s \"$HOME\"", { timeoutMs: 8000 });
  const home = String(homeRes.output || "").trim() || "/";
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.posix.join(home, value.slice(2));
  return path.posix.join(home, value);
}

/**
 * Get active SFTP channel for session.
 *
 * @param {string} sessionId
 * @returns {Promise<{session: any, sftp: any}>}
 */
async function getSftp(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.closed || !session.ready) {
    throw validationError("Terminal session is not active");
  }
  if (session.sftp) return { session, sftp: session.sftp };
  const sftp = await new Promise((resolve, reject) => {
    session.conn.sftp((error, channel) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(channel);
    });
  });
  session.sftp = sftp;
  return { session, sftp };
}

/**
 * List directory with SFTP metadata.
 *
 * @param {string} sessionId
 * @param {string} inputPath
 * @param {{showHidden?: boolean}} [options]
 * @returns {Promise<{path: string, entries: Array<Object>}>}
 */
async function listDirectory(sessionId, inputPath, options = {}) {
  const { sftp } = await getSftp(sessionId);
  const targetPath = await resolveRemotePath(sessionId, inputPath);
  const rows = await fromCallback((cb) => sftp.readdir(targetPath, cb));
  const showHidden = Boolean(options.showHidden);
  const entries = (rows || [])
    .filter((row) => row && row.filename && row.filename !== "." && row.filename !== "..")
    .filter((row) => showHidden || !String(row.filename).startsWith("."))
    .map((row) => {
      const mode = Number(row.attrs?.mode || 0);
      const isDir = row.longname?.startsWith("d");
      const isLink = row.longname?.startsWith("l");
      const type = isDir ? "directory" : isLink ? "symlink" : "file";
      return {
        name: row.filename,
        type,
        size: Number(row.attrs?.size || 0),
        owner: String(row.attrs?.uid ?? ""),
        group: String(row.attrs?.gid ?? ""),
        permissions: modeToString(mode, type),
        mode,
        modifiedAt: Number(row.attrs?.mtime || 0) * 1000,
        path: path.posix.join(targetPath, row.filename),
      };
    })
    .sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
  return { path: targetPath, entries };
}

/**
 * Read file content for editor.
 *
 * @param {string} sessionId
 * @param {string} inputPath
 * @returns {Promise<{path: string, size: number, tooLarge: boolean, warnLarge: boolean, isBinary: boolean, content: string|null}>}
 */
async function readFile(sessionId, inputPath) {
  const { sftp } = await getSftp(sessionId);
  const targetPath = await resolveRemotePath(sessionId, inputPath);
  const stats = await fromCallback((cb) => sftp.stat(targetPath, cb));
  const size = Number(stats?.size || 0);
  if (size > MAX_EDITOR_SIZE) {
    return { path: targetPath, size, tooLarge: true, warnLarge: true, isBinary: false, content: null };
  }
  const chunks = [];
  const stream = sftp.createReadStream(targetPath);
  const content = await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const probe = content.subarray(0, Math.min(content.length, 512));
  const isBinary = probe.includes(0);
  return {
    path: targetPath,
    size,
    tooLarge: false,
    warnLarge: size > WARN_EDITOR_SIZE,
    isBinary,
    content: isBinary ? null : content.toString("utf8"),
  };
}

/**
 * Write file content via SFTP.
 *
 * @param {string} sessionId
 * @param {string} inputPath
 * @param {string} content
 * @param {{ sudoPassword?: string, sudoUser?: string }} [options]
 * @returns {Promise<{path: string, saved: boolean, size: number}>}
 */
async function writeFile(sessionId, inputPath, content, options = {}) {
  const { sftp } = await getSftp(sessionId);
  const targetPath = await resolveRemotePath(sessionId, inputPath);
  const buffer = Buffer.from(String(content || ""), "utf8");
  try {
    await writeFileViaSftp(sftp, targetPath, buffer);
  } catch (error) {
    const msg = String(error?.message || "");
    const permDenied = msg.toLowerCase().includes("permission denied") || error?.code === 3;
    if (!permDenied || !options?.sudoPassword) throw error;
    await writeFileWithSudo(sessionId, sftp, targetPath, buffer, options);
  }
  return { path: targetPath, saved: true, size: buffer.length };
}

/**
 * Write file via SFTP createWriteStream.
 *
 * @param {any} sftp
 * @param {string} targetPath
 * @param {Buffer} buffer
 * @returns {Promise<void>}
 */
async function writeFileViaSftp(sftp, targetPath, buffer) {
  await new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(targetPath);
    stream.on("error", reject);
    stream.on("close", resolve);
    stream.end(buffer);
  });
}

/**
 * Write file via sudo tee using a temporary file uploaded through SFTP.
 *
 * @param {string} sessionId
 * @param {any} sftp
 * @param {string} targetPath
 * @param {Buffer} buffer
 * @param {{ sudoPassword?: string, sudoUser?: string }} options
 * @returns {Promise<void>}
 */
async function writeFileWithSudo(sessionId, sftp, targetPath, buffer, options) {
  const tmp = `/tmp/oggo-write-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  await writeFileViaSftp(sftp, tmp, buffer);
  const user = String(options?.sudoUser || "").trim();
  const sudoUserArg = user ? `-u ${user.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";
  const cmd = `sudo -S ${sudoUserArg} tee '${targetPath.replace(/'/g, `'\\''`)}' < '${tmp}' > /dev/null`;
  const res = await executeGuiCommand(sessionId, cmd, { timeoutMs: 30000, stdin: `${options.sudoPassword}\n` });
  await fromCallback((cb) => sftp.unlink(tmp, cb)).catch(() => {});
  if (res.exitCode !== 0) {
    throw new Error(res.errorOutput || res.output || "sudo write failed");
  }
}

module.exports = {
  listDirectory,
  readFile,
  writeFile,
};
