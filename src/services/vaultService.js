/**
 * vaultService.js
 *
 * Handles vault business logic: validation, encryption, linking, rotation,
 * password generation, and expiring-secret checks.
 */
const crypto = require("crypto");
const { validationError, notFoundError, AppError } = require("../errors/app-error");
const { appLogger } = require("./logService");
const { encryptValue, decryptValue } = require("./encryptionService");
const vaultRepository = require("../db/repositories/vaultRepository");

const VALID_CATEGORIES = new Set(["ssh", "database", "aws", "redis", "api_key", "certificate", "other"]);
const VALID_SERVICE_TYPES = new Set(["ssh_server", "redis_connection", "rds", "custom"]);

/**
 * Remove encrypted values before returning payloads to frontend.
 *
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function sanitize(row) {
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
 * Parses a maybe-JSON string.
 *
 * @param {string} value
 * @returns {Record<string, any>}
 */
function safeJson(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

/**
 * Converts category fields into config + encrypted payload.
 *
 * @param {string} category
 * @param {Record<string, any>} data
 * @param {Record<string, any>|null} existing
 * @param {boolean} isCreate
 * @returns {{ config_json: Record<string, any>, encrypted_value: string, second_encrypted_value: string }}
 */
function buildCategoryPayload(category, data, existing, isCreate) {
  const prevConfig = safeJson(existing?.config_json);
  const out = {
    config_json: { ...prevConfig },
    encrypted_value: String(existing?.encrypted_value || ""),
    second_encrypted_value: String(existing?.second_encrypted_value || ""),
  };
  const setMain = (value) => {
    if (value !== undefined && String(value) !== "") out.encrypted_value = encryptValue(String(value));
  };
  const setSecond = (value) => {
    if (value !== undefined && String(value) !== "") out.second_encrypted_value = encryptValue(String(value));
  };
  const requireWhenCreate = (ok, label) => {
    if (!ok && isCreate) throw validationError(`${label} is required`);
  };
  if (category === "ssh") {
    out.config_json = {
      host: data.ssh_host || prevConfig.host || "",
      port: Number(data.ssh_port || prevConfig.port || 22),
      username: data.ssh_username || prevConfig.username || "",
      authType: data.ssh_auth_type || prevConfig.authType || "password",
    };
    requireWhenCreate(out.config_json.host, "ssh_host");
    requireWhenCreate(out.config_json.username, "ssh_username");
    if (out.config_json.authType === "password") {
      setMain(data.ssh_password);
      requireWhenCreate(data.ssh_password || out.encrypted_value, "ssh_password");
      if (data.ssh_passphrase !== undefined) out.second_encrypted_value = "";
    } else {
      setMain(data.ssh_private_key);
      setSecond(data.ssh_passphrase);
      requireWhenCreate(data.ssh_private_key || out.encrypted_value, "ssh_private_key");
    }
    return out;
  }
  if (category === "database") {
    out.config_json = {
      engine: data.db_engine || prevConfig.engine || "mysql",
      host: data.db_host || prevConfig.host || "",
      port: data.db_port ? Number(data.db_port) : Number(prevConfig.port || 0),
      databaseName: data.db_name || prevConfig.databaseName || "",
      username: data.db_username !== undefined ? data.db_username : (prevConfig.username || ""),
      ssl: String(data.db_ssl || prevConfig.ssl || "false") === "true",
      caCert: data.db_ca_cert !== undefined ? data.db_ca_cert : (prevConfig.caCert || ""),
    };
    requireWhenCreate(out.config_json.host, "db_host");
    requireWhenCreate(out.config_json.databaseName, "db_name");
    setMain(data.db_password);
    return out;
  }
  if (category === "aws") {
    const authType = data.aws_auth_type || prevConfig.authType || "access_key";
    let secretBag = {};
    try {
      secretBag = safeJson(decryptValue(out.encrypted_value || "{}"));
    } catch (_error) {
      secretBag = {};
    }
    out.config_json = {
      authType,
      accessKeyId: data.aws_access_key_id || prevConfig.accessKeyId || "",
      region: data.aws_region || prevConfig.region || "us-east-1",
      accountId: data.aws_account_id || prevConfig.accountId || "",
      roleArn: data.aws_role_arn || prevConfig.roleArn || "",
      externalId: data.aws_external_id || prevConfig.externalId || "",
    };
    const nextBag = {
      ...secretBag,
      secretAccessKey: data.aws_secret_access_key !== undefined ? data.aws_secret_access_key : secretBag.secretAccessKey,
      sessionToken: data.aws_session_token !== undefined ? data.aws_session_token : secretBag.sessionToken,
    };
    if (authType === "access_key" || authType === "temporary") {
      requireWhenCreate(out.config_json.accessKeyId, "aws_access_key_id");
      requireWhenCreate(nextBag.secretAccessKey, "aws_secret_access_key");
    }
    if (authType === "temporary") requireWhenCreate(nextBag.sessionToken, "aws_session_token");
    if (authType === "iam_role") requireWhenCreate(out.config_json.roleArn, "aws_role_arn");
    out.encrypted_value = encryptValue(JSON.stringify(nextBag));
    out.second_encrypted_value = "";
    return out;
  }
  if (category === "redis") {
    out.config_json = {
      host: data.redis_host || prevConfig.host || "",
      port: Number(data.redis_port || prevConfig.port || 6379),
      database: Number(data.redis_db || prevConfig.database || 0),
      username: data.redis_username !== undefined ? data.redis_username : (prevConfig.username || ""),
      tls: String(data.redis_tls || prevConfig.tls || "false") === "true",
      connectionType: data.redis_connection_type || prevConfig.connectionType || "standalone",
      sentinelHosts: data.redis_sentinel_hosts !== undefined ? data.redis_sentinel_hosts : (prevConfig.sentinelHosts || ""),
      masterName: data.redis_master_name !== undefined ? data.redis_master_name : (prevConfig.masterName || ""),
      clusterNodes: data.redis_cluster_nodes !== undefined ? data.redis_cluster_nodes : (prevConfig.clusterNodes || ""),
    };
    requireWhenCreate(out.config_json.host, "redis_host");
    if (out.config_json.connectionType === "sentinel") {
      requireWhenCreate(out.config_json.sentinelHosts, "redis_sentinel_hosts");
      requireWhenCreate(out.config_json.masterName, "redis_master_name");
    }
    if (out.config_json.connectionType === "cluster") requireWhenCreate(out.config_json.clusterNodes, "redis_cluster_nodes");
    setMain(data.redis_password);
    out.second_encrypted_value = "";
    return out;
  }
  if (category === "api_key") {
    const apiType = data.api_type || prevConfig.apiType || "bearer";
    out.config_json = {
      apiType,
      baseUrl: data.api_base_url !== undefined ? data.api_base_url : (prevConfig.baseUrl || ""),
      headerName: data.api_header_name !== undefined ? data.api_header_name : (prevConfig.headerName || ""),
      tokenUrl: data.api_token_url !== undefined ? data.api_token_url : (prevConfig.tokenUrl || ""),
      scopes: data.api_scopes !== undefined ? data.api_scopes : (prevConfig.scopes || ""),
      clientId: data.api_client_id !== undefined ? data.api_client_id : (prevConfig.clientId || ""),
      username: data.api_username !== undefined ? data.api_username : (prevConfig.username || ""),
      apiKey: data.api_key !== undefined ? data.api_key : (prevConfig.apiKey || ""),
    };
    let secret = null;
    if (apiType === "bearer") secret = data.api_token;
    if (apiType === "basic") secret = data.api_password;
    if (apiType === "key_secret") secret = data.api_secret;
    if (apiType === "oauth2") secret = data.api_client_secret;
    if (apiType === "custom_header") secret = data.api_header_value;
    if (secret !== null && secret !== undefined && String(secret) !== "") out.encrypted_value = encryptValue(String(secret));
    if (isCreate && !out.encrypted_value) throw validationError("Secret value is required for selected API type");
    out.second_encrypted_value = "";
    return out;
  }
  if (category === "certificate") {
    out.config_json = {
      certType: data.cert_type || prevConfig.certType || "tls_ssl",
      domain: data.cert_domain !== undefined ? data.cert_domain : (prevConfig.domain || ""),
      expiry: data.expiry_date || data.cert_expiry || prevConfig.expiry || "",
      issuer: data.cert_issuer !== undefined ? data.cert_issuer : (prevConfig.issuer || ""),
      cert: data.cert_content !== undefined ? data.cert_content : (prevConfig.cert || ""),
    };
    requireWhenCreate(out.config_json.cert, "cert_content");
    setMain(data.cert_private_key);
    setSecond(data.cert_passphrase);
    return out;
  }
  out.config_json = { keyLabel: data.other_key_label || prevConfig.keyLabel || "" };
  requireWhenCreate(out.config_json.keyLabel, "other_key_label");
  setMain(data.other_value);
  requireWhenCreate(data.other_value || out.encrypted_value, "other_value");
  out.second_encrypted_value = "";
  return out;
}

/**
 * List all vault entries without secret values.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function listEntries() {
  return vaultRepository.findAll();
}

/**
 * Get one vault entry by id (without secret value).
 *
 * @param {string} id
 * @returns {Promise<Record<string, any>>}
 */
async function getEntry(id) {
  const row = await vaultRepository.findById(id);
  if (!row) throw notFoundError("Vault entry not found");
  return sanitize(row);
}

/**
 * Create a new vault entry from plaintext value.
 *
 * @param {Record<string, any>} data
 * @returns {Promise<Record<string, any>>}
 */
async function createEntry(data) {
  const name = String(data?.name || "").trim();
  const category = String(data?.category || "").trim().toLowerCase();
  if (!name) throw validationError("name is required");
  if (!VALID_CATEGORIES.has(category)) throw validationError("category is invalid");
  const mapped = buildCategoryPayload(category, data, null, true);
  return vaultRepository.create({
    ...data,
    name,
    category,
    username: mapped.config_json.username || data.username || "",
    expiry_date: mapped.config_json.expiry || data.expiry_date || null,
    config_json: mapped.config_json,
    encrypted_value: mapped.encrypted_value,
    second_encrypted_value: mapped.second_encrypted_value,
  });
}

/**
 * Update one vault entry. Keeps existing encrypted value if value is not provided.
 *
 * @param {string} id
 * @param {Record<string, any>} data
 * @returns {Promise<Record<string, any>>}
 */
async function updateEntry(id, data) {
  const existing = await vaultRepository.findById(id);
  if (!existing) throw notFoundError("Vault entry not found");
  const category = String(data?.category || existing.category || "").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) {
    throw validationError("category is invalid");
  }
  const mapped = buildCategoryPayload(category, data, existing, false);
  const updated = await vaultRepository.update(id, {
    ...data,
    category,
    username: mapped.config_json.username || data.username || existing.username || "",
    expiry_date: mapped.config_json.expiry || data.expiry_date || existing.expiry_date || null,
    config_json: mapped.config_json,
    encrypted_value: mapped.encrypted_value,
    second_encrypted_value: mapped.second_encrypted_value,
  });
  if (!updated) throw notFoundError("Vault entry not found");
  return updated;
}

