const { all, get, run } = require("../database");

/**
 * List saved commands by scope and optional server id.
 *
 * @param {"global"|"server"} scope
 * @param {string|null} [serverId]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listSavedCommands(scope, serverId = null) {
  if (scope === "global") {
    return all(
      "SELECT * FROM saved_commands WHERE scope = 'global' ORDER BY sort_order ASC, created_at DESC"
    );
  }
  return all(
    "SELECT * FROM saved_commands WHERE scope = 'server' AND server_id = ? ORDER BY sort_order ASC, created_at DESC",
    [serverId]
  );
}

/**
 * Create saved command record.
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<void>}
 */
async function createSavedCommand(payload) {
  await run(
    `INSERT INTO saved_commands
      (id, server_id, name, command, category, scope, sort_order, created_at, last_used_at, use_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.id,
      payload.server_id || null,
      payload.name,
      payload.command,
      payload.category || null,
      payload.scope,
      Number(payload.sort_order || 0),
      payload.created_at,
      payload.last_used_at || null,
      Number(payload.use_count || 0),
    ]
  );
}

/**
 * Update saved command by id.
 *
 * @param {string} id
 * @param {Record<string, unknown>} payload
 * @returns {Promise<void>}
 */
async function updateSavedCommand(id, payload) {
  await run(
    `UPDATE saved_commands
      SET name = ?, command = ?, category = ?, sort_order = ?
      WHERE id = ?`,
    [payload.name, payload.command, payload.category || null, Number(payload.sort_order || 0), id]
  );
}

/**
 * Increment usage stats for saved command.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function markSavedCommandUsed(id) {
  await run(
    `UPDATE saved_commands
      SET use_count = COALESCE(use_count, 0) + 1, last_used_at = ?
      WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

/**
 * Delete saved command by id.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteSavedCommand(id) {
  await run("DELETE FROM saved_commands WHERE id = ?", [id]);
}

/**
 * List categories by scope and optional server id.
 *
 * @param {"global"|"server"} scope
 * @param {string|null} [serverId]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listCategories(scope, serverId = null) {
  if (scope === "global") {
    return all("SELECT * FROM command_categories WHERE scope = 'global' ORDER BY sort_order ASC, name ASC");
  }
  return all(
    "SELECT * FROM command_categories WHERE scope = 'server' AND server_id = ? ORDER BY sort_order ASC, name ASC",
    [serverId]
  );
}

/**
 * Create command category.
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<void>}
 */
async function createCategory(payload) {
  await run(
    "INSERT INTO command_categories (id, server_id, name, scope, sort_order) VALUES (?, ?, ?, ?, ?)",
    [payload.id, payload.server_id || null, payload.name, payload.scope, Number(payload.sort_order || 0)]
  );
}

/**
 * Delete command category.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteCategory(id) {
  await run("DELETE FROM command_categories WHERE id = ?", [id]);
}

/**
 * Get single command by id.
 *
 * @param {string} id
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getSavedCommandById(id) {
  return get("SELECT * FROM saved_commands WHERE id = ?", [id]);
}

module.exports = {
  listSavedCommands,
  createSavedCommand,
  updateSavedCommand,
  markSavedCommandUsed,
  deleteSavedCommand,
  listCategories,
  createCategory,
  deleteCategory,
  getSavedCommandById,
};
