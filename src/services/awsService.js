const { v4: uuidv4 } = require("uuid");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
const { CloudWatchLogsClient, DescribeLogGroupsCommand } = require("@aws-sdk/client-cloudwatch-logs");
const { RDSClient, DescribeDBInstancesCommand } = require("@aws-sdk/client-rds");
const { EC2Client, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const { LambdaClient, ListFunctionsCommand } = require("@aws-sdk/client-lambda");
const { SESClient, GetAccountSendingEnabledCommand } = require("@aws-sdk/client-ses");
const { SNSClient, ListTopicsCommand } = require("@aws-sdk/client-sns");
const { SecretsManagerClient, ListSecretsCommand } = require("@aws-sdk/client-secrets-manager");
const { encrypt, decrypt } = require("./sshService");
const { all, get, run } = require("../db/database");
const { AWS_REGIONS } = require("./s3Service");

const IAM_HELPER = {
  s3: ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
  cloudwatch: ["logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:GetLogEvents", "logs:StartQuery", "logs:GetQueryResults"],
  rds: ["rds:DescribeDBInstances", "rds:DescribeDBLogFiles", "rds:DownloadDBLogFilePortion"],
  ec2: ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus", "ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances"],
  lambda: ["lambda:ListFunctions", "lambda:InvokeFunction"],
  ses: ["ses:GetAccountSendingEnabled", "ses:ListIdentities", "ses:SendEmail"],
  sns: ["sns:ListTopics", "sns:Publish", "sns:ListSubscriptionsByTopic"],
  secretsManager: ["secretsmanager:ListSecrets", "secretsmanager:GetSecretValue"],
  sts: ["sts:GetCallerIdentity"],
};

function sanitizeAwsConnection(row) {
  if (!row) return null;
  return {
    ...row,
    service_access: row.service_access ? JSON.parse(row.service_access) : {},
    hasSecretKey: Boolean(row.secret_access_key_encrypted),
    hasSessionToken: Boolean(row.session_token_encrypted),
    secret_access_key_encrypted: undefined,
    session_token_encrypted: undefined,
  };
}

function buildCredentials(row) {
  const creds = {
    accessKeyId: row.access_key_id,
    secretAccessKey: decrypt(row.secret_access_key_encrypted),
  };
  if (row.session_token_encrypted) creds.sessionToken = decrypt(row.session_token_encrypted);
  return creds;
}

function clientConfig(row, regionOverride) {
  return { region: regionOverride || row.default_region, credentials: buildCredentials(row) };
}

async function listAwsConnections() {
  const rows = await all("SELECT * FROM aws_connections ORDER BY sort_order ASC, created_at DESC");
  return rows.map(sanitizeAwsConnection);
}

async function getAwsConnectionById(id) {
  return get("SELECT * FROM aws_connections WHERE id = ?", [id]);
}

async function saveAwsConnection(payload, existing = null) {
  const now = new Date().toISOString();
  const row = {
    id: existing?.id || uuidv4(),
    name: payload.name,
    description: payload.description || "",
    color: payload.color || "#f97316",
    access_key_id: payload.access_key_id,
    secret_access_key_encrypted: payload.secret_access_key
      ? encrypt(payload.secret_access_key)
      : existing?.secret_access_key_encrypted || "",
    session_token_encrypted: payload.session_token
      ? encrypt(payload.session_token)
      : existing?.session_token_encrypted || "",
    default_region: payload.default_region || "us-east-1",
    account_id: existing?.account_id || "",
    service_access: existing?.service_access || "{}",
    last_tested_at: existing?.last_tested_at || null,
    last_test_result: existing?.last_test_result || null,
    last_test_message: existing?.last_test_message || null,
    enabled: payload.enabled === false ? 0 : 1,
    created_at: existing?.created_at || now,
    updated_at: now,
    sort_order: Number(payload.sort_order || existing?.sort_order || 0),
  };

  if (existing) {
    await run(
      `UPDATE aws_connections SET
        name=@name, description=@description, color=@color, access_key_id=@access_key_id,
        secret_access_key_encrypted=@secret_access_key_encrypted, session_token_encrypted=@session_token_encrypted,
        default_region=@default_region, enabled=@enabled, updated_at=@updated_at, sort_order=@sort_order
      WHERE id=@id`,
      row
    );
  } else {
    await run(
      `INSERT INTO aws_connections (
        id,name,description,color,access_key_id,secret_access_key_encrypted,session_token_encrypted,
        default_region,account_id,service_access,last_tested_at,last_test_result,last_test_message,
        enabled,created_at,updated_at,sort_order
      ) VALUES (
        @id,@name,@description,@color,@access_key_id,@secret_access_key_encrypted,@session_token_encrypted,
        @default_region,@account_id,@service_access,@last_tested_at,@last_test_result,@last_test_message,
        @enabled,@created_at,@updated_at,@sort_order
      )`,
      row
    );
  }
  return sanitizeAwsConnection(row);
}

async function safeCheck(label, fn) {
  try {
    await fn();
    return { ok: true, message: "ok" };
  } catch (error) {
    return { ok: false, message: error.message || "access denied" };
  }
}

async function testAwsConnection(idOrPayload) {
  const row =
    typeof idOrPayload === "string"
      ? await getAwsConnectionById(idOrPayload)
      : {
          access_key_id: idOrPayload.access_key_id,
          secret_access_key_encrypted: encrypt(idOrPayload.secret_access_key || ""),
          session_token_encrypted: idOrPayload.session_token ? encrypt(idOrPayload.session_token) : "",
          default_region: idOrPayload.default_region || "us-east-1",
        };
  if (!row) throw new Error("AWS connection not found");

  const sts = new STSClient(clientConfig(row));
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  const checks = {
    s3: await safeCheck("s3", async () => {
      const c = new S3Client(clientConfig(row));
      await c.send(new ListBucketsCommand({}));
    }),
    cloudwatch: await safeCheck("cloudwatch", async () => {
      const c = new CloudWatchLogsClient(clientConfig(row));
      await c.send(new DescribeLogGroupsCommand({ limit: 1 }));
    }),
    rds: await safeCheck("rds", async () => {
      const c = new RDSClient(clientConfig(row));
      await c.send(new DescribeDBInstancesCommand({ MaxRecords: 20 }));
    }),
    ec2: await safeCheck("ec2", async () => {
      const c = new EC2Client(clientConfig(row));
      await c.send(new DescribeInstancesCommand({ MaxResults: 5 }));
    }),
    lambda: await safeCheck("lambda", async () => {
      const c = new LambdaClient(clientConfig(row));
      await c.send(new ListFunctionsCommand({ MaxItems: 5 }));
    }),
    ses: await safeCheck("ses", async () => {
      const c = new SESClient(clientConfig(row));
      await c.send(new GetAccountSendingEnabledCommand({}));
    }),
    sns: await safeCheck("sns", async () => {
      const c = new SNSClient(clientConfig(row));
      await c.send(new ListTopicsCommand({}));
    }),
    secretsManager: await safeCheck("secretsManager", async () => {
      const c = new SecretsManagerClient(clientConfig(row));
      await c.send(new ListSecretsCommand({ MaxResults: 5 }));
    }),
  };

  const result = {
    success: true,
    accountId: identity.Account || "",
    arn: identity.Arn || "",
    serviceAccess: checks,
    testedAt: new Date().toISOString(),
  };

  if (typeof idOrPayload === "string") {
    await run(
      "UPDATE aws_connections SET account_id=?, service_access=?, last_tested_at=?, last_test_result=?, last_test_message=?, updated_at=? WHERE id=?",
      [
        result.accountId,
        JSON.stringify(checks),
        result.testedAt,
        "success",
        "Connection successful",
        result.testedAt,
        idOrPayload,
      ]
    );
  }

  return result;
}

async function listCloudWatchLogGroups(connectionId, params = {}) {
  const row = await getAwsConnectionById(connectionId);
  if (!row) throw new Error("AWS connection not found");
  const client = new CloudWatchLogsClient(clientConfig(row, params.region));
  const out = await client.send(
    new DescribeLogGroupsCommand({
      logGroupNamePrefix: params.prefix || undefined,
      limit: Number(params.limit || 50),
    })
  );
  return (out.logGroups || []).map((g) => ({
    name: g.logGroupName,
    retentionInDays: g.retentionInDays || null,
    storedBytes: Number(g.storedBytes || 0),
    arn: g.arn,
  }));
}

async function listRdsInstances(connectionId, params = {}) {
  const row = await getAwsConnectionById(connectionId);
  if (!row) throw new Error("AWS connection not found");
  const client = new RDSClient(clientConfig(row, params.region));
  const out = await client.send(new DescribeDBInstancesCommand({ MaxRecords: 100 }));
  return (out.DBInstances || []).map((db) => ({
    identifier: db.DBInstanceIdentifier,
    engine: db.Engine,
    engineVersion: db.EngineVersion,
    class: db.DBInstanceClass,
    status: db.DBInstanceStatus,
    endpoint: db.Endpoint?.Address || "",
    port: db.Endpoint?.Port || null,
    az: db.AvailabilityZone || "",
    multiAz: Boolean(db.MultiAZ),
    allocatedStorage: db.AllocatedStorage || 0,
  }));
}

async function listEc2Instances(connectionId, params = {}) {
  const row = await getAwsConnectionById(connectionId);
  if (!row) throw new Error("AWS connection not found");
  const client = new EC2Client(clientConfig(row, params.region));
  const out = await client.send(new DescribeInstancesCommand({}));
  const instances = [];
  for (const reservation of out.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const nameTag = (instance.Tags || []).find((t) => t.Key === "Name")?.Value || "";
      instances.push({
        instanceId: instance.InstanceId,
        name: nameTag,
        instanceType: instance.InstanceType,
        state: instance.State?.Name || "",
        publicIp: instance.PublicIpAddress || "",
        privateIp: instance.PrivateIpAddress || "",
        az: instance.Placement?.AvailabilityZone || "",
        launchTime: instance.LaunchTime ? new Date(instance.LaunchTime).toISOString() : null,
      });
    }
  }
  return instances;
}

