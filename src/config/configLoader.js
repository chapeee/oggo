const fs = require("fs-extra");
const path = require("path");
const {
  getoggoDir,
  getoggoDataDir,
  getLogsDir,
  getConfigPath,
} = require("../services/platformService");

const DEFAULT_CONFIG = {
  port: 3030,
  host: "localhost",
  database: {
    client: "sqlite",
    sqlitePath: "",
    mysql: {
      host: "localhost",
      port: 3306,
      user: "",
      password: "",
      database: "",
    },
  },
  openBrowser: true,
  theme: "dark",
  password: "",
  passwordEnabled: false,
  smtp: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
  },
  notifications: {
    enabled: false,
    email: "",
    notifyOnFailure: true,
    notifyOnSuccess: false,
  },
  timezone: "UTC",
  logRetentionDays: 30,
  maxLogsPerJob: 100,
  s3: {
    defaultPresignedExpiryHours: 1,
    defaultUploadStorageClass: "STANDARD",
    multipartThresholdMb: 10,
    concurrentUploadLimit: 3,
    autoUploadJobLogs: false,
    defaultConnectionId: "",
    defaultLogFolderPattern: "logs/{YYYY}/{MM}/{DD}/",
    defaultUploadCondition: "failure",
    browserItemsPerPage: 50,
    browserSortBy: "lastModified",
    browserSortDir: "desc",
    showHiddenFiles: false,
    showFilePreviews: true,
  },
  security: {
    encryptionKey: "oggo-secret-key-change-this",
    verifyHostKeys: true,
    sshTimeoutSeconds: 10,
    sshKeepAliveSeconds: 10,
  },
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, source) {
  const out = { ...base };
  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    if (isObject(sourceValue) && isObject(out[key])) {
      out[key] = deepMerge(out[key], sourceValue);
      return;
    }
    out[key] = sourceValue;
  });
  return out;
}

function ensureFirstRunPaths() {
  fs.ensureDirSync(getoggoDir());
  fs.ensureDirSync(getoggoDataDir());
  fs.ensureDirSync(getLogsDir());
}

function getConfigFilePath() {
  return getConfigPath();
}

function loadConfig() {
  ensureFirstRunPaths();
  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    fs.writeJSONSync(configPath, DEFAULT_CONFIG, { spaces: 2 });
    return deepMerge(DEFAULT_CONFIG, {});
  }

  let parsed = {};
  try {
    parsed = fs.readJSONSync(configPath);
  } catch (error) {
    throw new Error(`Failed to parse config at ${configPath}: ${error.message}`);
  }

  const merged = deepMerge(DEFAULT_CONFIG, parsed);
  if (!merged.database.sqlitePath) {
    merged.database.sqlitePath = path.join(getoggoDataDir(), "oggo.db");
  }
  fs.writeJSONSync(configPath, merged, { spaces: 2 });
  return merged;
}

function saveConfig(newConfig) {
  ensureFirstRunPaths();
  const current = loadConfig();
  const merged = deepMerge(current, newConfig || {});
  fs.writeJSONSync(getConfigFilePath(), merged, { spaces: 2 });
  return merged;
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  getConfigFilePath,
  ensureFirstRunPaths,
};
