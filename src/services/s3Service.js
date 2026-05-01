const { v4: uuidv4 } = require("uuid");
const {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
  GetBucketLocationCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { encrypt, decrypt } = require("./sshService");
const { all, get, run } = require("../db/database");
const { loadConfig } = require("../config/configLoader");

const AWS_REGIONS = [
  { code: "us-east-1", name: "US East (N. Virginia)" },
  { code: "us-east-2", name: "US East (Ohio)" },
  { code: "us-west-1", name: "US West (N. California)" },
  { code: "us-west-2", name: "US West (Oregon)" },
  { code: "ca-central-1", name: "Canada (Central)" },
  { code: "ca-west-1", name: "Canada West (Calgary)" },
  { code: "eu-west-1", name: "Europe (Ireland)" },
  { code: "eu-west-2", name: "Europe (London)" },
  { code: "eu-west-3", name: "Europe (Paris)" },
  { code: "eu-central-1", name: "Europe (Frankfurt)" },
  { code: "eu-central-2", name: "Europe (Zurich)" },
  { code: "eu-north-1", name: "Europe (Stockholm)" },
  { code: "eu-south-1", name: "Europe (Milan)" },
  { code: "eu-south-2", name: "Europe (Spain)" },
  { code: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  { code: "ap-southeast-2", name: "Asia Pacific (Sydney)" },
  { code: "ap-southeast-3", name: "Asia Pacific (Jakarta)" },
  { code: "ap-southeast-4", name: "Asia Pacific (Melbourne)" },
  { code: "ap-northeast-1", name: "Asia Pacific (Tokyo)" },
  { code: "ap-northeast-2", name: "Asia Pacific (Seoul)" },
  { code: "ap-northeast-3", name: "Asia Pacific (Osaka)" },
  { code: "ap-south-1", name: "Asia Pacific (Mumbai)" },
  { code: "ap-south-2", name: "Asia Pacific (Hyderabad)" },
  { code: "ap-east-1", name: "Asia Pacific (Hong Kong)" },
  { code: "me-south-1", name: "Middle East (Bahrain)" },
  { code: "me-central-1", name: "Middle East (UAE)" },
  { code: "sa-east-1", name: "South America (São Paulo)" },
  { code: "af-south-1", name: "Africa (Cape Town)" },
  { code: "il-central-1", name: "Israel (Tel Aviv)" },
];

function normalizePrefix(prefix = "") {
  const cleaned = String(prefix || "").trim().replace(/^\/+/, "");
  if (!cleaned) return "";
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function normalizeContinuationToken(token) {
  const value = String(token ?? "").trim();
  if (!value) return undefined;
  if (value === "undefined" || value === "null") return undefined;
  return value;
}

function sanitizeConnection(row) {
  if (!row) return null;
  return {
    ...row,
    root_prefix: normalizePrefix(row.root_prefix),
    hasSecretKey: Boolean(row.secret_access_key_encrypted),
    secret_access_key_encrypted: undefined,
  };
}

function buildClient(connection) {
  return new S3Client({
    region: connection.region,
    credentials: {
      accessKeyId: connection.access_key_id,
      secretAccessKey: decrypt(connection.secret_access_key_encrypted),
    },
  });
}

async function listConnections() {
  const rows = await all("SELECT * FROM s3_connections ORDER BY sort_order ASC, created_at DESC");
  return rows.map(sanitizeConnection);
}

async function getConnectionById(id) {
  return get("SELECT * FROM s3_connections WHERE id = ?", [id]);
}

async function saveConnection(payload, existing = null) {
  const now = new Date().toISOString();
  const id = existing?.id || uuidv4();
  const secretEncrypted = payload.secret_access_key
    ? encrypt(payload.secret_access_key)
    : existing?.secret_access_key_encrypted || "";

  const row = {
    id,
    name: payload.name,
    description: payload.description || "",
    color: payload.color || "#f97316",
    access_key_id: payload.access_key_id,
    secret_access_key_encrypted: secretEncrypted,
    region: payload.region,
    bucket_name: payload.bucket_name,
    root_prefix: normalizePrefix(payload.root_prefix || ""),
    enabled: payload.enabled === false ? 0 : 1,
    last_tested_at: existing?.last_tested_at || null,
    last_test_result: existing?.last_test_result || null,
    last_test_message: existing?.last_test_message || null,
    file_count: existing?.file_count || 0,
    total_size_bytes: existing?.total_size_bytes || 0,
    created_at: existing?.created_at || now,
    updated_at: now,
    sort_order: Number(payload.sort_order || existing?.sort_order || 0),
  };

  if (existing) {
    await run(
      `UPDATE s3_connections SET
        name=@name, description=@description, color=@color, access_key_id=@access_key_id,
        secret_access_key_encrypted=@secret_access_key_encrypted, region=@region, bucket_name=@bucket_name,
        root_prefix=@root_prefix, enabled=@enabled, updated_at=@updated_at, sort_order=@sort_order
      WHERE id=@id`,
      row
    );
  } else {
    await run(
      `INSERT INTO s3_connections (
        id, name, description, color, access_key_id, secret_access_key_encrypted, region, bucket_name, root_prefix,
        enabled, last_tested_at, last_test_result, last_test_message, file_count, total_size_bytes, created_at, updated_at, sort_order
      ) VALUES (
        @id, @name, @description, @color, @access_key_id, @secret_access_key_encrypted, @region, @bucket_name, @root_prefix,
        @enabled, @last_tested_at, @last_test_result, @last_test_message, @file_count, @total_size_bytes, @created_at, @updated_at, @sort_order
      )`,
      row
    );
  }
  return sanitizeConnection(row);
}

function normalizeAwsError(error) {
  const message = error?.message || "Unknown S3 error";
  const code = error?.name || "S3Error";
  let hint = "Please review the credentials, bucket name, and region.";
  if (/InvalidAccessKeyId|SignatureDoesNotMatch/i.test(code + message)) {
    hint = "Invalid credentials: check access key ID and secret access key.";
  } else if (/NoSuchBucket/i.test(code + message)) {
    hint = "Bucket does not exist in this account/region.";
  } else if (/AccessDenied|Forbidden/i.test(code + message)) {
    hint = "Access denied: ensure IAM user has s3:ListBucket and object permissions.";
  } else if (/PermanentRedirect|AuthorizationHeaderMalformed/i.test(code + message)) {
    hint = "Region mismatch: bucket exists in a different region.";
  } else if (/Timeout|Network/i.test(code + message)) {
    hint = "Network timeout: check internet/VPN and retry.";
  }
  return { code, message, hint };
}

async function testConnection(idOrPayload) {
  const connection =
    typeof idOrPayload === "string"
      ? await getConnectionById(idOrPayload)
      : {
          ...idOrPayload,
          root_prefix: normalizePrefix(idOrPayload.root_prefix),
          secret_access_key_encrypted: encrypt(idOrPayload.secret_access_key || ""),
        };
  if (!connection) throw new Error("S3 connection not found");

  const client = buildClient(connection);
  const testedAt = new Date().toISOString();

  try {
    await client.send(new HeadBucketCommand({ Bucket: connection.bucket_name }));
    const regionRes = await client.send(new GetBucketLocationCommand({ Bucket: connection.bucket_name }));
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: connection.bucket_name,
        Prefix: connection.root_prefix || undefined,
        MaxKeys: 1000,
      })
    );
    const fileCount = Number(listRes.KeyCount || 0);
    const totalSizeBytes = (listRes.Contents || []).reduce((sum, item) => sum + Number(item.Size || 0), 0);

    if (typeof idOrPayload === "string") {
      await run(
        "UPDATE s3_connections SET last_tested_at=?, last_test_result=?, last_test_message=?, file_count=?, total_size_bytes=?, updated_at=? WHERE id=?",
        [testedAt, "success", "Connection successful", fileCount, totalSizeBytes, testedAt, idOrPayload]
      );
    }

    return {
      success: true,
      message: "Connection successful",
      region: regionRes.LocationConstraint || "us-east-1",
      fileCount,
      totalSizeBytes,
      testedAt,
    };
  } catch (error) {
    const normalized = normalizeAwsError(error);
    if (typeof idOrPayload === "string") {
      await run(
        "UPDATE s3_connections SET last_tested_at=?, last_test_result=?, last_test_message=?, updated_at=? WHERE id=?",
        [testedAt, "failed", `${normalized.code}: ${normalized.message}`, testedAt, idOrPayload]
      );
    }
    return {
      success: false,
      ...normalized,
      testedAt,
    };
  }
}