async function listLambdaFunctions(connectionId, params = {}) {
  const row = await getAwsConnectionById(connectionId);
  if (!row) throw new Error("AWS connection not found");
  const client = new LambdaClient(clientConfig(row, params.region));
  const out = await client.send(new ListFunctionsCommand({ MaxItems: Number(params.limit || 100) }));
  return (out.Functions || []).map((fn) => ({
    name: fn.FunctionName,
    runtime: fn.Runtime,
    memorySize: fn.MemorySize,
    timeout: fn.Timeout,
    lastModified: fn.LastModified,
    codeSize: fn.CodeSize,
    arn: fn.FunctionArn,
  }));
}

async function listSecrets(connectionId, params = {}) {
  const row = await getAwsConnectionById(connectionId);
  if (!row) throw new Error("AWS connection not found");
  const client = new SecretsManagerClient(clientConfig(row, params.region));
  const out = await client.send(new ListSecretsCommand({ MaxResults: Number(params.limit || 100) }));
  return (out.SecretList || []).map((s) => ({
    name: s.Name,
    arn: s.ARN,
    lastChangedDate: s.LastChangedDate ? new Date(s.LastChangedDate).toISOString() : null,
    deletedDate: s.DeletedDate ? new Date(s.DeletedDate).toISOString() : null,
  }));
}

module.exports = {
  AWS_REGIONS,
  IAM_HELPER,
  listAwsConnections,
  getAwsConnectionById,
  saveAwsConnection,
  testAwsConnection,
  listCloudWatchLogGroups,
  listRdsInstances,
  listEc2Instances,
  listLambdaFunctions,
  listSecrets,
  sanitizeAwsConnection,
};

