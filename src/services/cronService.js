const cron = require("node-cron");
const { exec, execSync, spawnSync } = require("child_process");
const { promisify } = require("util");
const { getDb } = require("../db/database");
const { addLog, appLogger } = require("./logService");
const { sendJobNotification } = require("./mailService");
const { isUnix } = require("./platformService");
const { loadConfig } = require("../config/configLoader");

const execAsync = promisify(exec);
const scheduledJobs = new Map();

function parseSystemCrontab(content) {
  const rows = content.split(/\r?\n/);
  return rows
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(
        /^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+?)(?:\s+#\s*oggo ([a-zA-Z0-9-]+))?$/
      );
      if (!match) return null;
      return {
        schedule: match[1],
        command: match[2],
        jobId: match[3] || null,
      };
    })
    .filter(Boolean);
}

function readSystemCrontab() {
  if (!isUnix()) return "";
  try {
    return execSync("crontab -l", { encoding: "utf8" });
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`.toLowerCase();
    if (output.includes("no crontab")) return "";
    if (output.includes("not found")) {
      appLogger.warn("crontab command not found. Falling back to node-cron only.");
      return "";
    }
    throw error;
  }
}

function writeSystemCrontab(content) {
  if (!isUnix()) return;
  const result = spawnSync("crontab", ["-"], {
    input: content,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to write crontab");
  }
}

function syncJobToSystemCrontab(job) {
  if (!isUnix()) return;
  const existing = readSystemCrontab();
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.includes(`# Oggo:${job.id}`));

  if (job.enabled) {
    lines.push(`${job.schedule} ${job.command} # Oggo:${job.id}`);
  }
  writeSystemCrontab(lines.join("\n") + "\n");
}

function removeJobFromSystemCrontab(jobId) {
  if (!isUnix()) return;
  const existing = readSystemCrontab();
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.includes(`# Oggo:${jobId}`));
  writeSystemCrontab(lines.join("\n") + (lines.length ? "\n" : ""));
}

async function executeJob(job) {
  const db = getDb();
  const config = loadConfig();
  const start = Date.now();
  const startedAt = new Date().toISOString();

  db.prepare("UPDATE jobs SET last_run = ?, last_status = ? WHERE id = ?").run(
    startedAt,
    "running",
    job.id
  );

  let status = "success";
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    const result = await execAsync(job.command, {
      shell: true,
      windowsHide: true,
      timeout: 5 * 60 * 1000,
    });
    stdout = result.stdout || "";
    stderr = result.stderr || "";
    // stderr output alone does not mean failure; non-zero exit is handled in catch block.
    status = "success";
  } catch (error) {
    status = "failed";
    stdout = error.stdout || "";
    stderr = error.stderr || error.message;
    exitCode = Number.isInteger(error.code) ? error.code : 1;
  }

  const duration = Date.now() - start;
  const log = addLog(
    {
      job_id: job.id,
      job_name: job.name,
      status,
      output: stdout,
      error: stderr,
      duration,
      exit_code: exitCode,
      created_at: startedAt,
    },
    config
  );

  db.prepare("UPDATE jobs SET last_status = ?, updated_at = ? WHERE id = ?").run(
    status,
    new Date().toISOString(),
    job.id
  );

  try {
    await sendJobNotification(job, log, config);
  } catch (emailError) {
    appLogger.error(`Email notification failed for job ${job.id}: ${emailError.message}`);
  }

  return log;
}

function scheduleJob(job, config = loadConfig()) {
  if (!job.enabled) return;
  if (scheduledJobs.has(job.id)) {
    scheduledJobs.get(job.id).stop();
    scheduledJobs.delete(job.id);
  }
  if (!cron.validate(job.schedule)) {
    throw new Error(`Invalid cron expression for job "${job.name}"`);
  }

  const task = cron.schedule(
    job.schedule,
    () => {
      executeJob(job).catch((error) => {
        appLogger.error(`Failed to run job ${job.id}: ${error.message}`);
      });
    },
    { timezone: config.timezone || "UTC" }
  );
  scheduledJobs.set(job.id, task);
}

function unscheduleJob(jobId) {
  if (!scheduledJobs.has(jobId)) return;
  scheduledJobs.get(jobId).stop();
  scheduledJobs.delete(jobId);
}

function reloadAllJobs(config = loadConfig()) {
  for (const task of scheduledJobs.values()) {
    task.stop();
  }
  scheduledJobs.clear();

  const jobs = getDb().prepare("SELECT * FROM jobs WHERE enabled = 1").all();
  jobs.forEach((job) => {
    try {
      scheduleJob(job, config);
    } catch (error) {
      appLogger.error(`Could not schedule job ${job.id}: ${error.message}`);
    }
  });
}

function upsertJobSchedules(job, config = loadConfig()) {
  syncJobToSystemCrontab(job);
  unscheduleJob(job.id);
  if (job.enabled) {
    scheduleJob(job, config);
  }
}

function deleteJobSchedules(jobId) {
  removeJobFromSystemCrontab(jobId);
  unscheduleJob(jobId);
}

async function runJobNow(jobId) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) {
    throw new Error("Job not found.");
  }
  return executeJob(job);
}

function getScheduledCount() {
  return scheduledJobs.size;
}

module.exports = {
  parseSystemCrontab,
  readSystemCrontab,
  syncJobToSystemCrontab,
  removeJobFromSystemCrontab,
  scheduleJob,
  unscheduleJob,
  reloadAllJobs,
  upsertJobSchedules,
  deleteJobSchedules,
  runJobNow,
  getScheduledCount,
};
