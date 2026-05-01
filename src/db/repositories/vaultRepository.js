/**
 * vaultRepository.js
 *
 * Handles all SQL access for vault entries and vault service links.
 */
const { randomUUID } = require("crypto");
const { all, get, run, exec, getDb, getDbEngine } = require("../database");

/**
 * Remove encrypted value from payload before returning to clients.
 *
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function withoutEncryptedValue(row) {
  if (!row) return null;
  const copy = { ...row };
  delete copy.encrypted_value;
  delete copy.second_encrypted_value;
  if (copy.config_json && typeof copy.config_json === "string") {
    try {
      copy.config_json = JSON.parse(copy.config_json);
    } catch (_error) {
      copy.config_json = {};
    }
  } else if (!copy.config_json) {
    copy.config_json = {};
  }
  return copy;
}

/**
 * List all vault entries sorted by name.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function findAll() {
  const rows = await all("SELECT * FROM vault_entries ORDER BY name ASC");
  return rows.map(withoutEncryptedValue);
}

/**
 * Get one vault entry by id including encrypted value.
 *
 * @param {string} id
 * @returns {Promise<Record<string, any>|null>}
 */
async function findById(id) {
  return get("SELECT * FROM vault_entries WHERE id = ?", [id]);
}

/**
 * Insert a new vault entry.
 *
 * @param {Record<string, any>} data
 * @returns {Promise<Record<string, any>>}
 */
async function create(data) {
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    name: String(data.name || "").trim(),
    category: String(data.category || "other").trim(),
    username: data.username || "",
    encrypted_value: data.encrypted_value || "",
    second_encrypted_value: data.second_encrypted_value || "",
    config_json: typeof data.config_json === "string" ? data.config_json : JSON.stringify(data.config_json || {}),
    notes: data.notes || "",
    tags: data.tags || "",
    is_shared: data.is_shared ? 1 : 0,
    expiry_date: data.expiry_date || null,
    rotation_count: Number(data.rotation_count || 0),
    last_rotated_at: data.last_rotated_at || null,
    last_accessed_at: data.last_accessed_at || null,
    last_notified_at: data.last_notified_at || null,
    created_at: now,
    updated_at: now,
  };
  await run(
    `INSERT INTO vault_entries (
      id,name,category,username,encrypted_value,second_encrypted_value,config_json,notes,tags,is_shared,expiry_date,rotation_count,
      last_rotated_at,last_accessed_at,last_notified_at,created_at,updated_at
    ) VALUES (
      @id,@name,@category,@username,@encrypted_value,@second_encrypted_value,@config_json,@notes,@tags,@is_shared,@expiry_date,@rotation_count,
      @last_rotated_at,@last_accessed_at,@last_notified_at,@created_at,@updated_at
    )`,
    row
  );
  return withoutEncryptedValue(row);
}

/**
 * Update one vault entry and return sanitized row.
 *
 * @param {string} id
 * @param {Record<string, any>} data
 * @returns {Promise<Record<string, any>|null>}
 */
async function update(id, data) {
  const current = await findById(id);
  if (!current) return null;
  const next = {
    ...current,
    name: data.name !== undefined ? String(data.name || "").trim() : current.name,
    category: data.category !== undefined ? String(data.category || "").trim() : current.category,
    username: data.username !== undefined ? data.username : current.username,
    encrypted_value: data.encrypted_value !== undefined ? data.encrypted_value : current.encrypted_value,
    second_encrypted_value:
      data.second_encrypted_value !== undefined ? data.second_encrypted_value : current.second_encrypted_value,
    config_json:
      data.config_json !== undefined
        ? (typeof data.config_json === "string" ? data.config_json : JSON.stringify(data.config_json || {}))
        : current.config_json,
    notes: data.notes !== undefined ? data.notes : current.notes,
    tags: data.tags !== undefined ? data.tags : current.tags,
    is_shared: data.is_shared !== undefined ? (data.is_shared ? 1 : 0) : Number(current.is_shared || 0),
    expiry_date: data.expiry_date !== undefined ? data.expiry_date : current.expiry_date,
    rotation_count: data.rotation_count !== undefined ? Number(data.rotation_count || 0) : Number(current.rotation_count || 0),
    last_rotated_at: data.last_rotated_at !== undefined ? data.last_rotated_at : current.last_rotated_at,
    last_accessed_at: data.last_accessed_at !== undefined ? data.last_accessed_at : current.last_accessed_at,
    last_notified_at: data.last_notified_at !== undefined ? data.last_notified_at : current.last_notified_at,
    updated_at: new Date().toISOString(),
  };
  await run(
    `UPDATE vault_entries SET
      name=@name,category=@category,username=@username,encrypted_value=@encrypted_value,second_encrypted_value=@second_encrypted_value,
      config_json=@config_json,notes=@notes,tags=@tags,
      is_shared=@is_shared,expiry_date=@expiry_date,rotation_count=@rotation_count,last_rotated_at=@last_rotated_at,
      last_accessed_at=@last_accessed_at,last_notified_at=@last_notified_at,updated_at=@updated_at
     WHERE id=@id`,
    { ...next, id }
  );
  return withoutEncryptedValue(next);
}

