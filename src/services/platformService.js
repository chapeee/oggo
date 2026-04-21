const os = require("os");
const path = require("path");

function getHomeDir() {
  return os.homedir();
}

function getoggoDir() {
  return path.join(getHomeDir(), ".oggo");
}

function getoggoDataDir() {
  return path.join(getoggoDir(), "data");
}

function getLogsDir() {
  return path.join(getoggoDataDir(), "logs");
}

function getConfigPath() {
  return path.join(getoggoDir(), "oggo.config.json");
}

function getDbPath() {
  return path.join(getoggoDataDir(), "oggo.db");
}

function getRuntimePath() {
  return path.join(getoggoDataDir(), "runtime.json");
}

function getLogFilePath(jobId) {
  const date = new Date().toISOString().split("T")[0];
  return path.join(getLogsDir(), `job_${jobId}_${date}.log`);
}

function getSystemCrontabPath() {
  return process.platform === "linux" || process.platform === "darwin"
    ? "/etc/crontab"
    : null;
}

function isUnix() {
  return process.platform === "linux" || process.platform === "darwin";
}

module.exports = {
  getHomeDir,
  getoggoDir,
  getoggoDataDir,
  getLogsDir,
  getConfigPath,
  getDbPath,
  getRuntimePath,
  getLogFilePath,
  getSystemCrontabPath,
  isUnix,
};
