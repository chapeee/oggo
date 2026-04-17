const fs = require("fs-extra");
const Database = require("better-sqlite3");
const { getDbPath, getoggoDataDir } = require("../services/platformService");

let db;

function getDb() {
  if (!db) {
    fs.ensureDirSync(getoggoDataDir());
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  const instance = db || getDb();
  instance.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
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
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      job_name TEXT,
      status TEXT,
      output TEXT,
      error TEXT,
      duration INTEGER,
      exit_code INTEGER,
      created_at TEXT
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS servers (
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
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS server_jobs (
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
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS ssh_sessions (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      started_at TEXT,
      ended_at TEXT,
      duration INTEGER
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS known_hosts (
      id TEXT PRIMARY KEY,
      host TEXT,
      port INTEGER,
      fingerprint TEXT,
      added_at TEXT
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS ssh_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      public_key TEXT NOT NULL,
      private_key_encrypted TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS commands (
      name TEXT PRIMARY KEY,
      description TEXT,
      examples TEXT,
      platform TEXT,
      use_count INTEGER DEFAULT 0
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS terminal_history (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      command TEXT,
      output TEXT,
      status TEXT,
      created_at TEXT
    );
  `);

  instance.exec(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      command TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      category TEXT,
      builtin INTEGER DEFAULT 0,
      created_at TEXT
    );
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  initializeDatabase,
  closeDb,
};
