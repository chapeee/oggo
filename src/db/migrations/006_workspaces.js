/**
 * 006_workspaces.js
 *
 * Workspace schema migration.
 * Creates normalized workspace tables and indexes used by
 * routes/services/repositories for AWS workspace management.
 */

/**
 * Execute SQL and ignore known duplicate-column errors.
 *
 * @param {{ exec: Function, getDbEngine: Function }} dbApi
 * @param {string} sql
 * @returns {Promise<void>}
 */
async function safeExec(dbApi, sql) {
  try {
    await dbApi.exec(sql);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("duplicate column") || message.includes("duplicate")) {
      return;
    }
    throw error;
  }
}

/**
 * Apply workspace migration.
 *
 * @param {{ exec: Function, getDbEngine: Function }} dbApi
 * @returns {Promise<void>}
 */
async function up(dbApi) {
  const engine = dbApi.getDbEngine();
  const textType = engine === "mysql" ? "VARCHAR(64)" : "TEXT";
  const boolType = engine === "mysql" ? "TINYINT(1)" : "INTEGER";

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id ${textType} PRIMARY KEY,
      name ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"} NOT NULL,
      description ${engine === "mysql" ? "TEXT" : "TEXT"},
      color ${engine === "mysql" ? "VARCHAR(32)" : "TEXT"},
      default_region ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      created_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      updated_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"}
    )
  `);

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS workspace_aws_connections (
      workspace_id ${textType} NOT NULL,
      aws_connection_id ${textType} NOT NULL,
      is_primary ${boolType} DEFAULT 0,
      PRIMARY KEY (workspace_id, aws_connection_id)
    )
  `);

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS workspace_s3_configs (
      id ${textType} PRIMARY KEY,
      workspace_id ${textType} NOT NULL,
      s3_config_id ${textType} NOT NULL,
      label ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"}
    )
  `);

  await safeExec(
    dbApi,
    `ALTER TABLE workspace_s3_configs ADD COLUMN id ${textType}`
  );
  await safeExec(
    dbApi,
    `ALTER TABLE workspace_s3_configs ADD COLUMN label ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"}`
  );

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS workspace_services (
      id ${textType} PRIMARY KEY,
      workspace_id ${textType} NOT NULL,
      aws_connection_id ${textType} NOT NULL,
      service_type ${engine === "mysql" ? "VARCHAR(32)" : "TEXT"} NOT NULL,
      service_identifier ${engine === "mysql" ? "VARCHAR(512)" : "TEXT"} NOT NULL,
      friendly_name ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"},
      region ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      metadata ${engine === "mysql" ? "LONGTEXT" : "TEXT"},
      created_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"}
    )
  `);

  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_workspace_aws_connections_workspace_id ON workspace_aws_connections(workspace_id)"
  );
  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_workspace_s3_configs_workspace_id ON workspace_s3_configs(workspace_id)"
  );
  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_workspace_services_workspace_id ON workspace_services(workspace_id)"
  );
  await dbApi.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_s3_configs_unique ON workspace_s3_configs(workspace_id, s3_config_id)"
  );
}

/**
 * Roll back workspace migration.
 *
 * @param {{ exec: Function }} dbApi
 * @returns {Promise<void>}
 */
async function down(dbApi) {
  await dbApi.exec("DROP TABLE IF EXISTS workspace_services");
  await dbApi.exec("DROP TABLE IF EXISTS workspace_s3_configs");
  await dbApi.exec("DROP TABLE IF EXISTS workspace_aws_connections");
  await dbApi.exec("DROP TABLE IF EXISTS workspaces");
}

module.exports = {
  up,
  down,
};
