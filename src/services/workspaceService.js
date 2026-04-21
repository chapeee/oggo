const { randomUUID } = require("crypto");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { SNSClient, GetTopicAttributesCommand } = require("@aws-sdk/client-sns");
const { SESClient, GetIdentityVerificationAttributesCommand } = require("@aws-sdk/client-ses");
const { CloudWatchLogsClient, DescribeLogGroupsCommand } = require("@aws-sdk/client-cloudwatch-logs");
const { RDSClient, DescribeDBInstancesCommand } = require("@aws-sdk/client-rds");
const { EC2Client, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const { LambdaClient, GetFunctionCommand } = require("@aws-sdk/client-lambda");
const { SecretsManagerClient, DescribeSecretCommand } = require("@aws-sdk/client-secrets-manager");
const workspaceRepository = require("../db/repositories/workspaceRepository");
const { notFoundError, validationError } = require("../errors/app-error");
const { encrypt, decrypt } = require("./sshService");

const SERVICE_TYPES = workspaceRepository.SERVICE_TYPES || ["s3", "sns", "ses", "cloudwatch", "rds", "ec2", "lambda", "secrets"];

/**
 * List workspace summaries for card grid.
 *
 * @returns {Promise<Array<Object>>}
 */
async function listWorkspaces() {
  const rows = await workspaceRepository.getWorkspaceSummaries();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color || "#f97316",
    description: row.description || "",
    defaultRegion: row.default_region || "us-east-1",
    serviceCounts: row.service_counts || {},
    health: row.health || { total: 0, ok: 0, error: 0 },
    updatedAt: row.updated_at || row.created_at || null,
  }));
}

/**
 * Get full workspace detail with grouped services.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getWorkspaceDetail(id) {
  const workspace = await workspaceRepository.findById(id);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId: id });
  }

  const grouped = {
    s3: [],
    sns: [],
    ses: [],
    cloudwatch: [],
    rds: [],
    ec2: [],
    lambda: [],
    secrets: [],
  };
  const services = await workspaceRepository.getServices(id, null);
  for (const service of services) {
    if (grouped[service.service_type]) {
      grouped[service.service_type].push({
        id: service.id,
        friendlyName: service.friendly_name,
        region: service.region,
        resourceIdentifier: service.resource_identifier,
        status: service.status || "untested",
        lastTestedAt: service.last_tested_at || null,
        errorMessage: service.error_message || "",
        configJson: service.config_json || {},
      });
    }
  }

  return {
    id: workspace.id,
    name: workspace.name,
    color: workspace.color || "#f97316",
    description: workspace.description || "",
    defaultRegion: workspace.default_region || "us-east-1",
    hasDefaultCredentials: Boolean(workspace.default_access_key_id && workspace.default_secret_access_key),
    services: grouped,
  };
}

/**
 * Create new workspace and optional primary AWS connection.
 *
 * @param {{name: string, description?: string, color?: string, defaultRegion?: string, default_region?: string, awsConnectionId?: string}} data
 * @returns {Promise<Object>}
 */
async function createWorkspace(data) {
  if (!String(data?.name || "").trim()) {
    throw validationError("name is required");
  }
  const payload = {
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    color: String(data.color || "#f97316"),
    defaultRegion: String(data.defaultRegion || data.default_region || "us-east-1"),
    defaultAccessKeyId: String(data.defaultAccessKeyId || "").trim(),
    defaultSecretAccessKeyEncrypted: data.defaultSecretAccessKey ? encrypt(String(data.defaultSecretAccessKey)) : "",
  };
  const created = await workspaceRepository.create(payload);
  return created;
}

