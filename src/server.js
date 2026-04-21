require("dotenv").config();
const path = require("path");
const http = require("http");
const fs = require("fs-extra");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { loadConfig, ensureFirstRunPaths, getConfigFilePath } = require("./config/configLoader");
const { initializeDatabase, get } = require("./db/database");
const { appLogger } = require("./services/logService");
const { reloadAllJobs, getScheduledCount } = require("./services/cronService");
const { getDbPath, getRuntimePath } = require("./services/platformService");
const { apiAuthMiddleware } = require("./middleware/auth");
const jobsRouter = require("./routes/jobs");
const dashboardRouter = require("./routes/dashboard");
const logsRouter = require("./routes/logs");
const settingsRouter = require("./routes/settings");
const serversRouter = require("./routes/servers");
const keysRouter = require("./routes/keys");
const terminalRouter = require("./routes/terminal");
const terminalGuiRouter = require("./routes/terminal-gui");
const s3Router = require("./routes/s3");
const awsRouter = require("./routes/aws");
const workspacesRouter = require("./routes/workspaces");
const searchRouter = require("./routes/search");
const devToolsRouter = require("./routes/devtools");
const { errorHandler } = require("./middleware/error-handler");
const softwareRouter = require("./routes/software");
const savedCommandsRouter = require("./routes/saved-commands");
const { ensureBuiltinSnippets } = require("./services/commandIntelService");
const { initializeTldrIndex, shouldUpdate } = require("./services/tldrService");
const { buildSearchIndex } = require("./services/searchService");
const {
  createSession,
  attachClient,
  detachClient,
} = require("./services/terminalSessionManager");

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
  app.use("/api/terminal-gui", terminalGuiRouter);
  app.use("/api/saved-commands", savedCommandsRouter);
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

    let session = null;
    try {
      session = await createSession(serverId, serverRow);
      attachClient(session, ws);
      ws.send(JSON.stringify({ type: "status", status: "connected", sessionId: session.id }));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error.message }));
      ws.close();
      return;
    }

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (!session || !session.stream) return;
        if (parsed.type === "data") {
          session.stream.write(parsed.data);
        }
        if (parsed.type === "resize") session.stream.setWindow(parsed.rows, parsed.cols, 0, 0);
      } catch (_error) {
        // ignore malformed messages
      }
    });

    const cleanup = async () => {
      if (!session) return;
      await detachClient(session.id, ws);
      session = null;
    };

    ws.on("close", () => cleanup().catch(() => {}));
    ws.on("error", () => cleanup().catch(() => {}));
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