/**
 * Delete one vault entry. Requires unlink unless force=true.
 *
 * @param {string} id
 * @param {boolean} [force]
 * @returns {Promise<void>}
 */
async function deleteEntry(id, force = false) {
  const entry = await vaultRepository.findById(id);
  if (!entry) throw notFoundError("Vault entry not found");
  const links = await vaultRepository.getLinkedServices(id);
  if (links.length && !force) {
    const usedBy = links.map((link) => `${link.service_type}:${link.service_name}`).join(", ");
    throw new AppError(`Vault entry is linked to services: ${usedBy}`, 409, "VAULT_IN_USE", { links });
  }
  await vaultRepository.deleteById(id);
}

/**
 * Get decrypted secret value and mark access timestamp.
 *
 * @param {string} id
 * @returns {Promise<string>}
 */
async function getDecryptedValue(id) {
  const row = await vaultRepository.findById(id);
  if (!row) throw notFoundError("Vault entry not found");
  let value = decryptValue(row.encrypted_value || "");
  if (row.category === "aws") {
    const bag = safeJson(value);
    value = bag.secretAccessKey || bag.sessionToken || "";
  }
  await vaultRepository.update(id, { last_accessed_at: new Date().toISOString() });
  return value;
}

/**
 * Rotate one vault password value.
 *
 * @param {string} id
 * @param {string} newValue
 * @returns {Promise<Record<string, any>>}
 */
