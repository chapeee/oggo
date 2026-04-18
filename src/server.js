require("dotenv").config();
const path = require("path");
const http = require("http");
const fs = require("fs-extra");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { Client } = require("ssh2");
const { loadConfig, ensureFirstRunPaths, getConfigFilePath } = require("./config/configLoader");
const { initializeDatabase, get, all, run } = require("./db/database");
const { appLogger } = require("./services/logService");
const { reloadAllJobs, getScheduledCount } = require("./services/cronService");
const { buildConnectConfig } = require("./services/sshService");
const { getDbPath, getRuntimePath } = require("./services/platformService");
const jobsRouter = require("./routes/jobs");
const logsRouter = require("./routes/logs");
const settingsRouter = require("./routes/settings");
const serversRouter = require("./routes/servers");
const keysRouter = require("./routes/keys");
const terminalRouter = require("./routes/terminal");
const {
  ensureBuiltinSnippets,
  recordTerminalHistory,
  detectError,
} = require("./services/commandIntelService");
const { initializeTldrIndex, shouldUpdate } = require("./services/tldrService");

const app = express();

function writeRuntimeFile(port) {
  fs.writeJSONSync(
    getRuntimePath(),
    {
      pid: process.pid,
      port,
      startedAt: new Date().toISOString(),
    },
    { spaces: 2 }
  );
}

function createApiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  appLogger.error(err.stack || err.message);
  return res.status(500).json({ error: err.message || "Internal server error", code: "INTERNAL_ERROR" });
}

