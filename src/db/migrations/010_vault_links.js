/**
 * 010_vault_links.js
 *
 * Adds vault link columns for service credentials.
 */

/**
 * Execute SQL and ignore duplicate/missing-table style migration errors.
 *
 * @param {{ exec: Function }} dbApi
 * @param {string} sql
 * @returns {Promise<void>}
 */
async function safeExec(dbApi, sql) {
  try {
    await dbApi.exec(sql);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      message.includes("duplicate") ||
      message.includes("already exists") ||
      message.includes("no such table") ||
      message.includes("doesn't exist") ||
      message.includes("unknown table")
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Apply service vault-link migration.
 *
 * @param {{ exec: Function, getDbEngine: Function }} dbApi
 * @returns {Promise<void>}
 */
async function up(dbApi) {
  const engine = dbApi.getDbEngine();
  const idType = engine === "mysql" ? "VARCHAR(64)" : "TEXT";
  await safeExec(dbApi, `ALTER TABLE servers ADD COLUMN vault_entry_id ${idType}`);
  await safeExec(dbApi, `ALTER TABLE redis_connections ADD COLUMN vault_entry_id ${idType}`);
}

/**
 * Roll back service vault-link migration.
 *
 * @param {{ exec: Function }} _dbApi
 * @returns {Promise<void>}
 */
async function down(_dbApi) {
  // Intentionally no-op to preserve linked references.
}

module.exports = {
  up,
  down,
};

