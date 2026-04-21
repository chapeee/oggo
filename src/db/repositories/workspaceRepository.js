const { randomUUID } = require("crypto");
const { all, get, run } = require("../database");

const SERVICE_TYPES = ["s3", "sns", "ses", "cloudwatch", "rds", "ec2", "lambda", "secrets"];

function normalizeServiceRow(row) {
  if (!row) return null;
  let parsedConfig = {};
  try {
    parsedConfig = row.config_json ? JSON.parse(row.config_json) : {};
  } catch (_error) {
    parsedConfig = {};
  }
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_type: row.service_type,
    friendly_name: row.friendly_name || "",
    region: row.region || "",
    resource_identifier: row.resource_identifier || "",
    config_json: parsedConfig,
    status: row.status || "untested",
    last_tested_at: row.last_tested_at || null,
    error_message: row.error_message || "",
    created_at: row.created_at || null,
  };
}

async function findAll() {
  return all("SELECT * FROM workspaces ORDER BY created_at DESC");
}

async function findById(id) {
  return get("SELECT * FROM workspaces WHERE id = ?", [id]);
}

async function create(data) {
  const now = new Date().toISOString();
  const workspace = {
    id: randomUUID(),
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    color: String(data.color || "#f97316"),
    default_region: String(data.defaultRegion || data.default_region || "us-east-1"),
    default_access_key_id: data.defaultAccessKeyId ? String(data.defaultAccessKeyId).trim() : "",
    default_secret_access_key: data.defaultSecretAccessKeyEncrypted || "",
    created_at: now,
    updated_at: now,
  };
  await run(
    `INSERT INTO workspaces (
      id, name, description, color, default_region,
      default_access_key_id, default_secret_access_key, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @color, @default_region,
      @default_access_key_id, @default_secret_access_key, @created_at, @updated_at
    )`,
    workspace
  );
  return workspace;
}

async function update(id, data) {
  const existing = await findById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    name: data.name !== undefined ? String(data.name || "").trim() : existing.name,
    description: data.description !== undefined ? String(data.description || "").trim() : existing.description,
    color: data.color !== undefined ? String(data.color || "#f97316") : existing.color,
    default_region:
      data.defaultRegion !== undefined || data.default_region !== undefined
        ? String(data.defaultRegion || data.default_region || "us-east-1")
        : existing.default_region,
    default_access_key_id:
      data.defaultAccessKeyId !== undefined
        ? String(data.defaultAccessKeyId || "").trim()
        : (existing.default_access_key_id || ""),
    default_secret_access_key:
      data.defaultSecretAccessKeyEncrypted !== undefined
        ? String(data.defaultSecretAccessKeyEncrypted || "")
        : (existing.default_secret_access_key || ""),
    updated_at: new Date().toISOString(),
  };
  await run(
    `UPDATE workspaces
     SET name=@name, description=@description, color=@color, default_region=@default_region,
         default_access_key_id=@default_access_key_id, default_secret_access_key=@default_secret_access_key,
         updated_at=@updated_at
     WHERE id=@id`,
    updated
  );
  return updated;
}

async function deleteById(id) {
  const existing = await findById(id);
  if (!existing) return false;
  await run("DELETE FROM workspace_services WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspaces WHERE id = ?", [id]);
  return true;
}

async function getServices(workspaceId, serviceType = null) {
  const params = [workspaceId];
  let sql = "SELECT * FROM workspace_services WHERE workspace_id = ?";
  if (serviceType) {
    sql += " AND service_type = ?";
    params.push(serviceType);
  }
  sql += " ORDER BY service_type ASC, created_at DESC";
  const rows = await all(sql, params);
  return rows.map(normalizeServiceRow);
}

async function getServiceById(workspaceId, serviceId) {
  const row = await get(
    "SELECT * FROM workspace_services WHERE workspace_id = ? AND id = ?",
    [workspaceId, serviceId]
  );
  return row || null;
}

async function addService(workspaceId, data) {
  const row = {
    id: randomUUID(),
    workspace_id: workspaceId,
    service_type: data.serviceType,
    friendly_name: String(data.friendlyName || "").trim(),
    access_key_id: String(data.accessKeyIdEncrypted || ""),
    secret_access_key: String(data.secretAccessKeyEncrypted || ""),
    region: String(data.region || "").trim(),
    resource_identifier: String(data.resourceIdentifier || "").trim(),
    config_json: JSON.stringify(data.configJson || {}),
    status: "untested",
    last_tested_at: null,
    error_message: "",
    created_at: new Date().toISOString(),
  };
  await run(
    `INSERT INTO workspace_services (
      id, workspace_id, service_type, friendly_name, access_key_id, secret_access_key,
      region, resource_identifier, config_json, status, last_tested_at, error_message, created_at
    ) VALUES (
      @id, @workspace_id, @service_type, @friendly_name, @access_key_id, @secret_access_key,
      @region, @resource_identifier, @config_json, @status, @last_tested_at, @error_message, @created_at
    )`,
    row
  );
  return normalizeServiceRow(row);
}

