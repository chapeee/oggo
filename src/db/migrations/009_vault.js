/**
 * 009_vault.js
 *
 * Adds vault tables for encrypted secret storage and service links.
 */

/**
 * Apply vault schema migration.
 *
 * @param {{ exec: Function, getDbEngine: Function }} dbApi
 * @returns {Promise<void>}
 */
async function up(dbApi) {
  const engine = dbApi.getDbEngine();
  const idType = engine === "mysql" ? "VARCHAR(64)" : "TEXT";
  const textType = engine === "mysql" ? "TEXT" : "TEXT";
  const longTextType = engine === "mysql" ? "LONGTEXT" : "TEXT";
  const intType = engine === "mysql" ? "INT" : "INTEGER";

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS vault_entries (
      id ${idType} PRIMARY KEY,
      name ${engine === "mysql" ? "VARCHAR(255)" : "TEXT"} NOT NULL,
      category ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL,
      username ${textType},
      encrypted_value ${longTextType} NOT NULL,
      notes ${textType},
      tags ${textType},
      is_shared ${intType} DEFAULT 0,
      expiry_date ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      rotation_count ${intType} DEFAULT 0,
      last_rotated_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      last_accessed_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      last_notified_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"},
      created_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL,
      updated_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL
    )
  `);

  await dbApi.exec(`
    CREATE TABLE IF NOT EXISTS vault_service_links (
      id ${idType} PRIMARY KEY,
      vault_entry_id ${idType} NOT NULL,
      service_type ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL,
      service_id ${idType} NOT NULL,
      field_name ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL,
      created_at ${engine === "mysql" ? "VARCHAR(64)" : "TEXT"} NOT NULL
    )
  `);

  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_vault_entries_category ON vault_entries(category)"
  );
  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_vault_entries_expiry ON vault_entries(expiry_date)"
  );
  await dbApi.exec(
    "CREATE INDEX IF NOT EXISTS idx_vault_links_entry ON vault_service_links(vault_entry_id)"
  );
}

/**
 * Roll back vault schema migration.
 *
 * @param {{ exec: Function }} dbApi
 * @returns {Promise<void>}
 */
async function down(dbApi) {
  await dbApi.exec("DROP TABLE IF EXISTS vault_service_links");
  await dbApi.exec("DROP TABLE IF EXISTS vault_entries");
}

module.exports = {
  up,
  down,
};