/**
 * Update workspace metadata.
 *
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function updateWorkspace(id, data) {
  const existing = await workspaceRepository.findById(id);
  if (!existing) {
    throw notFoundError("Workspace not found", { workspaceId: id });
  }
  const payload = {
    name: data.name !== undefined ? String(data.name || "").trim() : existing.name,
    description: data.description !== undefined ? String(data.description || "").trim() : existing.description,
    color: data.color !== undefined ? String(data.color || "#f97316") : existing.color,
    defaultRegion:
      data.defaultRegion !== undefined || data.default_region !== undefined
        ? String(data.defaultRegion || data.default_region || "us-east-1")
        : existing.default_region,
  };
  if (data.defaultAccessKeyId !== undefined) payload.defaultAccessKeyId = String(data.defaultAccessKeyId || "").trim();
  if (data.defaultSecretAccessKey !== undefined) {
    payload.defaultSecretAccessKeyEncrypted = data.defaultSecretAccessKey
      ? encrypt(String(data.defaultSecretAccessKey))
      : "";
  }
  return workspaceRepository.update(id, payload);
}

/**
 * Delete workspace.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteWorkspace(id) {
  const existing = await workspaceRepository.findById(id);
  if (!existing) {
    throw notFoundError("Workspace not found", { workspaceId: id });
  }
  await workspaceRepository.deleteById(id);
  return true;
}

function sanitizeService(service) {
  if (!service) return null;
  return {
    id: service.id,
    workspaceId: service.workspace_id,
    serviceType: service.service_type,
    friendlyName: service.friendly_name || "",
    region: service.region || "",
    resourceIdentifier: service.resource_identifier || "",
    configJson: service.config_json || {},
    status: service.status || "untested",
    lastTestedAt: service.last_tested_at || null,
    errorMessage: service.error_message || "",
    createdAt: service.created_at || null,
  };
}

async function validateServicePayload(workspaceId, data, partial = false) {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId });
  }
  const serviceType = String(data?.serviceType || "").trim().toLowerCase();
  if (!SERVICE_TYPES.includes(serviceType)) {
    throw validationError("Invalid serviceType", { allowed: SERVICE_TYPES });
  }
  if (!partial && !String(data?.friendlyName || "").trim()) {
    throw validationError("friendlyName is required");
  }
  if (!partial && !String(data?.resourceIdentifier || "").trim()) {
    throw validationError("resourceIdentifier is required");
  }
  if (!partial && !String(data?.region || "").trim()) {
    throw validationError("region is required");
  }
  if (!partial && !String(data?.accessKeyId || "").trim()) {
    throw validationError("accessKeyId is required");
  }
  if (!partial && !String(data?.secretAccessKey || "").trim()) {
    throw validationError("secretAccessKey is required");
  }
  return { workspace, serviceType };
}

async function attachService(workspaceId, data) {
  const { serviceType } = await validateServicePayload(workspaceId, data, false);
  const created = await workspaceRepository.addService(workspaceId, {
    serviceType,
    friendlyName: String(data.friendlyName || "").trim(),
    accessKeyIdEncrypted: encrypt(String(data.accessKeyId || "").trim()),
    secretAccessKeyEncrypted: encrypt(String(data.secretAccessKey || "").trim()),
    region: String(data.region || "").trim(),
    resourceIdentifier: String(data.resourceIdentifier || "").trim(),
    configJson: data.configJson || {},
  });
  return sanitizeService(created);
}

async function updateService(workspaceId, serviceId, data) {
  const current = await workspaceRepository.getServiceById(workspaceId, serviceId);
  if (!current) throw notFoundError("Service attachment not found", { workspaceId, serviceId });
  const normalizedType = data.serviceType !== undefined ? String(data.serviceType || "").trim().toLowerCase() : current.service_type;
  if (!SERVICE_TYPES.includes(normalizedType)) {
    throw validationError("Invalid serviceType", { allowed: SERVICE_TYPES });
  }
  const payload = {
    serviceType: normalizedType,
    friendlyName: data.friendlyName !== undefined ? String(data.friendlyName || "").trim() : current.friendly_name,
    region: data.region !== undefined ? String(data.region || "").trim() : current.region,
    resourceIdentifier:
      data.resourceIdentifier !== undefined
        ? String(data.resourceIdentifier || "").trim()
        : current.resource_identifier,
    configJson: data.configJson !== undefined ? (data.configJson || {}) : (() => {
      try { return JSON.parse(current.config_json || "{}"); } catch (_error) { return {}; }
    })(),
  };
  if (data.accessKeyId !== undefined && String(data.accessKeyId || "").trim()) {
    payload.accessKeyIdEncrypted = encrypt(String(data.accessKeyId || "").trim());
  }
  if (data.secretAccessKey !== undefined && String(data.secretAccessKey || "").trim()) {
    payload.secretAccessKeyEncrypted = encrypt(String(data.secretAccessKey || "").trim());
  }
  const updated = await workspaceRepository.updateService(workspaceId, serviceId, payload);
  return sanitizeService(updated);
}

/**
 * Detach workspace service by id.
 *
 * @param {string} workspaceId
 * @param {string} serviceId
 * @returns {Promise<boolean>}
 */
async function detachService(workspaceId, serviceId) {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId });
  }
  await workspaceRepository.removeService(workspaceId, serviceId);
  return true;
}

function buildClientConfig(accessKeyId, secretAccessKey, region) {
  return {
    region: region || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  };
}

function parseAwsError(error) {
  const message = String(error?.message || "Unknown AWS error");
  if (message.includes("InvalidClientTokenId")) return "InvalidClientTokenId: Access Key ID is wrong";
  if (message.includes("SignatureDoesNotMatch")) return "SignatureDoesNotMatch: Secret Access Key is wrong";
  if (message.includes("NoSuchBucket")) return "NoSuchBucket: Bucket name does not exist or wrong region";
  if (message.includes("AuthorizationError")) return "AuthorizationError: Credentials don't have permission for this action";
  if (message.includes("UnknownEndpoint")) return "UnknownEndpoint: Wrong region selected";
  return message;
}

