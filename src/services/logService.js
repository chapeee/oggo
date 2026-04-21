const fs = require("fs-extra");
const path = require("path");
const winston = require("winston");
const { randomUUID } = require("crypto");
const { run, all, get } = require("../db/database");
const { uploadFile, getConnectionById } = require("./s3Service");
const { getLogsDir } = require("./platformService");

fs.ensureDirSync(getLogsDir());

const appLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(getLogsDir(), "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

async function addLog(log, config) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    job_id: log.job_id,
    job_name: log.job_name || "",
    status: log.status || "failed",
    output: log.output || "",
    error: log.error || "",
    duration: Number.isFinite(log.duration) ? log.duration : 0,
    exit_code: Number.isFinite(log.exit_code) ? log.exit_code : 1,
    created_at: log.created_at || now,
  };

  await run(`
    INSERT INTO logs (id, job_id, job_name, status, output, error, duration, exit_code, created_at)
    VALUES (@id, @job_id, @job_name, @status, @output, @error, @duration, @exit_code, @created_at)
  `, record);

  await uploadLogToS3IfNeeded(record, config);

  await pruneLogs(record.job_id, config);
  return record;
}

async function uploadLogToS3IfNeeded(record, config) {
  try {
    const setting = await get("SELECT * FROM job_s3_settings WHERE job_id = ?", [record.job_id]);
    const globalS3 = config?.s3 || {};
    const enabled = setting ? Boolean(setting.upload_enabled) : Boolean(globalS3.autoUploadJobLogs);
    if (!enabled) return;

    const condition = setting?.upload_condition || globalS3.defaultUploadCondition || "failure";
    if (condition === "failure" && record.status !== "failed") return;
    if (condition === "success" && record.status !== "success") return;

    const connectionId = setting?.connection_id || globalS3.defaultConnectionId;
    if (!connectionId) return;
    const connection = await getConnectionById(connectionId);
    if (!connection) return;

    const folderPattern = globalS3.defaultLogFolderPattern || "logs/{YYYY}/{MM}/{DD}/";
    const dt = new Date(record.created_at || Date.now());
    const yyyy = String(dt.getFullYear());
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const folder = folderPattern
      .replace("{YYYY}", yyyy)
      .replace("{MM}", mm)
      .replace("{DD}", dd);

    const pattern = setting?.file_pattern || "{job}-{timestamp}.log";
    const fileName = pattern
      .replace("{job}", String(record.job_name || "job").replace(/[^a-zA-Z0-9-_]/g, "_"))
      .replace("{timestamp}", String(record.created_at || Date.now()).replace(/[:.]/g, "-"));
    const content = [
      `Job: ${record.job_name}`,
      `Status: ${record.status}`,
      `Duration(ms): ${record.duration}`,
      `Exit code: ${record.exit_code}`,
      "",
      "Output:",
      record.output || "",
      "",
      "Error:",
      record.error || "",
    ].join("\n");

    await uploadFile(connectionId, {
      key: `${folder}${fileName}`,
      contentBase64: Buffer.from(content, "utf8").toString("base64"),
      contentType: "text/plain",
      storageClass: globalS3.defaultUploadStorageClass || "STANDARD",
    });
  } catch (_error) {
    // Non-blocking: S3 upload failure should not break local log persistence.
  }
}

async function pruneLogs(jobId, config) {
  if (!jobId) return;
  const maxLogsPerJob = Math.max(10, Number(config?.maxLogsPerJob || 100));
  const retentionDays = Math.max(1, Number(config?.logRetentionDays || 30));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  await run("DELETE FROM logs WHERE job_id = ? AND created_at < ?", [jobId, cutoff]);

  const keepRows = await all(
    "SELECT id FROM logs WHERE job_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [jobId, 1000000, maxLogsPerJob]
  );
  for (const row of keepRows) {
    await run("DELETE FROM logs WHERE id = ?", [row.id]);
  }
}

async function getLogs({ jobId, status, limit = 100, offset = 0 } = {}) {
  const where = [];
  const values = [];

  if (jobId) {
    where.push("job_id = ?");
    values.push(jobId);
  }
  if (status) {
    where.push("status = ?");
    values.push(status);
  }

  const sql = `
    SELECT * FROM logs
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  values.push(Number(limit), Number(offset));
  return all(sql, values);
}

function clearJobLogs(jobId) {
  return run("DELETE FROM logs WHERE job_id = ?", [jobId]);
}

function clearAllLogs() {
  return run("DELETE FROM logs", []);
}

module.exports = {
  appLogger,
  addLog,
  getLogs,
  clearJobLogs,
  clearAllLogs,
};
