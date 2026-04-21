/**
 * workspaceService.js
 *
 * Business logic for AWS Workspaces. This layer validates input,
 * orchestrates repository calls and keeps route handlers thin.
 */

const { get } = require("../db/database");
const workspaceRepository = require("../db/repositories/workspaceRepository");
const { notFoundError, validationError } = require("../errors/app-error");
const { listEc2Instances, listRdsInstances } = require("./awsService");

const SERVICE_TYPES = ["sns", "ses", "cloudwatch", "rds", "ec2", "lambda", "secrets"];

/**
 * List workspace summaries for card grid.
 *
 * @returns {Promise<Array<Object>>}
 */
async function listWorkspaces() {
  return workspaceRepository.getWorkspaceSummaries();
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

  const [awsConnections, s3Configs, services] = await Promise.all([
    workspaceRepository.getAwsConnections(id),
    workspaceRepository.getS3Configs(id),
    workspaceRepository.getServices(id, null),
  ]);

  const grouped = {
    s3: s3Configs,
    sns: [],
    ses: [],
    cloudwatch: [],
    rds: [],
    ec2: [],
    lambda: [],
    secrets: [],
  };
  for (const service of services) {
    if (grouped[service.service_type]) {
      grouped[service.service_type].push(service);
    }
  }

  return { ...workspace, aws_connections: awsConnections, services: grouped };
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
  const created = await workspaceRepository.create(data);
  if (data.awsConnectionId) {
    await workspaceRepository.addAwsConnection(created.id, data.awsConnectionId, true);
  }
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
  return workspaceRepository.update(id, data);
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

/**
 * Attach S3 config to a workspace.
 *
 * @param {string} workspaceId
 * @param {string} s3ConfigId
 * @param {string} label
 * @returns {Promise<Array<Object>>}
 */
async function attachS3Config(workspaceId, s3ConfigId, label = "") {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId });
  }
  const s3Config = await get("SELECT id FROM s3_connections WHERE id = ?", [s3ConfigId]);
  if (!s3Config) {
    throw validationError("s3ConfigId does not exist", { s3ConfigId });
  }
  const current = await workspaceRepository.getS3Configs(workspaceId);
  if (current.some((row) => row.s3_config_id === s3ConfigId)) {
    throw validationError("S3 config already attached to workspace", { workspaceId, s3ConfigId });
  }
  await workspaceRepository.addS3Config(workspaceId, s3ConfigId, label);
  return workspaceRepository.getS3Configs(workspaceId);
}

/**
 * Attach generic AWS service to workspace.
 *
 * @param {string} workspaceId
 * @param {{awsConnectionId: string, serviceType: string, serviceIdentifier: string, friendlyName?: string, region?: string, metadata?: object|string}} data
 * @returns {Promise<Object>}
 */
async function attachService(workspaceId, data) {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId });
  }
  const serviceType = String(data?.serviceType || "").trim().toLowerCase();
  if (!SERVICE_TYPES.includes(serviceType)) {
    throw validationError("Invalid serviceType", { allowed: SERVICE_TYPES });
  }
  const serviceIdentifier = String(data?.serviceIdentifier || "").trim();
  if (!serviceIdentifier) {
    throw validationError("serviceIdentifier is required");
  }
  if (!String(data?.awsConnectionId || "").trim()) {
    throw validationError("awsConnectionId is required");
  }
  return workspaceRepository.addService(workspaceId, {
    ...data,
    serviceType,
    serviceIdentifier,
  });
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

/**
 * Read live EC2/RDS stats for workspace primary account.
 *
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
async function getWorkspaceStats(workspaceId) {
  const empty = { ec2: { total: 0, running: 0, stopped: 0 }, rds: { total: 0, available: 0, issues: 0 } };
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw notFoundError("Workspace not found", { workspaceId });
  }
  const connections = await workspaceRepository.getAwsConnections(workspaceId);
  const primary = connections.find((row) => Number(row.is_primary) === 1) || connections[0];
  if (!primary?.aws_connection_id) return empty;

  try {
    const [ec2, rds] = await Promise.all([
      listEc2Instances(primary.aws_connection_id, { region: workspace.default_region || primary.default_region }),
      listRdsInstances(primary.aws_connection_id, { region: workspace.default_region || primary.default_region }),
    ]);
    const runningEc2 = (ec2 || []).filter((row) => String(row.state || "").toLowerCase() === "running").length;
    const stoppedEc2 = (ec2 || []).filter((row) => String(row.state || "").toLowerCase() === "stopped").length;
    const availableRds = (rds || []).filter((row) => String(row.status || "").toLowerCase() === "available").length;
    return {
      ec2: { total: (ec2 || []).length, running: runningEc2, stopped: stoppedEc2 },
      rds: { total: (rds || []).length, available: availableRds, issues: (rds || []).length - availableRds },
    };
  } catch (_error) {
    return empty;
  }
}

module.exports = {
  listWorkspaces,
  getWorkspaceDetail,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  attachS3Config,
  attachService,
  detachService,
  getWorkspaceStats,
};
