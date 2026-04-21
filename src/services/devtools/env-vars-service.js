const { v4: uuidv4 } = require("uuid");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { all, get, run } = require("../../db/database");
const { encrypt, decrypt } = require("../sshService");
const { getAwsConnectionById } = require("../awsService");

/**
 * Validates environment variable naming convention.
 *
 * @param {string} name
 * @returns {boolean}
 */
function validateEnvVarName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Lists environment variables with masked values.
 *
 * @returns {Promise<any[]>}
 */
async function listEnvVars() {
  const rows = await all("SELECT * FROM env_variables ORDER BY name ASC");
  return rows.map((row) => ({
    ...row,
    valueMasked: row.value_encrypted ? "********" : row.secret_ref ? `aws:${row.secret_ref}` : "",
  }));
}

/**
 * Creates one environment variable.
 *
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createEnvVar(payload) {
  if (!validateEnvVarName(payload.name || "")) {
    throw new Error("Invalid variable name. Use uppercase letters, numbers, and underscores; cannot start with number.");
  }
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    name: payload.name,
    description: payload.description || "",
    source_type: payload.sourceType || "manual",
    value_encrypted: payload.sourceType === "manual" ? encrypt(payload.value || "") : "",
    aws_connection_id: payload.awsConnectionId || null,
    secret_ref: payload.secretRef || null,
    secret_key: payload.secretKey || null,
    scope_type: payload.scopeType || "global",
    scope_target_id: payload.scopeTargetId || null,
    sensitive: payload.sensitive === false ? 0 : 1,
    group_name: payload.groupName || "",
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };
  const exists = await get(
    "SELECT id FROM env_variables WHERE name = ? AND scope_type = ? AND COALESCE(scope_target_id,'') = COALESCE(?, '')",
    [row.name, row.scope_type, row.scope_target_id]
  );
  if (exists) throw new Error("Duplicate variable name in same scope");

  await run(
    `INSERT INTO env_variables (id,name,description,source_type,value_encrypted,aws_connection_id,secret_ref,secret_key,scope_type,scope_target_id,sensitive,group_name,last_used_at,created_at,updated_at)
     VALUES (@id,@name,@description,@source_type,@value_encrypted,@aws_connection_id,@secret_ref,@secret_key,@scope_type,@scope_target_id,@sensitive,@group_name,@last_used_at,@created_at,@updated_at)`,
    row
  );
  return row;
}

/**
 * Deletes one environment variable.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteEnvVar(id) {
  await run("DELETE FROM env_variables WHERE id = ?", [id]);
}

/**
 * Resolves environment variable value either locally or from AWS Secrets Manager.
 *
 * @param {Record<string, any>} row
 * @returns {Promise<string>}
 */
async function resolveEnvVarValue(row) {
  if (row.source_type === "manual") return decrypt(row.value_encrypted || "");
  if (row.source_type === "aws_secret") {
    if (!row.aws_connection_id || !row.secret_ref) throw new Error(`AWS secret variable ${row.name} is misconfigured`);
    const conn = await getAwsConnectionById(row.aws_connection_id);
    if (!conn) throw new Error(`AWS connection not configured for ${row.name}`);
    const client = new SecretsManagerClient({
      region: conn.default_region,
      credentials: {
        accessKeyId: conn.access_key_id,
        secretAccessKey: decrypt(conn.secret_access_key_encrypted),
        ...(conn.session_token_encrypted ? { sessionToken: decrypt(conn.session_token_encrypted) } : {}),
      },
    });
    const secretRes = await client.send(new GetSecretValueCommand({ SecretId: row.secret_ref }));
    const secretString = secretRes.SecretString || "";
    if (row.secret_key) {
      let parsed;
      try {
        parsed = JSON.parse(secretString);
      } catch (_error) {
        throw new Error(`Secret ${row.secret_ref} is not JSON but key selector was provided`);
      }
      return String(parsed[row.secret_key] ?? "");
    }
    return secretString;
  }
  return "";
}

module.exports = {
  validateEnvVarName,
  listEnvVars,
  createEnvVar,
  deleteEnvVar,
  resolveEnvVarValue,
};