async function listFiles(connectionId, query = {}) {
  const connection = await getConnectionById(connectionId);
  if (!connection) throw new Error("S3 connection not found");

  const client = buildClient(connection);
  const prefix = normalizePrefix(connection.root_prefix) + normalizePrefix(query.prefix || "");
  const maxKeys = Math.max(1, Math.min(1000, Number(query.maxKeys || 100)));
  const continuationToken = normalizeContinuationToken(query.continuationToken);
  let response;
  try {
    response = await client.send(
      new ListObjectsV2Command({
        Bucket: connection.bucket_name,
        Prefix: prefix || undefined,
        Delimiter: query.delimiter || "/",
        ContinuationToken: continuationToken,
        MaxKeys: maxKeys,
      })
    );
  } catch (error) {
    const normalized = normalizeAwsError(error);
    throw new Error(`${normalized.code}: ${normalized.message}. ${normalized.hint}`);
  }

  return {
    bucket: connection.bucket_name,
    prefix,
    folders: (response.CommonPrefixes || []).map((f) => ({ key: f.Prefix })),
    files: (response.Contents || [])
      .filter((f) => f.Key !== prefix)
      .map((f) => ({
        key: f.Key,
        name: f.Key.split("/").pop(),
        size: Number(f.Size || 0),
        lastModified: f.LastModified ? new Date(f.LastModified).toISOString() : null,
        storageClass: f.StorageClass || "STANDARD",
        etag: f.ETag || "",
      })),
    isTruncated: Boolean(response.IsTruncated),
    nextContinuationToken: response.NextContinuationToken || null,
    keyCount: Number(response.KeyCount || 0),
  };
}

