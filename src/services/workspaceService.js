const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../db/database");

const WORKSPACE_SERVICE_TABLES = {
  s3: "workspace_s3_configs",
  sns: "workspace_sns_topics",
  ses: "workspace_ses_identities",
  cloudwatch: "workspace_cloudwatch_groups",
  rds: "workspace_rds_instances",
  ec2: "workspace_ec2_instances",
  lambda: "workspace_lambda_functions",
  secrets: "workspace_secrets",
};

async function listWorkspaces() {
  const workspaces = await all("SELECT * FROM workspaces ORDER BY created_at DESC");
  const serviceCounts = await all(
    `SELECT workspace_id, 's3' AS service_type, COUNT(*) AS total FROM workspace_s3_configs GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'sns' AS service_type, COUNT(*) AS total FROM workspace_sns_topics GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'ses' AS service_type, COUNT(*) AS total FROM workspace_ses_identities GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'cloudwatch' AS service_type, COUNT(*) AS total FROM workspace_cloudwatch_groups GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'rds' AS service_type, COUNT(*) AS total FROM workspace_rds_instances GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'ec2' AS service_type, COUNT(*) AS total FROM workspace_ec2_instances GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'lambda' AS service_type, COUNT(*) AS total FROM workspace_lambda_functions GROUP BY workspace_id
     UNION ALL
     SELECT workspace_id, 'secrets' AS service_type, COUNT(*) AS total FROM workspace_secrets GROUP BY workspace_id`
  );

  const primaryConnections = await all(
    `SELECT wac.workspace_id, a.id AS aws_connection_id, a.name, a.account_id, a.default_region
     FROM workspace_aws_connections wac
     JOIN aws_connections a ON a.id = wac.aws_connection_id
     WHERE wac.is_primary = 1`
  );

  return workspaces.map((workspace) => {
    const counts = serviceCounts
      .filter((row) => row.workspace_id === workspace.id)
      .reduce((acc, row) => ({ ...acc, [row.service_type]: Number(row.total || 0) }), {});
    const primary = primaryConnections.find((row) => row.workspace_id === workspace.id);
    return {
      ...workspace,
      service_counts: counts,
      primary_connection: primary
        ? {
            id: primary.aws_connection_id,
            name: primary.name,
            account_id: primary.account_id || "",
            default_region: primary.default_region || workspace.default_region,
          }
        : null,
      total_services: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
    };
  });
}

async function getWorkspaceById(id) {
  return get("SELECT * FROM workspaces WHERE id = ?", [id]);
}

async function getWorkspaceConnections(workspaceId) {
  return all(
    `SELECT wac.workspace_id, wac.aws_connection_id, wac.is_primary, a.name, a.account_id, a.default_region
     FROM workspace_aws_connections wac
     JOIN aws_connections a ON a.id = wac.aws_connection_id
     WHERE wac.workspace_id = ?
     ORDER BY wac.is_primary DESC, a.name ASC`,
    [workspaceId]
  );
}

async function saveWorkspace(payload, existing = null) {
  const now = new Date().toISOString();
  const workspace = {
    id: existing?.id || uuidv4(),
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    color: payload.color || "#f97316",
    default_region: payload.default_region || "us-east-1",
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  if (!workspace.name) {
    throw new Error("Workspace name is required");
  }

  if (existing) {
    await run(
      `UPDATE workspaces
       SET name=@name, description=@description, color=@color, default_region=@default_region, updated_at=@updated_at
       WHERE id=@id`,
      workspace
    );
  } else {
    await run(
      `INSERT INTO workspaces (id, name, description, color, default_region, created_at, updated_at)
       VALUES (@id, @name, @description, @color, @default_region, @created_at, @updated_at)`,
      workspace
    );
  }

  if (Array.isArray(payload.aws_connection_ids)) {
    await run("DELETE FROM workspace_aws_connections WHERE workspace_id = ?", [workspace.id]);
    const primaryId = payload.primary_aws_connection_id || payload.aws_connection_ids[0] || null;
    for (const connectionId of payload.aws_connection_ids) {
      await run(
        `INSERT INTO workspace_aws_connections (workspace_id, aws_connection_id, is_primary)
         VALUES (?, ?, ?)`,
        [workspace.id, connectionId, connectionId === primaryId ? 1 : 0]
      );
    }
  }

  return workspace;
}

async function deleteWorkspace(id) {
  await run("DELETE FROM workspace_aws_connections WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_s3_configs WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_sns_topics WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_ses_identities WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_cloudwatch_groups WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_rds_instances WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_ec2_instances WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_lambda_functions WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspace_secrets WHERE workspace_id = ?", [id]);
  await run("DELETE FROM workspaces WHERE id = ?", [id]);
}

async function listWorkspaceServices(workspaceId) {
  const [s3, sns, ses, cloudwatch, rds, ec2, lambda, secrets] = await Promise.all([
    all(
      `SELECT w.workspace_id, w.s3_config_id, s.name, s.bucket_name, s.region, s.file_count, s.total_size_bytes
       FROM workspace_s3_configs w
       JOIN s3_connections s ON s.id = w.s3_config_id
       WHERE w.workspace_id = ?`,
      [workspaceId]
    ),
    all("SELECT * FROM workspace_sns_topics WHERE workspace_id = ? ORDER BY topic_name ASC", [workspaceId]),
    all("SELECT * FROM workspace_ses_identities WHERE workspace_id = ? ORDER BY identity ASC", [workspaceId]),
    all("SELECT * FROM workspace_cloudwatch_groups WHERE workspace_id = ? ORDER BY name ASC", [workspaceId]),
    all("SELECT * FROM workspace_rds_instances WHERE workspace_id = ? ORDER BY instance_identifier ASC", [workspaceId]),
    all("SELECT * FROM workspace_ec2_instances WHERE workspace_id = ? ORDER BY instance_id ASC", [workspaceId]),
    all("SELECT * FROM workspace_lambda_functions WHERE workspace_id = ? ORDER BY function_name ASC", [workspaceId]),
    all("SELECT * FROM workspace_secrets WHERE workspace_id = ? ORDER BY secret_name ASC", [workspaceId]),
  ]);

  return { s3, sns, ses, cloudwatch, rds, ec2, lambda, secrets };
}

async function getWorkspaceDetail(workspaceId) {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) return null;
  const [connections, services] = await Promise.all([
    getWorkspaceConnections(workspaceId),
    listWorkspaceServices(workspaceId),
  ]);
  return { ...workspace, aws_connections: connections, services };
}