async function executeServiceTest(serviceType, region, accessKeyId, secretAccessKey, resourceIdentifier) {
  const cfg = buildClientConfig(accessKeyId, secretAccessKey, region);
  if (serviceType === "s3") {
    const client = new S3Client(cfg);
    await client.send(new ListObjectsV2Command({ Bucket: resourceIdentifier, MaxKeys: 1 }));
    return { success: true, message: "Bucket reachable", details: { bucket: resourceIdentifier } };
  }
  if (serviceType === "sns") {
    const client = new SNSClient(cfg);
    await client.send(new GetTopicAttributesCommand({ TopicArn: resourceIdentifier }));
    return { success: true, message: "SNS topic reachable", details: { topicArn: resourceIdentifier } };
  }
  if (serviceType === "ses") {
    const client = new SESClient(cfg);
    const out = await client.send(new GetIdentityVerificationAttributesCommand({ Identities: [resourceIdentifier] }));
    return { success: true, message: "SES identity reachable", details: out.VerificationAttributes || {} };
  }
  if (serviceType === "cloudwatch") {
    const client = new CloudWatchLogsClient(cfg);
    await client.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: resourceIdentifier, limit: 1 }));
    return { success: true, message: "CloudWatch reachable", details: { logGroup: resourceIdentifier } };
  }
  if (serviceType === "rds") {
    const client = new RDSClient(cfg);
    const out = await client.send(new DescribeDBInstancesCommand({}));
    const match = (out.DBInstances || []).find((db) =>
      String(db.DBInstanceIdentifier || db.Endpoint?.Address || "").includes(resourceIdentifier)
    );
    if (!match) throw new Error("RDS instance not found");
    return { success: true, message: "RDS instance reachable", details: { identifier: match.DBInstanceIdentifier } };
  }
  if (serviceType === "ec2") {
    const client = new EC2Client(cfg);
    await client.send(new DescribeInstancesCommand({ Filters: [{ Name: "instance-id", Values: [resourceIdentifier] }] }));
    return { success: true, message: "EC2 instance query succeeded", details: { instanceId: resourceIdentifier } };
  }
  if (serviceType === "lambda") {
    const client = new LambdaClient(cfg);
    await client.send(new GetFunctionCommand({ FunctionName: resourceIdentifier }));
    return { success: true, message: "Lambda function reachable", details: { functionName: resourceIdentifier } };
  }
  if (serviceType === "secrets") {
    const client = new SecretsManagerClient(cfg);
    await client.send(new DescribeSecretCommand({ SecretId: resourceIdentifier }));
    return { success: true, message: "Secret reachable", details: { secretId: resourceIdentifier } };
  }
  throw validationError("Unsupported serviceType", { serviceType });
}

async function testServiceAttachment(workspaceId, serviceId) {
  const service = await workspaceRepository.getServiceById(workspaceId, serviceId);
  if (!service) throw notFoundError("Service attachment not found", { workspaceId, serviceId });
  try {
    const accessKeyId = decrypt(service.access_key_id || "");
    const secretAccessKey = decrypt(service.secret_access_key || "");
    const result = await executeServiceTest(
      String(service.service_type || ""),
      String(service.region || ""),
      accessKeyId,
      secretAccessKey,
      String(service.resource_identifier || "")
    );
    await workspaceRepository.updateServiceStatus(workspaceId, serviceId, "ok", "");
    return result;
  } catch (error) {
    const message = parseAwsError(error);
    await workspaceRepository.updateServiceStatus(workspaceId, serviceId, "error", message);
    return { success: false, message, details: {} };
  }
}

async function testServiceDraft(workspaceId, data) {
  const { serviceType } = await validateServicePayload(workspaceId, data, false);
  try {
    return await executeServiceTest(
      serviceType,
      String(data.region || ""),
      String(data.accessKeyId || ""),
      String(data.secretAccessKey || ""),
      String(data.resourceIdentifier || "")
    );
  } catch (error) {
    return { success: false, message: parseAwsError(error), details: {} };
  }
}

async function useWorkspaceDefaultCredentials(workspaceId, serviceId) {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) throw notFoundError("Workspace not found", { workspaceId });
  if (!workspace.default_access_key_id || !workspace.default_secret_access_key) {
    throw validationError("Workspace default credentials are not configured");
  }
  const updated = await workspaceRepository.updateService(workspaceId, serviceId, {
    accessKeyIdEncrypted: encrypt(String(workspace.default_access_key_id || "")),
    secretAccessKeyEncrypted: String(workspace.default_secret_access_key || ""),
    status: "untested",
    errorMessage: "",
    lastTestedAt: null,
  });
  return sanitizeService(updated);
}

async function getWorkspaceStats(workspaceId) {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) throw notFoundError("Workspace not found", { workspaceId });
  const services = await workspaceRepository.getServices(workspaceId, null);
  const ec2Rows = services.filter((row) => row.service_type === "ec2");
  const rdsRows = services.filter((row) => row.service_type === "rds");
  return {
    ec2: {
      total: ec2Rows.length,
      running: ec2Rows.filter((row) => row.status === "ok").length,
      stopped: ec2Rows.filter((row) => row.status === "error").length,
    },
    rds: {
      total: rdsRows.length,
      available: rdsRows.filter((row) => row.status === "ok").length,
      issues: rdsRows.filter((row) => row.status === "error").length,
    },
  };
}

module.exports = {
  listWorkspaces,
  getWorkspaceDetail,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  attachService,
  updateService,
  detachService,
  testServiceAttachment,
  testServiceDraft,
  useWorkspaceDefaultCredentials,
  getWorkspaceStats,
};