async function updateService(workspaceId, serviceId, data) {
  const existing = await getServiceById(workspaceId, serviceId);
  if (!existing) return null;
  const row = {
    ...existing,
    service_type: data.serviceType !== undefined ? String(data.serviceType).trim().toLowerCase() : existing.service_type,
    friendly_name: data.friendlyName !== undefined ? String(data.friendlyName || "").trim() : (existing.friendly_name || ""),
    access_key_id:
      data.accessKeyIdEncrypted !== undefined ? String(data.accessKeyIdEncrypted || "") : (existing.access_key_id || ""),
    secret_access_key:
      data.secretAccessKeyEncrypted !== undefined ? String(data.secretAccessKeyEncrypted || "") : (existing.secret_access_key || ""),
    region: data.region !== undefined ? String(data.region || "").trim() : (existing.region || ""),
    resource_identifier:
      data.resourceIdentifier !== undefined ? String(data.resourceIdentifier || "").trim() : (existing.resource_identifier || ""),
    config_json:
      data.configJson !== undefined
        ? JSON.stringify(data.configJson || {})
        : (existing.config_json || "{}"),
    status: data.status !== undefined ? String(data.status || "untested") : (existing.status || "untested"),
    last_tested_at:
      data.lastTestedAt !== undefined ? (data.lastTestedAt || null) : (existing.last_tested_at || null),
    error_message:
      data.errorMessage !== undefined ? String(data.errorMessage || "") : (existing.error_message || ""),
  };
  await run(
    `UPDATE workspace_services
     SET service_type=@service_type, friendly_name=@friendly_name, access_key_id=@access_key_id,
         secret_access_key=@secret_access_key, region=@region, resource_identifier=@resource_identifier,
         config_json=@config_json, status=@status, last_tested_at=@last_tested_at, error_message=@error_message
     WHERE id=@id AND workspace_id=@workspace_id`,
    row
  );
  return normalizeServiceRow(row);
}

async function removeService(workspaceId, serviceId) {
  await run("DELETE FROM workspace_services WHERE workspace_id = ? AND id = ?", [workspaceId, serviceId]);
}

async function updateServiceStatus(workspaceId, serviceId, status, errorMessage = "") {
  const now = new Date().toISOString();
  await run(
    `UPDATE workspace_services
     SET status = ?, error_message = ?, last_tested_at = ?
     WHERE workspace_id = ? AND id = ?`,
    [status, errorMessage || "", now, workspaceId, serviceId]
  );
}

async function getWorkspaceSummaries() {
  const rows = await all(
    `SELECT
      w.*,
      SUM(CASE WHEN ws.service_type='s3' THEN 1 ELSE 0 END) AS s3_count,
      SUM(CASE WHEN ws.service_type='sns' THEN 1 ELSE 0 END) AS sns_count,
      SUM(CASE WHEN ws.service_type='ses' THEN 1 ELSE 0 END) AS ses_count,
      SUM(CASE WHEN ws.service_type='cloudwatch' THEN 1 ELSE 0 END) AS cloudwatch_count,
      SUM(CASE WHEN ws.service_type='rds' THEN 1 ELSE 0 END) AS rds_count,
      SUM(CASE WHEN ws.service_type='ec2' THEN 1 ELSE 0 END) AS ec2_count,
      SUM(CASE WHEN ws.service_type='lambda' THEN 1 ELSE 0 END) AS lambda_count,
      SUM(CASE WHEN ws.service_type='secrets' THEN 1 ELSE 0 END) AS secrets_count,
      SUM(CASE WHEN ws.status='error' THEN 1 ELSE 0 END) AS error_count,
      SUM(CASE WHEN ws.status='ok' THEN 1 ELSE 0 END) AS ok_count,
      COUNT(ws.id) AS total_services
     FROM workspaces w
     LEFT JOIN workspace_services ws ON ws.workspace_id = w.id
     GROUP BY w.id
     ORDER BY w.created_at DESC`
  );

  return rows.map((row) => ({
    ...row,
    service_counts: {
      s3: Number(row.s3_count || 0),
      sns: Number(row.sns_count || 0),
      ses: Number(row.ses_count || 0),
      cloudwatch: Number(row.cloudwatch_count || 0),
      rds: Number(row.rds_count || 0),
      ec2: Number(row.ec2_count || 0),
      lambda: Number(row.lambda_count || 0),
      secrets: Number(row.secrets_count || 0),
    },
    health: {
      total: Number(row.total_services || 0),
      ok: Number(row.ok_count || 0),
      error: Number(row.error_count || 0),
    },
  }));
}

module.exports = {
  SERVICE_TYPES,
  normalizeServiceRow,
  findAll,
  findById,
  create,
  update,
  deleteById,
  getServices,
  getServiceById,
  addService,
  updateService,
  removeService,
  updateServiceStatus,
  getWorkspaceSummaries,
};
