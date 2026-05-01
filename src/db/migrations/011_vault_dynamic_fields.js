/**
 * 011_vault_dynamic_fields.js
 *
 * Adds config_json and second_encrypted_value columns for dynamic vault fields.
 */

/**
 * Execute SQL and ignore duplicate/missing-table migration errors.
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
      message.includes("doesn't exist")
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Apply migration.
 *
 * @param {{ exec: Function, getDbEngine: Function }} dbApi
 * @returns {Promise<void>}
 */
async function up(dbApi) {
  const engine = dbApi.getDbEngine();
  const textType = engine === "mysql" ? "LONGTEXT" : "TEXT";
  await safeExec(dbApi, `ALTER TABLE vault_entries ADD COLUMN config_json ${textType}`);
  await safeExec(dbApi, `ALTER TABLE vault_entries ADD COLUMN second_encrypted_value ${textType}`);
}

/**
 * Roll back migration.
 *
 * @param {{ exec: Function }} _dbApi
 * @returns {Promise<void>}
 */
async function down(_dbApi) {
  // no-op for safety
}

module.exports = {
  up,
  down,
};

