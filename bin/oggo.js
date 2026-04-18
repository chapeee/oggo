#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { execSync } = require("child_process");
const { Command } = require("commander");
const { loadConfig, getConfigFilePath, ensureFirstRunPaths } = require("../src/config/configLoader");
const { getRuntimePath, getConfigPath, getoggoDir, getLogsDir } = require("../src/services/platformService");
const { createInterface } = require("readline");

function askQuestion(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer)));
}

async function updateOggo() {
  console.log("Updating command suggestion database (tldr cache)...");
  execSync("npx tldr --update", { stdio: "inherit", windowsHide: true });
  console.log("tldr cache updated.");
}

async function promptFirstRun() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    (async () => {
      const portAnswer = await askQuestion(rl, "Welcome to Oggo! Which port would you like to run on? [3030]: ");
      const port = parseInt(portAnswer.trim(), 10) || 3030;

      const dbChoiceAnswer = await askQuestion(
        rl,
        "Choose database storage: 1) SQLite (default)  2) MySQL [1]: "
      );
      const useMysql = String(dbChoiceAnswer || "").trim() === "2";

      if (!useMysql) {
        rl.close();
        resolve({
          port,
          database: {
            client: "sqlite",
          },
        });
        return;
      }

      const host = (await askQuestion(rl, "MySQL host / URL [localhost]: ")).trim() || "localhost";
      const dbPort = parseInt((await askQuestion(rl, "MySQL port [3306]: ")).trim(), 10) || 3306;
      const user = (await askQuestion(rl, "MySQL username: ")).trim();
      const password = await askQuestion(rl, "MySQL password: ");
      const databaseName = (await askQuestion(rl, "MySQL database name: ")).trim();

      rl.close();
      resolve({
        port,
        database: {
          client: "mysql",
          mysql: {
            host,
            port: dbPort,
            user,
            password,
            database: databaseName,
          },
        },
      });
    })().catch((error) => {
      rl.close();
      throw error;
    });
  });
}

function runCommand(fn) {
  fn().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

function getRuntimeInfo() {
  const runtimePath = getRuntimePath();
  if (!fs.existsSync(runtimePath)) return null;
  try {
    return fs.readJSONSync(runtimePath);
  } catch (_error) {
    return null;
  }
}

function writeRuntimeInfo(data) {
  fs.ensureDirSync(path.dirname(getRuntimePath()));
  fs.writeJSONSync(getRuntimePath(), data, { spaces: 2 });
}

function removeRuntimeInfo() {
  if (fs.existsSync(getRuntimePath())) {
    fs.removeSync(getRuntimePath());
  }
}

function isPidAlive(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return;
  }
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function waitForServer(port, timeoutMs = 15000) {
  const start = Date.now();
  const urlPath = "/health";
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(
        {
          host: "127.0.0.1",
          port,
          path: urlPath,
          timeout: 1500,
        },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve(true);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server did not become ready on port ${port}`));
            return;
          }
          setTimeout(probe, 300);
        }
      );
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not become ready on port ${port}`));
          return;
        }
        setTimeout(probe, 300);
      });
      req.on("timeout", () => req.destroy());
    };
    probe();
  });
}

async function startOggo() {
  ensureFirstRunPaths();
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const firstRunConfig = await promptFirstRun();
    fs.ensureDirSync(getoggoDir());
    fs.writeJsonSync(configPath, firstRunConfig, { spaces: 2 });
  }

  const config = loadConfig();
  const port = Number(process.env.PORT || config.port || 3030);
  const url = `http://localhost:${port}`;
  const runtime = getRuntimeInfo();
  if (runtime?.pid && isPidAlive(runtime.pid)) {
    console.log(`Oggo is already running at ${url} (pid ${runtime.pid})`);
    openBrowser(url);
    process.exit(0);
  }

  console.log("Starting Oggo...");
  const child = spawn(process.execPath, [path.join(__dirname, "../src/server.js")], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  });
  child.unref();

  writeRuntimeInfo({
    pid: child.pid,
    port,
    url,
    startedAt: new Date().toISOString(),
  });

  try {
    await waitForServer(port, 15000);
    console.log(`✓ Oggo is running at ${url}`);
    openBrowser(url);
    process.exit(0);
  } catch (error) {
    if (isPidAlive(child.pid)) {
      try {
        process.kill(child.pid);
      } catch (_killError) {}
    }
    removeRuntimeInfo();
    throw error;
  }
}

async function stopOggo() {
  console.log("Stopping Oggo...");
  const runtime = getRuntimeInfo();
  if (!runtime?.pid) {
    console.log("Oggo is not running");
    return;
  }
  if (!isPidAlive(runtime.pid)) {
    removeRuntimeInfo();
    console.log("Oggo is not running");
    return;
  }
  try {
    process.kill(Number(runtime.pid));
    removeRuntimeInfo();
    console.log("Oggo stopped");
  } catch (error) {
    throw new Error(`Failed to stop process ${runtime.pid}: ${error.message}`);
  }
}

async function restartOggo() {
  console.log("Restarting Oggo...");
  await stopOggo();
  await startOggo();
}

async function statusOggo() {
  const runtime = getRuntimeInfo();
  if (!runtime?.pid) {
    console.log("Oggo status: stopped");
    return;
  }
  const alive = isPidAlive(runtime.pid);
  if (!alive) {
    removeRuntimeInfo();
    console.log("Oggo status: stopped");
    return;
  }
  console.log("Oggo status: running");
  console.log(`PID: ${runtime.pid}`);
  console.log(`URL: ${runtime.url || `http://localhost:${runtime.port || 3030}`}`);
}

async function openOggo() {
  const config = loadConfig();
  const port = Number(process.env.PORT || config.port || 3030);
  const url = `http://localhost:${port}`;
  openBrowser(url);
  console.log(`Opened ${url}`);
}

async function showConfig() {
  const config = loadConfig();
  console.log(`Config path: ${getConfigPath()}`);
  console.log(JSON.stringify(config, null, 2));
}

async function logsOggo() {
  const logFile = path.join(getLogsDir(), "app.log");
  if (!fs.existsSync(logFile)) {
    console.log("No log file found yet.");
    return;
  }
  const content = fs.readFileSync(logFile, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const recent = lines.slice(-80);
  console.log(recent.join("\n"));
}

const program = new Command();
program.name("oggo").description("Self-hosted cron job manager").version("1.0.0");
program.command("start").description("Start oggo-server").action(() => runCommand(startOggo));
program.command("stop").description("Stop oggo-server").action(() => runCommand(stopOggo));
program.command("restart").description("Restart oggo-server").action(() => runCommand(restartOggo));
program.command("status").description("Show Oggo status").action(() => runCommand(statusOggo));
program.command("open").description("Open Oggo UI in browser").action(() => runCommand(openOggo));
program.command("logs").description("Show recent Oggo logs").action(() => runCommand(logsOggo));
program.command("config").description("Show config file path").action(() => runCommand(showConfig));
program.command("update").description("Update command suggestion database").action(() => runCommand(updateOggo));

program.parse(process.argv);