/**
 * Delete one vault entry and all links in a transaction.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteById(id) {
  const engine = getDbEngine();
  if (engine === "mysql") {
    await exec("START TRANSACTION");
    try {
      await run("DELETE FROM vault_service_links WHERE vault_entry_id = ?", [id]);
      await run("DELETE FROM vault_entries WHERE id = ?", [id]);
      await exec("COMMIT");
    } catch (error) {
      await exec("ROLLBACK");
      throw error;
    }
    return;
  }
  const db = getDb();
  db.exec("BEGIN");
  try {
    await run("DELETE FROM vault_service_links WHERE vault_entry_id = ?", [id]);
    await run("DELETE FROM vault_entries WHERE id = ?", [id]);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * List linked services for one vault entry.
 *
 * @param {string} vaultEntryId
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function getLinkedServices(vaultEntryId) {
  return all(
    `SELECT
      vsl.*,
      COALESCE(s.name, ws.friendly_name, vsl.service_id) AS service_name
     FROM vault_service_links vsl
     LEFT JOIN servers s
       ON vsl.service_type = 'ssh_server' AND s.id = vsl.service_id
     LEFT JOIN workspace_services ws
       ON vsl.service_type = 'rds' AND ws.id = vsl.service_id
     WHERE vsl.vault_entry_id = ?
     ORDER BY vsl.created_at DESC`,
    [vaultEntryId]
  );
}

/**
 * Add a service link to one vault entry.
 *
 * @param {string} vaultEntryId
 * @param {string} serviceType
 * @param {string} serviceId
 * @param {string} fieldName
 * @returns {Promise<Record<string, any>>}
 */
async function addServiceLink(vaultEntryId, serviceType, serviceId, fieldName) {
  const row = {
    id: randomUUID(),
    vault_entry_id: vaultEntryId,
    service_type: serviceType,
    service_id: serviceId,
    field_name: fieldName,
    created_at: new Date().toISOString(),
  };
  await run(
    "INSERT INTO vault_service_links (id,vault_entry_id,service_type,service_id,field_name,created_at) VALUES (@id,@vault_entry_id,@service_type,@service_id,@field_name,@created_at)",
    row
  );
  return row;
}

/**
 * Remove one link by id.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function removeServiceLink(id) {
  await run("DELETE FROM vault_service_links WHERE id = ?", [id]);
}

/**
 * Remove all links by vault entry id.
 *
 * @param {string} vaultEntryId
 * @returns {Promise<void>}
 */
async function removeAllServiceLinks(vaultEntryId) {
  await run("DELETE FROM vault_service_links WHERE vault_entry_id = ?", [vaultEntryId]);
}

/**
 * List vault entries by category without encrypted values.
 *
 * @param {string} category
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function getEntriesByCategory(category) {
  const rows = await all("SELECT * FROM vault_entries WHERE category = ? ORDER BY name ASC", [category]);
  return rows.map(withoutEncryptedValue);
}

/**
 * List entries expiring within N days.
 *
 * @param {number} daysAhead
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function getExpiringEntries(daysAhead) {
  const cutoff = new Date(Date.now() + (Number(daysAhead || 0) * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  return all("SELECT * FROM vault_entries WHERE expiry_date IS NOT NULL AND substr(expiry_date,1,10) <= ? ORDER BY expiry_date ASC", [cutoff]);
}

/**
 * List shared entries (explicitly shared or rotated).
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function getSharedEntries() {
  const rows = await all("SELECT * FROM vault_entries WHERE is_shared = 1 OR rotation_count > 0 ORDER BY name ASC");
  return rows.map(withoutEncryptedValue);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  deleteById,
  getLinkedServices,
  addServiceLink,
  removeServiceLink,
  removeAllServiceLinks,
  getEntriesByCategory,
  getExpiringEntries,
  getSharedEntries,
};