async function init() {
  ensureFirstRunPaths();
  const config = loadConfig();
  const isFirstRun = config.database?.client === "sqlite" ? !fs.existsSync(getDbPath()) : false;

  await initializeDatabase();
  await ensureBuiltinSnippets();
  initializeTldrIndex().then((commands) => {
    appLogger.info(`TLDR index ready with ${commands.length} commands`);
  }).catch((error) => {
    appLogger.warn(`TLDR index init failed: ${error.message}`);
  });
  setInterval(async () => {
    try {
      if (shouldUpdate()) {
        appLogger.info("Refreshing TLDR cache...");
        const commands = await initializeTldrIndex();
        appLogger.info(`TLDR cache refreshed (${commands.length} commands)`);
      }
    } catch (error) {
      appLogger.warn(`TLDR refresh failed: ${error.message}`);
    }
  }, 1000 * 60 * 60 * 24);
  await reloadAllJobs(config);

  if (isFirstRun) {
    console.log("Welcome to Oggo!");
    console.log(`Config file created at ${getConfigFilePath()}`);
    console.log("You can edit this file to change settings");
    console.log(`Database created at ${getDbPath()}`);
  }

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "oggo", scheduledJobs: getScheduledCount() });
  });

  // Lightweight password protection for local API usage.
  app.use("/api", (req, res, next) => {
    const latestConfig = loadConfig();
    if (!latestConfig.passwordEnabled || !latestConfig.password) return next();
    const supplied = req.header("x-oggo-password") || req.query.password;
    if (supplied !== latestConfig.password) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    }
    return next();
  });

  app.use("/api/jobs", jobsRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/servers", serversRouter);
  app.use("/api/keys", keysRouter);
  app.use("/api/terminal", terminalRouter);

  app.post("/api/server/restart", (req, res) => {
    res.json({ message: "Restarting server in background..." });
    setTimeout(() => {
      const { spawn } = require("child_process");
      const child = spawn(process.platform === "win32" ? "oggo.cmd" : "oggo", ["restart"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }, 1000);
  });

  app.post("/api/server/stop", (req, res) => {
    res.json({ message: "Stopping server..." });
    setTimeout(() => {
      const { spawn } = require("child_process");
      const child = spawn(process.platform === "win32" ? "oggo.cmd" : "oggo", ["stop"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }, 1000);
  });

  app.get("/api/dashboard", async (req, res) => {
    const totals = await get(
      `
          SELECT
            COUNT(*) as totalJobs,
            SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as activeJobs
          FROM jobs
        `
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();

    const failedToday = (await get("SELECT COUNT(*) as count FROM logs WHERE status = 'failed' AND created_at >= ?", [startOfDay]))?.count || 0;

    const successRateData = await get(
      `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
          FROM logs
          WHERE created_at >= ?
        `,
      [startOfDay]
    );

    const successRate = successRateData.total
      ? Math.round((100 * (successRateData.success || 0)) / successRateData.total)
      : 100;

    const recentActivity = await all("SELECT * FROM logs ORDER BY created_at DESC LIMIT 10");

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);
    last7Days.setUTCHours(0, 0, 0, 0);

    const logsLast7Days = await all(`
      SELECT 
        SUBSTRING(created_at, 1, 10) as log_date,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM logs
      WHERE created_at >= ?
      GROUP BY log_date
      ORDER BY log_date ASC
    `, [last7Days.toISOString()]);

    res.json({
      data: {
        totalJobs: totals.totalJobs || 0,
        activeJobs: totals.activeJobs || 0,
        failedToday,
        successRate,
        recentActivity,
        chartData: logsLast7Days,
      },
    });
  });

  app.use(express.static(path.join(__dirname, "..", "public")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.use(createApiErrorHandler);

  const port = Number(process.env.PORT || config.port || 3030);
  const configuredHost = process.env.HOST || config.host || "0.0.0.0";
  const bindHost = configuredHost === "localhost" ? "0.0.0.0" : configuredHost;
  const publicHost = configuredHost === "0.0.0.0" ? "localhost" : configuredHost;
  const httpServer = http.createServer(app);
  const wss = new WebSocket.Server({ server: httpServer });

  wss.on("connection", async (ws, req) => {
    const match = req.url.match(/^\/terminal\/([^/?]+)/);
    if (!match) {
      ws.close(1008, "Invalid terminal path");
      return;
    }

    const serverId = match[1];
    const serverRow = await get("SELECT * FROM servers WHERE id = ?", [serverId]);
    if (!serverRow) {
      ws.send(JSON.stringify({ type: "error", message: "Server not found" }));
      ws.close();
      return;
    }

    const sessionId = require("uuid").v4();
    const startedAt = new Date().toISOString();
    await run("INSERT INTO ssh_sessions (id, server_id, started_at, ended_at, duration) VALUES (?, ?, ?, NULL, NULL)", [
      sessionId,
      serverId,
      startedAt,
    ]);

    const conn = new Client();
    let streamRef = null;
    let closed = false;

    conn.on("ready", () => {
      run("UPDATE servers SET last_connected = ?, last_status = ? WHERE id = ?", [
        new Date().toISOString(),
        "online",
        serverId,
      ]).catch(() => {});
      ws.send(JSON.stringify({ type: "status", status: "connected" }));
      conn.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          ws.send(JSON.stringify({ type: "error", message: err.message }));
          ws.close();
          conn.end();
          return;
        }
        streamRef = stream;
        let lineBuffer = "";
        stream.on("data", (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            const text = data.toString();
            ws.send(JSON.stringify({ type: "data", data: Buffer.from(data).toString("base64") }));
            const detected = detectError(text);
            if (detected) {
              ws.send(JSON.stringify({ type: "error_card", data: detected }));
            }
            lineBuffer += text;
            if (lineBuffer.includes("\n")) {
              const pieces = lineBuffer.split("\n");
              lineBuffer = pieces.pop() || "";
              const latest = pieces.map((p) => p.trim()).filter(Boolean).pop();
              if (latest) {
                recordTerminalHistory(serverId, latest, text, detected ? "failed" : "success").catch(() => {});
              }
            }
          }
        });
        stream.stderr.on("data", (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "data", data: Buffer.from(data).toString("base64") }));
          }
        });
        stream.on("close", () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        });
      });
    });

    conn.on("error", (error) => {
      run("UPDATE servers SET last_status = ? WHERE id = ?", ["offline", serverId]).catch(() => {});
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: error.message }));
        ws.close();
      }
    });

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (!streamRef) return;
        if (parsed.type === "data") {
          streamRef.write(parsed.data);
        }
        if (parsed.type === "resize") streamRef.setWindow(parsed.rows, parsed.cols, 0, 0);
      } catch (_error) {
        // ignore malformed messages
      }
    });

    const cleanup = () => {
      if (closed) return;
      closed = true;
      const endedAt = Date.now();
      const duration = endedAt - new Date(startedAt).getTime();
      run("UPDATE ssh_sessions SET ended_at = ?, duration = ? WHERE id = ?", [
        new Date(endedAt).toISOString(),
        duration,
        sessionId,
      ]).catch(() => {});
      if (streamRef) {
        try {
          streamRef.end();
        } catch (_error) {}
      }
      conn.end();
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);

    try {
      conn.connect(buildConnectConfig(serverRow));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error.message }));
      ws.close();
    }
  });

  const server = httpServer.listen(port, bindHost, () => {
    writeRuntimeFile(port);
    appLogger.info(`oggo-server listening on http://${publicHost}:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use.\n` +
          "Stop the other process or change port in ~/.Oggo oggo.config.json."
      );
      process.exit(1);
      return;
    }
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

init().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
