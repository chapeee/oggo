const { randomUUID } = require("crypto");
const { all, run } = require("../database");
const { encrypt, decrypt } = require("../../services/sshService");

async function safeExec(dbApi, sql) {
  try {
    await dbApi.exec(sql);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      message.includes("duplicate") ||
      message.includes("already exists") ||
      message.includes("no such column") ||
      message.includes("doesn't exist") ||
      message.includes("unknown column")
    ) {
      return;
    }
    throw error;
  }
}

async function tableExists(name, engine) {
  if (engine === "mysql") {
    const rows = await all(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [name]
    );
    return rows.length > 0;
  }
  const rows = await all("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]);
  return rows.length > 0;
}

async function renameIfExists(dbApi, engine, from, to) {
  if (!(await tableExists(from, engine))) return;
  if (await tableExists(to, engine)) return;
  await safeExec(dbApi, `ALTER TABLE ${from} RENAME TO ${to}`);
}

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

async function migrateLegacyWorkspaceS3(engine) {
  const source = await tableExists("_deprecated_workspace_s3_configs", engine)
    ? "_deprecated_workspace_s3_configs"
    : (await tableExists("workspace_s3_configs", engine) ? "workspace_s3_configs" : null);
  if (!source) return;

  const rows = await all(
    `SELECT wsc.workspace_id, wsc.s3_config_id, wsc.label, sc.bucket_name, sc.region,
            sc.access_key_id, sc.secret_access_key_encrypted
     FROM ${source} wsc
     LEFT JOIN s3_connections sc ON sc.id = wsc.s3_config_id`
  );
  for (const row of rows) {
    if (!row.workspace_id || !row.bucket_name) continue;
    const exists = await all(
      "SELECT id FROM workspace_services WHERE workspace_id = ? AND service_type = 's3' AND resource_identifier = ? LIMIT 1",
      [row.workspace_id, row.bucket_name]
    );
    if (exists.length) continue;
    await run(
      `INSERT INTO workspace_services (
        id, workspace_id, service_type, friendly_name, access_key_id, secret_access_key,
        region, resource_identifier, config_json, status, last_tested_at, error_message, created_at
      ) VALUES (?, ?, 's3', ?, ?, ?, ?, ?, ?, 'untested', NULL, '', ?)`,
      [
        randomUUID(),
        row.workspace_id,
        row.label || row.bucket_name,
        encrypt(String(row.access_key_id || "")),
        String(row.secret_access_key_encrypted || ""),
        row.region || "us-east-1",
        row.bucket_name,
        JSON.stringify({}),
        new Date().toISOString(),
      ]
    );
  }
}

async function migrateLegacyWorkspaceServiceRows(engine) {
  const source = await tableExists("_deprecated_workspace_services", engine)
    ? "_deprecated_workspace_services"
    : (await tableExists("workspace_services", engine) ? "workspace_services" : null);
  if (!source) return;

  const oldRows = await all(`SELECT * FROM ${source}`);
  for (const row of oldRows) {
    if (!row.workspace_id || !row.service_type) continue;
    const legacyType = String(row.service_type || "").toLowerCase();
    const exists = await all(
      "SELECT id FROM workspace_services WHERE workspace_id = ? AND service_type = ? AND resource_identifier = ? LIMIT 1",
      [row.workspace_id, legacyType, String(row.service_identifier || "")]
    );
    if (exists.length) continue;

    let accessKeyId = "";
    let secretEncrypted = "";
    if (row.aws_connection_id) {
      const conn = await all("SELECT access_key_id, secret_access_key_encrypted FROM aws_connections WHERE id = ? LIMIT 1", [row.aws_connection_id]);
      if (conn[0]) {
        accessKeyId = encrypt(String(conn[0].access_key_id || ""));
        secretEncrypted = String(conn[0].secret_access_key_encrypted || "");
      }
    }
    const metadata = parseJson(row.metadata || "{}", {});
    await run(
      `INSERT INTO workspace_services (
        id, workspace_id, service_type, friendly_name, access_key_id, secret_access_key,
        region, resource_identifier, config_json, status, last_tested_at, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'untested', NULL, '', ?)`,
      [
        randomUUID(),
        row.workspace_id,
        legacyType,
        row.friendly_name || row.service_identifier || "",
        accessKeyId,
        secretEncrypted,
        row.region || "us-east-1",
        row.service_identifier || "",
        JSON.stringify(metadata),
        row.created_at || new Date().toISOString(),
      ]
    );
  }
}

async function migrateWorkspaceDefaults(engine) {
  const oldJoin = await tableExists("_deprecated_workspace_aws_connections", engine)
    ? "_deprecated_workspace_aws_connections"
    : (await tableExists("workspace_aws_connections", engine) ? "workspace_aws_connections" : null);
  if (!oldJoin) return;

  const links = await all(`SELECT workspace_id, aws_connection_id, is_primary FROM ${oldJoin}`);
  for (const link of links) {
    if (!link.workspace_id || !link.aws_connection_id) continue;
    const current = await all("SELECT default_access_key_id, default_secret_access_key FROM workspaces WHERE id = ? LIMIT 1", [link.workspace_id]);
    if (!current[0]) continue;
    if (current[0].default_access_key_id && current[0].default_secret_access_key) continue;
    const conn = await all("SELECT access_key_id, secret_access_key_encrypted, default_region FROM aws_connections WHERE id = ? LIMIT 1", [link.aws_connection_id]);
    if (!conn[0]) continue;
    await run(
      `UPDATE workspaces
       SET default_access_key_id = ?, default_secret_access_key = ?, default_region = COALESCE(default_region, ?), updated_at = ?
       WHERE id = ?`,
      [
        String(conn[0].access_key_id || ""),
        String(conn[0].secret_access_key_encrypted || ""),
        conn[0].default_region || "us-east-1",
        new Date().toISOString(),
        link.workspace_id,
      ]
    );
  }
}

async function up(dbApi) {
  const engine = dbApi.getDbEngine();
  const textType = engine === "mysql" ? "VARCHAR(64)" : "TEXT";

  await safeExec(
    dbApi,
    `ALTER TABLE workspaces ADD COLUMN default_access_key_id ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"}`
  );
  await safeExec(
    dbApi,
    `ALTER TABLE workspaces ADD COLUMN default_secret_access_key ${engine === "mysql" ? "LONGTEXT" : "TEXT"}`
  );
  await safeExec(dbApi, "ALTER TABLE workspaces DROP COLUMN aws_connection_id");

  await renameIfExists(dbApi, engine, "workspace_aws_connections", "_deprecated_workspace_aws_connections");
  await renameIfExists(dbApi, engine, "workspace_s3_configs", "_deprecated_workspace_s3_configs");
  await renameIfExists(dbApi, engine, "workspace_services", "_deprecated_workspace_services");

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS workspace_services (
      id ${textType} PRIMARY KEY,
      workspace_id ${textType} NOT NULL,
      service_type ${engine === "mysql" ? "VARCHAR(32)" : "TEXT"} NOT NULL,
      friendly_name ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"},
      access_key_id ${engine === "mysql" ? "LONGTEXT" : "TEXT"} NOT NULL,
      secret_access_key ${engine === "mysql" ? "LONGTEXT" : "TEXT"} NOT NULL,
      region ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL,
      resource_identifier ${engine === "mysql" ? "VARCHAR(1024)" : "TEXT"} NOT NULL,
      config_json ${engine === "mysql" ? "LONGTEXT" : "TEXT"},
      status ${engine === "mysql" ? "VARCHAR(16)" : "TEXT"} DEFAULT 'untested',
      last_tested_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      error_message ${engine === "mysql" ? "TEXT" : "TEXT"},
      created_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"}
    )
  `);

  await safeExec(
    dbApi,
    "CREATE INDEX IF NOT EXISTS idx_workspace_services_workspace_id ON workspace_services(workspace_id)"
  );
  await safeExec(
    dbApi,
    "CREATE INDEX IF NOT EXISTS idx_workspace_services_type ON workspace_services(service_type)"
  );

  await migrateWorkspaceDefaults(engine);
  await migrateLegacyWorkspaceS3(engine);
  await migrateLegacyWorkspaceServiceRows(engine);

  // Re-encrypt default access key if plain legacy values were copied.
  const rows = await all("SELECT id, default_access_key_id, default_secret_access_key FROM workspaces");
  for (const row of rows) {
    if (!row.default_access_key_id || !row.default_secret_access_key) continue;
    let access = String(row.default_access_key_id || "");
    let secret = String(row.default_secret_access_key || "");
    try {
      const decoded = decrypt(access);
      if (decoded) access = decoded;
    } catch (_error) {
      // legacy value, keep plain then encrypt below
    }
    try {
      const decodedSecret = decrypt(secret);
      if (decodedSecret) secret = encrypt(decodedSecret);
    } catch (_error) {
      secret = encrypt(secret);
    }
    await run(
      "UPDATE workspaces SET default_access_key_id = ?, default_secret_access_key = ?, updated_at = ? WHERE id = ?",
      [encrypt(access), secret, new Date().toISOString(), row.id]
    );
  }
}

async function down(_dbApi) {
  // No down migration for data-preserving redesign.
}

module.exports = { up, down };