async function rotatePassword(id, newValue) {
  if (!String(newValue || "")) throw validationError("newValue is required");
  const entry = await vaultRepository.findById(id);
  if (!entry) throw notFoundError("Vault entry not found");
  const updated = await vaultRepository.update(id, {
    encrypted_value: encryptValue(newValue),
    rotation_count: Number(entry.rotation_count || 0) + 1,
    last_rotated_at: new Date().toISOString(),
    is_shared: 1,
  });
  return updated;
}

/**
 * Link a service field to a vault entry.
 *
 * @param {string} vaultEntryId
 * @param {string} serviceType
 * @param {string} serviceId
 * @param {string} fieldName
 * @returns {Promise<Record<string, any>>}
 */
async function linkService(vaultEntryId, serviceType, serviceId, fieldName) {
  const entry = await vaultRepository.findById(vaultEntryId);
  if (!entry) throw notFoundError("Vault entry not found");
  if (!VALID_SERVICE_TYPES.has(String(serviceType || ""))) throw validationError("Invalid serviceType");
  if (!String(serviceId || "").trim()) throw validationError("serviceId is required");
  if (!String(fieldName || "").trim()) throw validationError("fieldName is required");
  const existing = await vaultRepository.getLinkedServices(vaultEntryId);
  const duplicate = existing.find(
    (link) => link.service_type === serviceType && link.service_id === serviceId && link.field_name === fieldName
  );
  if (duplicate) return duplicate;
  return vaultRepository.addServiceLink(vaultEntryId, serviceType, serviceId, fieldName);
}

