require("dotenv").config();
const path = require("path");
const http = require("http");
const fs = require("fs-extra");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { Client } = require("ssh2");
const { loadConfig, ensureFirstRunPaths, getConfigFilePath } = require("./config/configLoader");
const { initializeDatabase, get, run } = require("./db/database");
const { appLogger } = require("./services/logService");
const { reloadAllJobs, getScheduledCount } = require("./services/cronService");
const { buildConnectConfig } = require("./services/sshService");
const { getDbPath, getRuntimePath } = require("./services/platformService");
const { apiAuthMiddleware } = require("./middleware/auth");
const jobsRouter = require("./routes/jobs");
const dashboardRouter = require("./routes/dashboard");
const logsRouter = require("./routes/logs");
const settingsRouter = require("./routes/settings");
const serversRouter = require("./routes/servers");
const keysRouter = require("./routes/keys");
const terminalRouter = require("./routes/terminal");
const s3Router = require("./routes/s3");
const awsRouter = require("./routes/aws");
const workspacesRouter = require("./routes/workspaces");
const searchRouter = require("./routes/search");
const devToolsRouter = require("./routes/devtools");
const { errorHandler } = require("./middleware/error-handler");
const softwareRouter = require("./routes/software");
const {
  ensureBuiltinSnippets,
  recordTerminalHistory,
  detectError,
} = require("./services/commandIntelService");
const { initializeTldrIndex, shouldUpdate } = require("./services/tldrService");
const { buildSearchIndex } = require("./services/searchService");

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

async function init() {
  ensureFirstRunPaths();
  const config = loadConfig();
  const isFirstRun = config.database?.client === "sqlite" ? !fs.existsSync(getDbPath()) : false;

  await initializeDatabase();
  await ensureBuiltinSnippets();
  await buildSearchIndex().catch((error) => {
    appLogger.warn(`Search index init failed: ${error.message}`);
  });
  setInterval(() => {
    buildSearchIndex().catch((error) => {
      appLogger.warn(`Search index refresh failed: ${error.message}`);
    });
  }, 1000 * 60);
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

  app.use("/api", apiAuthMiddleware);

  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/servers", serversRouter);
  app.use("/api/keys", keysRouter);
  app.use("/api/terminal", terminalRouter);
  app.use("/api/s3", s3Router);
  app.use("/api/aws", awsRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/devtools", devToolsRouter);
  app.use("/api/software", softwareRouter);

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

  app.use(express.static(path.join(__dirname, "..", "public")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.use(errorHandler);

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
