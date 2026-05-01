/**
 * 012_ai_settings.js
 *
 * Adds persistent AI assistant settings storage.
 */

/**
 * Execute SQL safely and ignore duplicate/missing-object migration errors.
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
  const idType = engine === "mysql" ? "INT" : "INTEGER";
  const intType = engine === "mysql" ? "TINYINT(1)" : "INTEGER";
  const textType = engine === "mysql" ? "LONGTEXT" : "TEXT";
  await safeExec(
    dbApi,
    `CREATE TABLE IF NOT EXISTS ai_settings (
      id ${idType} PRIMARY KEY,
      enabled ${intType} DEFAULT 0,
      provider TEXT DEFAULT 'nvidia',
      api_key ${textType},
      model TEXT,
      created_at TEXT,
      updated_at TEXT
    )`
  );
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