async function attachWorkspaceS3(workspaceId, payload) {
  const s3ConfigId = String(payload.s3_config_id || payload.s3ConfigId || "").trim();
  if (!s3ConfigId) throw new Error("s3_config_id is required");
  const exists = await get(
    "SELECT workspace_id, s3_config_id FROM workspace_s3_configs WHERE workspace_id = ? AND s3_config_id = ?",
    [workspaceId, s3ConfigId]
  );
  if (exists) return exists;
  await run("INSERT INTO workspace_s3_configs (workspace_id, s3_config_id) VALUES (?, ?)", [
    workspaceId,
    s3ConfigId,
  ]);
  return { workspace_id: workspaceId, s3_config_id: s3ConfigId };
}

async function attachWorkspaceService(workspaceId, serviceType, payload) {
  if (serviceType === "s3") return attachWorkspaceS3(workspaceId, payload);

  const table = WORKSPACE_SERVICE_TABLES[serviceType];
  if (!table) throw new Error(`Unsupported service type: ${serviceType}`);

  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    workspace_id: workspaceId,
    aws_connection_id: payload.aws_connection_id || payload.awsConnectionId || null,
    region: payload.region || null,
    created_at: now,
  };

  if (serviceType === "sns") {
    row.topic_name = payload.topic_name || payload.topicName || "";
    row.topic_arn = payload.topic_arn || payload.topicArn || "";
  } else if (serviceType === "ses") {
    row.identity = payload.identity || "";
  } else if (serviceType === "cloudwatch") {
    row.name = payload.name || "";
    row.log_group_prefix = payload.log_group_prefix || payload.logGroupPrefix || "";
  } else if (serviceType === "rds") {
    row.instance_identifier = payload.instance_identifier || payload.instanceIdentifier || "";
  } else if (serviceType === "ec2") {
    row.instance_id = payload.instance_id || payload.instanceId || "";
    row.linked_server_id = payload.linked_server_id || payload.linkedServerId || null;
  } else if (serviceType === "lambda") {
    row.function_name = payload.function_name || payload.functionName || "";
  } else if (serviceType === "secrets") {
    row.secret_name = payload.secret_name || payload.secretName || "";
    row.secret_arn = payload.secret_arn || payload.secretArn || "";
  }

  const fields = Object.keys(row);
  const values = fields.map((field) => row[field]);
  const placeholders = fields.map(() => "?").join(", ");
  await run(
    `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );
  return row;
}

async function detachWorkspaceService(workspaceId, serviceType, serviceId) {
  if (serviceType === "s3") {
    await run("DELETE FROM workspace_s3_configs WHERE workspace_id = ? AND s3_config_id = ?", [
      workspaceId,
      serviceId,
    ]);
    return;
  }
  const table = WORKSPACE_SERVICE_TABLES[serviceType];
  if (!table) throw new Error(`Unsupported service type: ${serviceType}`);
  await run(`DELETE FROM ${table} WHERE workspace_id = ? AND id = ?`, [workspaceId, serviceId]);
}

module.exports = {
  listWorkspaces,
  getWorkspaceById,
  getWorkspaceDetail,
  saveWorkspace,
  deleteWorkspace,
  listWorkspaceServices,
  attachWorkspaceService,
  detachWorkspaceService,
};
