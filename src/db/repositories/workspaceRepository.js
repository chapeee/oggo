/**
 * workspaceRepository.js
 *
 * Database operations for AWS Workspaces feature.
 * Workspaces group multiple AWS services (S3, RDS, EC2, etc.)
 * under one named container for easier management.
 *
 * Tables: workspaces, workspace_aws_connections,
 *         workspace_s3_configs, workspace_services
 */

const { randomUUID } = require("crypto");
const { all, get, run, getDbEngine, getDb } = require("../database");

/**
 * Run a set of operations in a transaction.
 *
 * @param {(ctx?: import("mysql2/promise").PoolConnection) => Promise<unknown>} callback
 * @returns {Promise<unknown>}
 */
async function inTransaction(callback) {
  if (getDbEngine() === "mysql") {
    const connection = await getDb().getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  await run("BEGIN TRANSACTION");
  try {
    const result = await callback();
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

/**
 * Get all workspaces ordered by created date.
 *
 * @returns {Promise<Array<Object>>}
 */
async function findAll() {
  return all("SELECT * FROM workspaces ORDER BY created_at DESC");
}

/**
 * Get workspace by id.
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  return get("SELECT * FROM workspaces WHERE id = ?", [id]);
}

/**
 * Create workspace row.
 *
 * @param {{name: string, description?: string, color?: string, defaultRegion?: string, default_region?: string}} data
 * @returns {Promise<Object>}
 */
async function create(data) {
  const now = new Date().toISOString();
  const workspace = {
    id: randomUUID(),
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    color: String(data.color || "#f97316"),
    default_region: String(data.defaultRegion || data.default_region || "us-east-1"),
    created_at: now,
    updated_at: now,
  };
  await run(
    `INSERT INTO workspaces (id, name, description, color, default_region, created_at, updated_at)
     VALUES (@id, @name, @description, @color, @default_region, @created_at, @updated_at)`,
    workspace
  );
  return workspace;
}

/**
 * Update workspace row.
 *
 * @param {string} id
 * @param {{name?: string, description?: string, color?: string, defaultRegion?: string, default_region?: string}} data
 * @returns {Promise<Object|null>}
 */
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
    updated_at: new Date().toISOString(),
  };
  await run(
    `UPDATE workspaces
     SET name=@name, description=@description, color=@color, default_region=@default_region, updated_at=@updated_at
     WHERE id=@id`,
    updated
  );
  return updated;
}

/**
 * Delete workspace and all links atomically.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteById(id) {
  const existing = await findById(id);
  if (!existing) return false;
  await inTransaction(async (connection) => {
    const exec = async (sql, params) => {
      if (!connection) return run(sql, params);
      await connection.execute(sql, params || []);
      return null;
    };
    await exec("DELETE FROM workspace_aws_connections WHERE workspace_id = ?", [id]);
    await exec("DELETE FROM workspace_s3_configs WHERE workspace_id = ?", [id]);
    await exec("DELETE FROM workspace_services WHERE workspace_id = ?", [id]);
    await exec("DELETE FROM workspaces WHERE id = ?", [id]);
  });
  return true;
}

/**
 * Get AWS connections attached to a workspace.
 *
 * @param {string} workspaceId
 * @returns {Promise<Array<Object>>}
 */
async function getAwsConnections(workspaceId) {
  return all(
    `SELECT wac.workspace_id, wac.aws_connection_id, wac.is_primary,
            ac.name, ac.account_id, ac.default_region, ac.color
     FROM workspace_aws_connections wac
     JOIN aws_connections ac ON ac.id = wac.aws_connection_id
     WHERE wac.workspace_id = ?
     ORDER BY wac.is_primary DESC, ac.name ASC`,
    [workspaceId]
  );
}

/**
 * Add AWS connection link for workspace.
 *
 * @param {string} workspaceId
 * @param {string} awsConnectionId
 * @param {boolean} isPrimary
 * @returns {Promise<void>}
 */
async function addAwsConnection(workspaceId, awsConnectionId, isPrimary = false) {
  const isMysql = getDbEngine() === "mysql";
  await inTransaction(async (connection) => {
    const exec = async (sql, params) => {
      if (!connection) return run(sql, params);
      await connection.execute(sql, params || []);
      return null;
    };
    if (isPrimary) {
      await exec("UPDATE workspace_aws_connections SET is_primary = 0 WHERE workspace_id = ?", [workspaceId]);
    }
    if (isMysql) {
      await exec(
        `INSERT INTO workspace_aws_connections (workspace_id, aws_connection_id, is_primary)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)`,
        [workspaceId, awsConnectionId, isPrimary ? 1 : 0]
      );
      return;
    }
    await exec(
      `INSERT INTO workspace_aws_connections (workspace_id, aws_connection_id, is_primary)
       VALUES (?, ?, ?)
       ON CONFLICT(workspace_id, aws_connection_id) DO UPDATE SET is_primary=excluded.is_primary`,
      [workspaceId, awsConnectionId, isPrimary ? 1 : 0]
    );
  });
}

/**
 * Remove AWS connection link.
 *
 * @param {string} workspaceId
 * @param {string} awsConnectionId
 * @returns {Promise<void>}
 */
async function removeAwsConnection(workspaceId, awsConnectionId) {
  await run(
    "DELETE FROM workspace_aws_connections WHERE workspace_id = ? AND aws_connection_id = ?",
    [workspaceId, awsConnectionId]
  );
}

/**
 * Get S3 configs attached to workspace.
 *
 * @param {string} workspaceId
 * @returns {Promise<Array<Object>>}
 */
async function getS3Configs(workspaceId) {
  return all(
    `SELECT wsc.id, wsc.workspace_id, wsc.s3_config_id, wsc.label,
            sc.name, sc.bucket_name, sc.region, sc.color
     FROM workspace_s3_configs wsc
     JOIN s3_connections sc ON sc.id = wsc.s3_config_id
     WHERE wsc.workspace_id = ?
     ORDER BY sc.name ASC`,
    [workspaceId]
  );
}

/**
 * Add S3 config link.
 *
 * @param {string} workspaceId
 * @param {string} s3ConfigId
 * @param {string} label
 * @returns {Promise<Object>}
 */
async function addS3Config(workspaceId, s3ConfigId, label = "") {
  const row = {
    id: randomUUID(),
    workspace_id: workspaceId,
    s3_config_id: s3ConfigId,
    label: String(label || "").trim() || null,
  };
  await run(
    `INSERT INTO workspace_s3_configs (id, workspace_id, s3_config_id, label)
     VALUES (@id, @workspace_id, @s3_config_id, @label)`,
    row
  );
  return row;
}

/**
 * Remove S3 config link.
 *
 * @param {string} workspaceId
 * @param {string} s3ConfigId
 * @returns {Promise<void>}
 */
async function removeS3Config(workspaceId, s3ConfigId) {
  await run(
    "DELETE FROM workspace_s3_configs WHERE workspace_id = ? AND s3_config_id = ?",
    [workspaceId, s3ConfigId]
  );
}

/**
 * Get workspace service attachments.
 *
 * @param {string} workspaceId
 * @param {string|null} serviceType
 * @returns {Promise<Array<Object>>}
 */
async function getServices(workspaceId, serviceType = null) {
  if (serviceType) {
    return all(
      `SELECT * FROM workspace_services
       WHERE workspace_id = ? AND service_type = ?
       ORDER BY created_at DESC`,
      [workspaceId, serviceType]
    );
  }
  return all(
    `SELECT * FROM workspace_services
     WHERE workspace_id = ?
     ORDER BY service_type ASC, created_at DESC`,
    [workspaceId]
  );
}

/**
 * Add a service attachment.
 *
 * @param {string} workspaceId
 * @param {{awsConnectionId: string, serviceType: string, serviceIdentifier: string, friendlyName?: string, region?: string, metadata?: object|string}} data
 * @returns {Promise<Object>}
 */
async function addService(workspaceId, data) {
  const row = {
    id: randomUUID(),
    workspace_id: workspaceId,
    aws_connection_id: data.awsConnectionId,
    service_type: data.serviceType,
    service_identifier: data.serviceIdentifier,
    friendly_name: data.friendlyName ? String(data.friendlyName) : null,
    region: data.region ? String(data.region) : null,
    metadata:
      data.metadata === undefined || data.metadata === null
        ? null
        : typeof data.metadata === "string"
          ? data.metadata
          : JSON.stringify(data.metadata),
    created_at: new Date().toISOString(),
  };
  await run(
    `INSERT INTO workspace_services (
      id, workspace_id, aws_connection_id, service_type,
      service_identifier, friendly_name, region, metadata, created_at
    ) VALUES (
      @id, @workspace_id, @aws_connection_id, @service_type,
      @service_identifier, @friendly_name, @region, @metadata, @created_at
    )`,
    row
  );
  return row;
}

/**
 * Remove a service attachment.
 *
 * @param {string} workspaceId
 * @param {string} serviceId
 * @returns {Promise<void>}
 */
async function removeService(workspaceId, serviceId) {
  await run("DELETE FROM workspace_services WHERE workspace_id = ? AND id = ?", [
    workspaceId,
    serviceId,
  ]);
}

/**
 * Get workspace summaries with counts for cards.
 *
 * @returns {Promise<Array<Object>>}
 */
async function getWorkspaceSummaries() {
  const rows = await all(
    `SELECT
      w.*,
      COALESCE(s3_counts.total_s3, 0) AS total_s3,
      COALESCE(svc.sns_count, 0) AS sns_count,
      COALESCE(svc.ses_count, 0) AS ses_count,
      COALESCE(svc.cloudwatch_count, 0) AS cloudwatch_count,
      COALESCE(svc.rds_count, 0) AS rds_count,
      COALESCE(svc.ec2_count, 0) AS ec2_count,
      COALESCE(svc.lambda_count, 0) AS lambda_count,
      COALESCE(svc.secrets_count, 0) AS secrets_count
     FROM workspaces w
     LEFT JOIN (
       SELECT workspace_id, COUNT(*) AS total_s3
       FROM workspace_s3_configs
       GROUP BY workspace_id
     ) s3_counts ON s3_counts.workspace_id = w.id
     LEFT JOIN (
       SELECT
         workspace_id,
         SUM(CASE WHEN service_type = 'sns' THEN 1 ELSE 0 END) AS sns_count,
         SUM(CASE WHEN service_type = 'ses' THEN 1 ELSE 0 END) AS ses_count,
         SUM(CASE WHEN service_type = 'cloudwatch' THEN 1 ELSE 0 END) AS cloudwatch_count,
         SUM(CASE WHEN service_type = 'rds' THEN 1 ELSE 0 END) AS rds_count,
         SUM(CASE WHEN service_type = 'ec2' THEN 1 ELSE 0 END) AS ec2_count,
         SUM(CASE WHEN service_type = 'lambda' THEN 1 ELSE 0 END) AS lambda_count,
         SUM(CASE WHEN service_type = 'secrets' THEN 1 ELSE 0 END) AS secrets_count
       FROM workspace_services
       GROUP BY workspace_id
     ) svc ON svc.workspace_id = w.id
     ORDER BY w.created_at DESC`
  );

  return rows.map((row) => ({
    ...row,
    service_counts: {
      s3: Number(row.total_s3 || 0),
      sns: Number(row.sns_count || 0),
      ses: Number(row.ses_count || 0),
      cloudwatch: Number(row.cloudwatch_count || 0),
      rds: Number(row.rds_count || 0),
      ec2: Number(row.ec2_count || 0),
      lambda: Number(row.lambda_count || 0),
      secrets: Number(row.secrets_count || 0),
    },
  }));
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  deleteById,
  getAwsConnections,
  addAwsConnection,
  removeAwsConnection,
  getS3Configs,
  addS3Config,
  removeS3Config,
  getServices,
  addService,
  removeService,
  getWorkspaceSummaries,
};