/**
 * Remove one service link.
 *
 * @param {string} linkId
 * @returns {Promise<void>}
 */
async function unlinkService(linkId) {
  await vaultRepository.removeServiceLink(linkId);
}

/**
 * Get linked services for a vault entry.
 *
 * @param {string} vaultEntryId
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function getLinkedServices(vaultEntryId) {
  return vaultRepository.getLinkedServices(vaultEntryId);
}

/**
 * Trigger expiring-secret checks and notifications.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function checkExpiring() {
  const rows = await vaultRepository.getExpiringEntries(30);
  const now = Date.now();
  const windows = [30, 14, 7, 1];
  for (const row of rows) {
    if (!row.expiry_date) continue;
    const expiryMs = new Date(row.expiry_date).getTime();
    if (!Number.isFinite(expiryMs)) continue;
    const days = Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000));
    if (!windows.includes(days)) continue;
    const lastNotified = row.last_notified_at ? new Date(row.last_notified_at).getTime() : 0;
    if (lastNotified && now - lastNotified < 20 * 60 * 60 * 1000) continue;
    appLogger.warn(`Vault expiry notice: ${row.name} expires in ${days} day(s)`);
    await vaultRepository.update(row.id, { last_notified_at: new Date().toISOString() });
  }
  return rows.map(sanitize);
}

/**
 * Generate a strong random password.
 *
 * @param {number} [length]
 * @param {{uppercase?: boolean, numbers?: boolean, symbols?: boolean}} [options]
 * @returns {string}
 */
function generatePassword(length = 24, options = {}) {
  const size = Math.max(8, Math.min(128, Number(length || 24)));
  let alphabet = "abcdefghijklmnopqrstuvwxyz";
  if (options.uppercase !== false) alphabet += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (options.numbers !== false) alphabet += "0123456789";
  if (options.symbols !== false) alphabet += "!@#$%^&*()-_=+[]{}<>?";
  const bytes = crypto.randomBytes(size * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < size; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

module.exports = {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  getDecryptedValue,
  rotatePassword,
  linkService,
  unlinkService,
  getLinkedServices,
  checkExpiring,
  generatePassword,
};
