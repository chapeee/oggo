const { v4: uuidv4 } = require("uuid");
const { validationError, notFoundError } = require("../errors/app-error");
const repo = require("../db/repositories/savedCommandRepository");

/**
 * Normalize scope and server requirements.
 *
 * @param {string} scope
 * @param {string|null|undefined} serverId
 * @returns {{scope: "global"|"server", serverId: string|null}}
 */
function normalizeScope(scope, serverId) {
  const normalized = String(scope || "global").toLowerCase();
  if (normalized !== "global" && normalized !== "server") {
    throw validationError("scope must be global or server");
  }
  if (normalized === "server" && !String(serverId || "").trim()) {
    throw validationError("serverId is required for server scope");
  }
  return { scope: normalized, serverId: normalized === "server" ? String(serverId) : null };
}

/**
 * List saved commands and categories for a scope.
 *
 * @param {{scope: string, serverId?: string|null}} params
 * @returns {Promise<{commands: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>>}>}
 */
async function listAll(params) {
  const { scope, serverId } = normalizeScope(params.scope, params.serverId);
  const [commands, categories] = await Promise.all([
    repo.listSavedCommands(scope, serverId),
    repo.listCategories(scope, serverId),
  ]);
  return { commands, categories };
}

/**
 * Create saved command.
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{id: string}>}
 */
async function createSavedCommand(payload) {
  const name = String(payload?.name || "").trim();
  const command = String(payload?.command || "").trim();
  if (!name || !command) {
    throw validationError("name and command are required");
  }
  const { scope, serverId } = normalizeScope(String(payload?.scope || "global"), payload?.serverId || null);
  const id = uuidv4();
  await repo.createSavedCommand({
    id,
    server_id: serverId,
    name,
    command,
    category: payload?.category ? String(payload.category) : null,
    scope,
    sort_order: Number(payload?.sortOrder || 0),
    created_at: new Date().toISOString(),
    use_count: 0,
  });
  return { id };
}

/**
 * Update saved command metadata.
 *
 * @param {string} id
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{updated: boolean}>}
 */
async function updateSavedCommand(id, payload) {
  const existing = await repo.getSavedCommandById(id);
  if (!existing) throw notFoundError("Saved command not found");
  const next = {
    name: String(payload?.name || existing.name || "").trim(),
    command: String(payload?.command || existing.command || "").trim(),
    category: payload?.category !== undefined ? String(payload.category || "") : existing.category,
    sort_order:
      payload?.sortOrder !== undefined ? Number(payload.sortOrder || 0) : Number(existing.sort_order || 0),
  };
  if (!next.name || !next.command) throw validationError("name and command are required");
  await repo.updateSavedCommand(id, next);
  return { updated: true };
}

/**
 * Delete saved command by id.
 *
 * @param {string} id
 * @returns {Promise<{deleted: boolean}>}
 */
async function deleteSavedCommand(id) {
  await repo.deleteSavedCommand(id);
  return { deleted: true };
}

/**
 * Mark command as used.
 *
 * @param {string} id
 * @returns {Promise<{updated: boolean}>}
 */
async function markUsed(id) {
  await repo.markSavedCommandUsed(id);
  return { updated: true };
}

/**
 * Create a command category.
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{id: string}>}
 */
async function createCategory(payload) {
  const name = String(payload?.name || "").trim();
  if (!name) throw validationError("name is required");
  const { scope, serverId } = normalizeScope(String(payload?.scope || "global"), payload?.serverId || null);
  const id = uuidv4();
  await repo.createCategory({
    id,
    server_id: serverId,
    name,
    scope,
    sort_order: Number(payload?.sortOrder || 0),
  });
  return { id };
}

/**
 * Delete category by id.
 *
 * @param {string} id
 * @returns {Promise<{deleted: boolean}>}
 */
async function deleteCategory(id) {
  await repo.deleteCategory(id);
  return { deleted: true };
}

module.exports = {
  listAll,
  createSavedCommand,
  updateSavedCommand,
  deleteSavedCommand,
  markUsed,
  createCategory,
  deleteCategory,
};
