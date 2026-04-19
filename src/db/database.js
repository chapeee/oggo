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
      `CREATE TABLE IF NOT EXISTS s3_connections (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(32),
        access_key_id VARCHAR(255) NOT NULL,
        secret_access_key_encrypted LONGTEXT NOT NULL,
        region VARCHAR(64) NOT NULL,
        bucket_name VARCHAR(255) NOT NULL,
        root_prefix TEXT,
        enabled TINYINT(1) DEFAULT 1,
        last_tested_at VARCHAR(64),
        last_test_result VARCHAR(32),
        last_test_message TEXT,
        file_count BIGINT DEFAULT 0,
        total_size_bytes BIGINT DEFAULT 0,
        created_at VARCHAR(64),
        updated_at VARCHAR(64),
        sort_order INT DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS job_s3_settings (
        job_id VARCHAR(64) PRIMARY KEY,
        upload_enabled TINYINT(1) DEFAULT 0,
        connection_id VARCHAR(64),
        upload_condition VARCHAR(32) DEFAULT 'failure',
        file_pattern VARCHAR(255) DEFAULT '{job}-{timestamp}.log',
        updated_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS aws_connections (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(32),
        access_key_id VARCHAR(255) NOT NULL,
        secret_access_key_encrypted LONGTEXT NOT NULL,
        session_token_encrypted LONGTEXT,
        default_region VARCHAR(64) NOT NULL,
        account_id VARCHAR(32),
        service_access LONGTEXT,
        last_tested_at VARCHAR(64),
        last_test_result VARCHAR(32),
        last_test_message TEXT,
        enabled TINYINT(1) DEFAULT 1,
        created_at VARCHAR(64),
        updated_at VARCHAR(64),
        sort_order INT DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS ssl_monitors (
        id VARCHAR(64) PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        port INT DEFAULT 443,
        check_interval VARCHAR(32) DEFAULT 'daily',
        thresholds_json LONGTEXT,
        channels_json LONGTEXT,
        issuer VARCHAR(255),
        issued_at VARCHAR(64),
        expires_at VARCHAR(64),
        days_remaining INT,
        status VARCHAR(32) DEFAULT 'unknown',
        last_checked_at VARCHAR(64),
        last_error TEXT,
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS dns_monitors (
        id VARCHAR(64) PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        record_type VARCHAR(16) DEFAULT 'A',
        expected_value LONGTEXT,
        check_interval VARCHAR(32) DEFAULT 'hourly',
        channels_json LONGTEXT,
        current_value LONGTEXT,
        status VARCHAR(32) DEFAULT 'unknown',
        last_checked_at VARCHAR(64),
        last_error TEXT,
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS port_monitors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INT NOT NULL,
        protocol VARCHAR(8) DEFAULT 'tcp',
        expected_banner VARCHAR(255),
        check_interval VARCHAR(32) DEFAULT 'hourly',
        channels_json LONGTEXT,
        status VARCHAR(32) DEFAULT 'unknown',
        response_time_ms INT,
        last_checked_at VARCHAR(64),
        last_error TEXT,
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS env_variables (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        source_type VARCHAR(32) DEFAULT 'manual',
        value_encrypted LONGTEXT,
        aws_connection_id VARCHAR(64),
        secret_ref VARCHAR(512),
        secret_key VARCHAR(255),
        scope_type VARCHAR(32) DEFAULT 'global',
        scope_target_id VARCHAR(64),
        sensitive TINYINT(1) DEFAULT 1,
        group_name VARCHAR(255),
        last_used_at VARCHAR(64),
        created_at VARCHAR(64),
        updated_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS http_checks (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        method VARCHAR(16) DEFAULT 'GET',
        headers_json LONGTEXT,
        body_text LONGTEXT,
        timeout_seconds INT DEFAULT 10,
        follow_redirects TINYINT(1) DEFAULT 1,
        assertions_json LONGTEXT,
        alert_after_failures INT DEFAULT 1,
        retry_before_fail TINYINT(1) DEFAULT 0,
        channels_json LONGTEXT,
        status VARCHAR(32) DEFAULT 'unknown',
        last_response_time_ms INT,
        last_status_code INT,
        last_checked_at VARCHAR(64),
        last_error TEXT,
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(32),
        default_region VARCHAR(64) DEFAULT 'us-east-1',
        created_at VARCHAR(64),
        updated_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_aws_connections (
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64) NOT NULL,
        is_primary TINYINT(1) DEFAULT 0,
        PRIMARY KEY (workspace_id, aws_connection_id)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_s3_configs (
        workspace_id VARCHAR(64) NOT NULL,
        s3_config_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (workspace_id, s3_config_id)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_sns_topics (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        topic_name VARCHAR(255) NOT NULL,
        topic_arn TEXT,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_ses_identities (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        identity VARCHAR(255) NOT NULL,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_cloudwatch_groups (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        log_group_prefix TEXT,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_rds_instances (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        instance_identifier VARCHAR(255) NOT NULL,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_ec2_instances (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        instance_id VARCHAR(255) NOT NULL,
        region VARCHAR(64),
        linked_server_id VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_lambda_functions (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        function_name VARCHAR(255) NOT NULL,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_secrets (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL,
        aws_connection_id VARCHAR(64),
        secret_name VARCHAR(255) NOT NULL,
        secret_arn TEXT,
        region VARCHAR(64),
        created_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS package_pins (
        id VARCHAR(64) PRIMARY KEY,
        server_id VARCHAR(64) NOT NULL,
        package_manager VARCHAR(64) NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        version VARCHAR(128),
        created_at VARCHAR(64),
        updated_at VARCHAR(64)
      )`,
      `CREATE TABLE IF NOT EXISTS package_history (
        id VARCHAR(64) PRIMARY KEY,
        server_id VARCHAR(64) NOT NULL,
        package_manager VARCHAR(64) NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        action VARCHAR(64) NOT NULL,
        from_version VARCHAR(128),
        to_version VARCHAR(128),
        status VARCHAR(32) NOT NULL,
        output LONGTEXT,
        triggered_by VARCHAR(128),
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
    `CREATE TABLE IF NOT EXISTS s3_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      access_key_id TEXT NOT NULL,
      secret_access_key_encrypted TEXT NOT NULL,
      region TEXT NOT NULL,
      bucket_name TEXT NOT NULL,
      root_prefix TEXT,
      enabled INTEGER DEFAULT 1,
      last_tested_at TEXT,
      last_test_result TEXT,
      last_test_message TEXT,
      file_count INTEGER DEFAULT 0,
      total_size_bytes INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS job_s3_settings (
      job_id TEXT PRIMARY KEY,
      upload_enabled INTEGER DEFAULT 0,
      connection_id TEXT,
      upload_condition TEXT DEFAULT 'failure',
      file_pattern TEXT DEFAULT '{job}-{timestamp}.log',
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS aws_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      access_key_id TEXT NOT NULL,
      secret_access_key_encrypted TEXT NOT NULL,
      session_token_encrypted TEXT,
      default_region TEXT NOT NULL,
      account_id TEXT,
      service_access TEXT,
      last_tested_at TEXT,
      last_test_result TEXT,
      last_test_message TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ssl_monitors (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      port INTEGER DEFAULT 443,
      check_interval TEXT DEFAULT 'daily',
      thresholds_json TEXT,
      channels_json TEXT,
      issuer TEXT,
      issued_at TEXT,
      expires_at TEXT,
      days_remaining INTEGER,
      status TEXT DEFAULT 'unknown',
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS dns_monitors (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      record_type TEXT DEFAULT 'A',
      expected_value TEXT,
      check_interval TEXT DEFAULT 'hourly',
      channels_json TEXT,
      current_value TEXT,
      status TEXT DEFAULT 'unknown',
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS port_monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT DEFAULT 'tcp',
      expected_banner TEXT,
      check_interval TEXT DEFAULT 'hourly',
      channels_json TEXT,
      status TEXT DEFAULT 'unknown',
      response_time_ms INTEGER,
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS env_variables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT DEFAULT 'manual',
      value_encrypted TEXT,
      aws_connection_id TEXT,
      secret_ref TEXT,
      secret_key TEXT,
      scope_type TEXT DEFAULT 'global',
      scope_target_id TEXT,
      sensitive INTEGER DEFAULT 1,
      group_name TEXT,
      last_used_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS http_checks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT DEFAULT 'GET',
      headers_json TEXT,
      body_text TEXT,
      timeout_seconds INTEGER DEFAULT 10,
      follow_redirects INTEGER DEFAULT 1,
      assertions_json TEXT,
      alert_after_failures INTEGER DEFAULT 1,
      retry_before_fail INTEGER DEFAULT 0,
      channels_json TEXT,
      status TEXT DEFAULT 'unknown',
      last_response_time_ms INTEGER,
      last_status_code INTEGER,
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      default_region TEXT DEFAULT 'us-east-1',
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_aws_connections (
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      PRIMARY KEY (workspace_id, aws_connection_id)
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_s3_configs (
      workspace_id TEXT NOT NULL,
      s3_config_id TEXT NOT NULL,
      PRIMARY KEY (workspace_id, s3_config_id)
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_sns_topics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      topic_name TEXT NOT NULL,
      topic_arn TEXT,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_ses_identities (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      identity TEXT NOT NULL,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_cloudwatch_groups (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      name TEXT NOT NULL,
      log_group_prefix TEXT,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_rds_instances (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      instance_identifier TEXT NOT NULL,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_ec2_instances (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      instance_id TEXT NOT NULL,
      region TEXT,
      linked_server_id TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_lambda_functions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      function_name TEXT NOT NULL,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_secrets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      aws_connection_id TEXT,
      secret_name TEXT NOT NULL,
      secret_arn TEXT,
      region TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS package_pins (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      package_manager TEXT NOT NULL,
      package_name TEXT NOT NULL,
      version TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS package_history (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      package_manager TEXT NOT NULL,
      package_name TEXT NOT NULL,
      action TEXT NOT NULL,
      from_version TEXT,
      to_version TEXT,
      status TEXT NOT NULL,
      output TEXT,
      triggered_by TEXT,
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
