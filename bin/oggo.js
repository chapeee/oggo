#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { Command } = require("commander");
const { loadConfig, getConfigFilePath, ensureFirstRunPaths } = require("../src/config/configLoader");
const { getRuntimePath, getConfigPath, getoggoDir } = require("../src/services/platformService");
const { createInterface } = require("readline");
const pm2 = require("pm2");

const PROCESS_NAME = "oggo-server";

function promptFirstRun() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Welcome to Oggo! Which port would you like to run on? [3030]: ", (answer) => {
      const port = parseInt(answer.trim(), 10) || 3030;
      rl.close();
      resolve(port);
    });
  });
}

function runCommand(fn) {
  fn().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

async function startOggo() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const port = await promptFirstRun();
    fs.ensureDirSync(getoggoDir());
    fs.writeJsonSync(configPath, { port }, { spaces: 2 });
  }

  console.log("Starting Oggo...");

  pm2.connect((err) => {
    if (err) {
      console.error("Failed to connect to PM2", err);
      process.exit(2);
    }

    pm2.start(
      {
        name: PROCESS_NAME,
        script: path.join(__dirname, "../src/server.js"),
        exec_mode: "fork",
        max_memory_restart: "1G",
        autorestart: true,
      },
      (err, apps) => {
        pm2.disconnect();
        if (err) {
          console.error("Failed to start Oggo", err);
          process.exit(2);
        }
        console.log("✓ Oggo is running");
        console.log("✓ Run 'oggo status' to check status");
      }
    );
  });
}

async function stopOggo() {
  console.log("Stopping Oggo...");
  pm2.connect((err) => {
    if (err) {
      console.error("Failed to connect to PM2");
      process.exit(2);
    }
    pm2.stop(PROCESS_NAME, (err) => {
      pm2.disconnect();
      if (err) {
        console.error("Oggo is not running");
      } else {
        console.log("Oggo stopped");
      }
    });
  });
}

async function restartOggo() {
  console.log("Restarting Oggo...");
  pm2.connect((err) => {
    if (err) {
      console.error("Failed to connect to PM2");
      process.exit(2);
    }
    pm2.restart(PROCESS_NAME, (err) => {
      pm2.disconnect();
      if (err) {
        console.error("Failed to restart Oggo");
      } else {
        console.log("Oggo restarted");
      }
    });
  });
}

async function statusOggo() {
  pm2.connect((err) => {
    if (err) {
      console.error("Failed to connect to PM2");
      process.exit(2);
    }
    pm2.describe(PROCESS_NAME, (err, processDescription) => {
      pm2.disconnect();
      if (err || processDescription.length === 0) {
        console.log("Oggo status: stopped");
      } else {
        const status = processDescription[0].pm2_env.status;
        if (status === "online") {
          console.log("Oggo status: running");
        } else {
          console.log(`Oggo status: ${status}`);
        }
      }
    });
  });
}

async function openOggo() {
  console.log("Please open http://localhost:3030 in your browser.");
}

async function showConfig() {
  console.log(`Config path: ${getConfigPath()}`);
}

const program = new Command();
program.name("oggo").description("Self-hosted cron job manager").version("1.0.0");
program.command("start").description("Start oggo-server").action(() => runCommand(startOggo));
program.command("stop").description("Stop oggo-server").action(() => runCommand(stopOggo));
program.command("restart").description("Restart oggo-server").action(() => runCommand(restartOggo));
program.command("status").description("Show Oggo status").action(() => runCommand(statusOggo));
program.command("open").description("Open Oggo UI in browser").action(() => runCommand(openOggo));
program.command("config").description("Show config file path").action(() => runCommand(showConfig));

program.parse(process.argv);
