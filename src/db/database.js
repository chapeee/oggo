const fs = require("fs-extra");
const Database = require("better-sqlite3");
const mysql = require("mysql2/promise");
const { getoggoDataDir, getDbPath } = require("../services/platformService");
const { loadConfig } = require("../config/configLoader");

let db;
let engine = "sqlite";

function normalizeParams(sql, params) {
  if (!params || Array.isArray(params)) return { sql, values: params || [] };
  const values = [];
  const convertedSql = sql.replace(/@([a-zA-Z0-9_]+)/g, (_, key) => {
    values.push(params[key]);
    return "?";
  });
  return { sql: convertedSql, values };
}

function getSchemaStatements(targetEngine) {
  if (targetEngine === "mysql") {
    return [
      `CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        schedule VARCHAR(255) NOT NULL,
        description TEXT,
        enabled TINYINT(1) DEFAULT 1,
        notify VARCHAR(64) DEFAULT 'failure',
        created_at VARCHAR(64),
        updated_at VARCHAR(64),
        last_run VARCHAR(64),
        last_status VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64),
        job_name VARCHAR(255),
        status VARCHAR(64),
        output LONGTEXT,
        error LONGTEXT,
        duration INT,
        exit_code INT,
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value LONGTEXT
      )`,
      `CREATE TABLE IF NOT EXISTS servers (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INT DEFAULT 22,
        username VARCHAR(255) NOT NULL,
        auth_type VARCHAR(64) NOT NULL,
        password LONGTEXT,
        private_key_path TEXT,
        private_key_content LONGTEXT,
        passphrase LONGTEXT,
        color VARCHAR(32),
        tags TEXT,
        notes LONGTEXT,
        last_connected VARCHAR(64),
        last_status VARCHAR(64),
        created_at VARCHAR(64),
        sort_order INT DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS server_jobs (
        id VARCHAR(64) PRIMARY KEY,
        server_id VARCHAR(64),
        name VARCHAR(255),
        command TEXT,
        schedule VARCHAR(255),
        description TEXT,
        enabled TINYINT(1) DEFAULT 1,
        notify VARCHAR(64) DEFAULT 'failure',
        last_run VARCHAR(64),
        last_status VARCHAR(64),
        created_at VARCHAR(64),
        updated_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS ssh_sessions (
        id VARCHAR(64) PRIMARY KEY,
        server_id VARCHAR(64),
        started_at VARCHAR(64),
        ended_at VARCHAR(64),
        duration INT
      )`,
      `CREATE TABLE IF NOT EXISTS known_hosts (
        id VARCHAR(64) PRIMARY KEY,
        host VARCHAR(255),
        port INT,
        fingerprint VARCHAR(255),
        added_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS ssh_keys (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        algorithm VARCHAR(64) NOT NULL,
        public_key LONGTEXT NOT NULL,
        private_key_encrypted LONGTEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS commands (
        name VARCHAR(255) PRIMARY KEY,
        description TEXT,
        examples LONGTEXT,
        platform VARCHAR(64),
        use_count INT DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS terminal_history (
        id VARCHAR(64) PRIMARY KEY,
        server_id VARCHAR(64),
        command TEXT,
        output LONGTEXT,
        status VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS snippets (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        command TEXT NOT NULL,
        description TEXT,
        tags LONGTEXT,
        category VARCHAR(128),
        builtin TINYINT(1) DEFAULT 0,
        created_at VARCHAR(64)
      )`,
    ];
  }

  return [
    `CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      schedule TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      notify TEXT DEFAULT 'failure',
      created_at TEXT,
      updated_at TEXT,
      last_run TEXT,
      last_status TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      job_name TEXT,
      status TEXT,
      output TEXT,
      error TEXT,
      duration INTEGER,
      exit_code INTEGER,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      password TEXT,
      private_key_path TEXT,
      private_key_content TEXT,
      passphrase TEXT,
      color TEXT,
      tags TEXT,
      notes TEXT,
      last_connected TEXT,
      last_status TEXT,
      created_at TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS server_jobs (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT,
      command TEXT,
      schedule TEXT,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      notify TEXT DEFAULT 'failure',
      last_run TEXT,
      last_status TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ssh_sessions (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      started_at TEXT,
      ended_at TEXT,
      duration INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS known_hosts (
      id TEXT PRIMARY KEY,
      host TEXT,
      port INTEGER,
      fingerprint TEXT,
      added_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ssh_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      public_key TEXT NOT NULL,
      private_key_encrypted TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS commands (
      name TEXT PRIMARY KEY,
      description TEXT,
      examples TEXT,
      platform TEXT,
      use_count INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS terminal_history (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      command TEXT,
      output TEXT,
      status TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      command TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      category TEXT,
      builtin INTEGER DEFAULT 0,
      created_at TEXT
    )`,
  ];
}

async function createMysqlPool(mysqlConfig) {
  const bootstrap = await mysql.createConnection({
    host: mysqlConfig.host,
    port: Number(mysqlConfig.port || 3306),
    user: mysqlConfig.user,
    password: mysqlConfig.password,
  });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\``);
  await bootstrap.end();

  return mysql.createPool({
    host: mysqlConfig.host,
    port: Number(mysqlConfig.port || 3306),
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

async function initializeDatabase() {
  if (db) return db;

  const config = loadConfig();
  const client = config.database?.client || "sqlite";
  engine = client;

  if (client === "mysql") {
    const mysqlConfig = config.database?.mysql || {};
    db = await createMysqlPool(mysqlConfig);
    const statements = getSchemaStatements("mysql");
    for (const statement of statements) {
      await db.query(statement);
    }
    return db;
  }

  fs.ensureDirSync(getoggoDataDir());
  const sqlitePath = config.database?.sqlitePath || getDbPath();
  db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  const statements = getSchemaStatements("sqlite");
  for (const statement of statements) {
    db.exec(statement);
  }
  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database is not initialized. Call initializeDatabase() first.");
  }
  return db;
}

function getDbEngine() {
  return engine;
}

async function run(sql, params) {
  const instance = getDb();
  if (engine === "mysql") {
    const normalized = normalizeParams(sql, params);
    const [result] = await instance.execute(normalized.sql, normalized.values);
    return { changes: result.affectedRows || 0, insertId: result.insertId };
  }
  if (params && !Array.isArray(params)) {
    return instance.prepare(sql).run(params);
  }
  return instance.prepare(sql).run(...(params || []));
}

async function get(sql, params) {
  const instance = getDb();
  if (engine === "mysql") {
    const normalized = normalizeParams(sql, params);
    const [rows] = await instance.execute(normalized.sql, normalized.values);
    return rows[0] || null;
  }
  if (params && !Array.isArray(params)) {
    return instance.prepare(sql).get(params);
  }
  return instance.prepare(sql).get(...(params || []));
}

async function all(sql, params) {
  const instance = getDb();
  if (engine === "mysql") {
    const normalized = normalizeParams(sql, params);
    const [rows] = await instance.execute(normalized.sql, normalized.values);
    return rows;
  }
  if (params && !Array.isArray(params)) {
    return instance.prepare(sql).all(params);
  }
  return instance.prepare(sql).all(...(params || []));
}

async function exec(sql) {
  const instance = getDb();
  if (engine === "mysql") {
    return instance.query(sql);
  }
  return instance.exec(sql);
}

async function closeDb() {
  if (!db) return;
  if (engine === "mysql") {
    await db.end();
  } else {
    db.close();
  }
  db = null;
}

module.exports = {
  getDb,
  getDbEngine,
  initializeDatabase,
  closeDb,
  run,
  get,
  all,
  exec,
};
