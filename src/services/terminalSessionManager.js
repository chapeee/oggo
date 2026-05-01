const WebSocket = require("ws");
const { Client } = require("ssh2");
const { v4: uuidv4 } = require("uuid");
const { run } = require("../db/database");
const { buildConnectConfig, resolveServerCredentials } = require("./sshService");
const { detectError, recordTerminalHistory } = require("./commandIntelService");

const GUI_PREFIX = "\x1b[38;5;208m[GUI]\x1b[0m";
const sessions = new Map();

/**
 * Send websocket payload to all clients attached to a session.
 *
 * @param {import("./terminalSessionManager").TerminalSession} session
 * @param {Record<string, unknown>} payload
 * @returns {void}
 */
function broadcast(session, payload) {
  const text = JSON.stringify(payload);
  session.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  });
}

/**
 * Broadcast terminal text as normal terminal data frame.
 *
 * @param {import("./terminalSessionManager").TerminalSession} session
 * @param {string|Buffer} data
 * @returns {void}
 */
function broadcastTerminalData(session, data) {
  broadcast(session, { type: "data", data: Buffer.from(data).toString("base64") });
}

/**
 * Clean up a terminal session and close SSH resources.
 *
 * @param {import("./terminalSessionManager").TerminalSession} session
 * @returns {Promise<void>}
 */
async function closeSession(session) {
  if (!session || session.closed) return;
  session.closed = true;
  sessions.delete(session.id);

  const endedAt = Date.now();
  const duration = endedAt - new Date(session.startedAt).getTime();
  await run("UPDATE ssh_sessions SET ended_at = ?, duration = ? WHERE id = ?", [
    new Date(endedAt).toISOString(),
    duration,
    session.id,
  ]).catch(() => {});

  if (session.stream) {
    try {
      session.stream.end();
    } catch (_error) {
      // no-op
    }
  }
  try {
    session.conn.end();
  } catch (_error) {
    // no-op
  }
}

/**
 * Build and connect a terminal session for a server.
 *
 * @param {string} serverId
 * @param {Record<string, unknown>} serverRow
 * @returns {Promise<import("./terminalSessionManager").TerminalSession>}
 */
async function createSession(serverId, serverRow) {
  const id = uuidv4();
  const conn = new Client();
  const startedAt = new Date().toISOString();
  /** @type {import("./terminalSessionManager").TerminalSession} */
  const session = {
    id,
    serverId,
    startedAt,
    conn,
    stream: null,
    clients: new Set(),
    closed: false,
    ready: false,
    lineBuffer: "",
  };

  sessions.set(id, session);
  await run("INSERT INTO ssh_sessions (id, server_id, started_at, ended_at, duration) VALUES (?, ?, ?, NULL, NULL)", [
    id,
    serverId,
    startedAt,
  ]);

  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      run("UPDATE servers SET last_connected = ?, last_status = ? WHERE id = ?", [
        new Date().toISOString(),
        "online",
        serverId,
      ]).catch(() => {});
      conn.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        session.stream = stream;
        session.ready = true;

        stream.on("data", (data) => {
          const text = data.toString();
          broadcastTerminalData(session, data);
          const detected = detectError(text);
          if (detected) {
            broadcast(session, { type: "error_card", data: detected });
          }
          session.lineBuffer += text;
          if (session.lineBuffer.includes("\n")) {
            const parts = session.lineBuffer.split("\n");
            session.lineBuffer = parts.pop() || "";
            const latest = parts.map((item) => item.trim()).filter(Boolean).pop();
            if (latest) {
              recordTerminalHistory(serverId, latest, text, detected ? "failed" : "success").catch(() => {});
            }
          }
        });

        stream.stderr.on("data", (data) => {
          broadcastTerminalData(session, data);
        });

        stream.on("close", () => {
          closeSession(session).catch(() => {});
        });

        resolve(session);
      });
    });

    conn.on("error", (error) => {
      run("UPDATE servers SET last_status = ? WHERE id = ?", ["offline", serverId]).catch(() => {});
      broadcast(session, { type: "error", message: error.message });
      closeSession(session).catch(() => {});
      reject(error);
    });

    resolveServerCredentials(serverRow)
      .then((resolved) => {
        conn.connect(buildConnectConfig(resolved));
      })
      .catch((error) => reject(error));
  });
}

/**
 * Attach websocket client to an existing terminal session.
 *
 * @param {import("./terminalSessionManager").TerminalSession} session
 * @param {WebSocket} ws
 * @returns {void}
 */
function attachClient(session, ws) {
  session.clients.add(ws);
}

/**
 * Detach websocket client from session and close session if last client left.
 *
 * @param {string} sessionId
 * @param {WebSocket} ws
 * @returns {Promise<void>}
 */
async function detachClient(sessionId, ws) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.clients.delete(ws);
  if (session.clients.size === 0) {
    await closeSession(session);
  }
}

/**
 * Execute a command through SSH exec channel while mirroring into terminal.
 *
 * @param {string} sessionId
 * @param {string} command
 * @param {{ timeoutMs?: number, stdin?: string, silent?: boolean }} [options]
 * @returns {Promise<{output: string, errorOutput: string, exitCode: number}>}
 */
async function executeGuiCommand(sessionId, command, options = {}) {
  const session = sessions.get(sessionId);
  if (!session || session.closed || !session.ready) {
    throw new Error("Terminal session is not active");
  }

  if (!options.silent) {
    broadcastTerminalData(session, `${GUI_PREFIX} ${command}\r\n`);
  }
  const timeoutMs = Number(options.timeoutMs || 15000);
  const stdin = options.stdin === undefined || options.stdin === null ? null : String(options.stdin);
  const result = await new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";
    let done = false;

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("GUI command timeout"));
    }, timeoutMs);

    session.conn.exec(command, (error, stream) => {
      if (error) {
        clearTimeout(timeout);
        reject(error);
        return;
      }

      if (stdin !== null) {
        try {
          stream.write(stdin);
        } catch (_error) {}
      }
      try {
        stream.end();
      } catch (_error) {}

      stream.on("data", (data) => {
        const text = data.toString();
        output += text;
        if (!options.silent) {
          broadcastTerminalData(session, text);
        }
      });

      stream.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        if (!options.silent) {
          broadcastTerminalData(session, text);
        }
      });

      stream.on("close", (code) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        resolve({ output, errorOutput, exitCode: Number(code || 0) });
      });
    });
  });

  await recordTerminalHistory(session.serverId, command, `${result.output}\n${result.errorOutput}`, result.exitCode === 0 ? "success" : "failed").catch(
    () => {}
  );
  return result;
}

/**
 * Fetch terminal session by id.
 *
 * @param {string} sessionId
 * @returns {import("./terminalSessionManager").TerminalSession|null}
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Get active terminal session for a server.
 *
 * @param {string} serverId
 * @returns {import("./terminalSessionManager").TerminalSession|null}
 */
function getSessionByServerId(serverId) {
  const target = String(serverId || "").trim();
  if (!target) return null;
  for (const session of sessions.values()) {
    if (session.serverId === target && !session.closed) {
      return session;
    }
  }
  return null;
}

module.exports = {
  createSession,
  attachClient,
  detachClient,
  executeGuiCommand,
  getSession,
  getSessionByServerId,
};