async function uploadFile(connectionId, payload) {
  const connection = await getConnectionById(connectionId);
  if (!connection) throw new Error("S3 connection not found");
  const client = buildClient(connection);
  const rootPrefix = normalizePrefix(connection.root_prefix);
  const key = `${rootPrefix}${String(payload.key || "").replace(/^\/+/, "")}`;
  if (!key) throw new Error("Missing target object key");

  const data = Buffer.from(String(payload.contentBase64 || ""), "base64");
  const config = loadConfig();
  const thresholdBytes = Number(config?.s3?.multipartThresholdMb || 10) * 1024 * 1024;
  const storageClass = payload.storageClass || config?.s3?.defaultUploadStorageClass || "STANDARD";
  if (data.length >= thresholdBytes) {
    const uploader = new Upload({
      client,
      queueSize: Number(config?.s3?.concurrentUploadLimit || 3),
      params: {
        Bucket: connection.bucket_name,
        Key: key,
        Body: data,
        ContentType: payload.contentType || "application/octet-stream",
        StorageClass: storageClass,
      },
    });
    await uploader.done();
  } else {
    await client.send(
      new PutObjectCommand({
        Bucket: connection.bucket_name,
        Key: key,
        Body: data,
        ContentType: payload.contentType || "application/octet-stream",
        StorageClass: storageClass,
      })
    );
  }
  return { key };
}

async function deleteFile(connectionId, key) {
  const connection = await getConnectionById(connectionId);
  if (!connection) throw new Error("S3 connection not found");
  const client = buildClient(connection);
  await client.send(new DeleteObjectCommand({ Bucket: connection.bucket_name, Key: key }));
  return { deleted: true, key };
}

async function createFolder(connectionId, folderPath) {
  const key = normalizePrefix(folderPath);
  return uploadFile(connectionId, {
    key,
    contentBase64: "",
    contentType: "application/x-directory",
  });
}

async function generatePresignedUrl(connectionId, key, expiresInSeconds) {
  const connection = await getConnectionById(connectionId);
  if (!connection) throw new Error("S3 connection not found");
  const client = buildClient(connection);
  await client.send(new HeadObjectCommand({ Bucket: connection.bucket_name, Key: key }));
  const expiresIn = Number(expiresInSeconds || loadConfig()?.s3?.defaultPresignedExpiryHours * 3600 || 3600);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: connection.bucket_name, Key: key }),
    { expiresIn }
  );
  return { url, expiresIn };
}

module.exports = {
  AWS_REGIONS,
  listConnections,
  getConnectionById,
  saveConnection,
  testConnection,
  listFiles,
  uploadFile,
  deleteFile,
  createFolder,
  generatePresignedUrl,
  sanitizeConnection,
};
