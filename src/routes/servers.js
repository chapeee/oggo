const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { get, all, run } = require("../db/database");
const {
  encrypt,
  sanitizeServer,
  testConnection,
  getServerStatus,
  getRemoteCrontab,
  writeRemoteCrontab,
  executeRemoteCommand,
} = require("../services/sshService");
const { linkService, getLinkedServices, unlinkService } = require("../services/vaultService");

const router = express.Router();

function mapServerPayload(body, existing = null) {
  const now = new Date().toISOString();
  const out = {
    id: existing?.id || uuidv4(),
    name: String(body.name || existing?.name || "").trim(),
    host: String(body.host || existing?.host || "").trim(),
    port: Number(body.port || existing?.port || 22),
    username: String(body.username || existing?.username || "").trim(),
    auth_type: body.auth_type || existing?.auth_type || "password",
    private_key_path: body.private_key_path ?? existing?.private_key_path ?? "",
    color: body.color ?? existing?.color ?? "#4f46e5",
    tags: body.tags ?? existing?.tags ?? "",
    notes: body.notes ?? existing?.notes ?? "",
    vault_entry_id: body.vault_entry_id ?? existing?.vault_entry_id ?? null,
    last_connected: existing?.last_connected || null,
    last_status: existing?.last_status || "unknown",
    created_at: existing?.created_at || now,
    sort_order: Number(body.sort_order ?? existing?.sort_order ?? 0),
  };

  const passwordInput = typeof body.password === "string" ? body.password.trim() : "";
  if (passwordInput) out.password = encrypt(passwordInput);
  else out.password = existing?.password || "";

  const keyContentInput = typeof body.private_key_content === "string" ? body.private_key_content.trim() : "";
  if (keyContentInput) out.private_key_content = encrypt(keyContentInput);
  else out.private_key_content = existing?.private_key_content || "";

  const passphraseInput = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  if (passphraseInput) out.passphrase = encrypt(passphraseInput);
  else out.passphrase = existing?.passphrase || "";

  return out;
}

/**
 * Synchronize vault links for SSH password field.
 *
 * @param {string} serverId
 * @param {string|null} previousVaultEntryId
 * @param {string|null} nextVaultEntryId
 * @returns {Promise<void>}
 */
async function syncServerVaultLink(serverId, previousVaultEntryId, nextVaultEntryId) {
  const oldId = previousVaultEntryId ? String(previousVaultEntryId) : "";
  const newId = nextVaultEntryId ? String(nextVaultEntryId) : "";
  if (oldId && oldId !== newId) {
    const links = await getLinkedServices(oldId);
    const target = links.find(
      (link) => link.service_type === "ssh_server" && link.service_id === serverId && link.field_name === "password"
    );
    if (target) await unlinkService(target.id);
  }
  if (newId) {
    await linkService(newId, "ssh_server", serverId, "password");
  }
}

router.get("/", async (req, res) => {
  const rows = await all("SELECT * FROM servers ORDER BY sort_order ASC, created_at DESC");
  res.json({ data: rows.map(sanitizeServer) });
});

router.post("/", async (req, res) => {
  const payload = mapServerPayload(req.body || {});
  if (!payload.name || !payload.host || !payload.username) {
    return res.status(400).json({ error: "name, host and username are required", code: "VALIDATION_ERROR" });
  }
  if (payload.auth_type === "password" && !payload.password && !payload.vault_entry_id) {
    return res.status(400).json({ error: "Password auth requires password", code: "VALIDATION_ERROR" });
  }
  if ((payload.auth_type === "key" || payload.auth_type === "key_passphrase") && !payload.private_key_path && !payload.private_key_content) {
    return res.status(400).json({ error: "Key auth requires private key path or pasted key", code: "VALIDATION_ERROR" });
  }

  await run(`
      INSERT INTO servers (
        id, name, host, port, username, auth_type, password, private_key_path, private_key_content,
        passphrase, color, tags, notes, vault_entry_id, last_connected, last_status, created_at, sort_order
      ) VALUES (
        @id, @name, @host, @port, @username, @auth_type, @password, @private_key_path, @private_key_content,
        @passphrase, @color, @tags, @notes, @vault_entry_id, @last_connected, @last_status, @created_at, @sort_order
      )
    `, payload);
  await syncServerVaultLink(payload.id, null, payload.vault_entry_id || null);

  res.status(201).json({ data: sanitizeServer(payload) });
});

router.put("/:id", async (req, res) => {
  const existing = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const payload = mapServerPayload(req.body || {}, existing);
  if (payload.auth_type === "password" && !payload.password && !payload.vault_entry_id) {
    return res.status(400).json({ error: "Password auth requires password", code: "VALIDATION_ERROR" });
  }
  if ((payload.auth_type === "key" || payload.auth_type === "key_passphrase") && !payload.private_key_path && !payload.private_key_content) {
    return res.status(400).json({ error: "Key auth requires private key path or pasted key", code: "VALIDATION_ERROR" });
  }

  await run(`
      UPDATE servers SET
        name=@name, host=@host, port=@port, username=@username, auth_type=@auth_type, password=@password,
        private_key_path=@private_key_path, private_key_content=@private_key_content, passphrase=@passphrase,
        color=@color, tags=@tags, notes=@notes, vault_entry_id=@vault_entry_id, last_connected=@last_connected, last_status=@last_status,
        sort_order=@sort_order
      WHERE id=@id
    `, payload);
  await syncServerVaultLink(payload.id, existing.vault_entry_id || null, payload.vault_entry_id || null);

  res.json({ data: sanitizeServer(payload) });
});

router.delete("/:id", async (req, res) => {
  const existing = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (existing?.vault_entry_id) {
    const links = await getLinkedServices(existing.vault_entry_id);
    const target = links.find(
      (link) => link.service_type === "ssh_server" && link.service_id === req.params.id && link.field_name === "password"
    );
    if (target) await unlinkService(target.id);
  }
  await run("DELETE FROM servers WHERE id = ?", [req.params.id]);
  await run("DELETE FROM server_jobs WHERE server_id = ?", [req.params.id]);
  res.json({ message: "Server deleted" });
});

router.post("/:id/test", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const result = await testConnection(server);
  if (result.success) {
    await run("UPDATE servers SET last_connected = ?, last_status = ? WHERE id = ?", [new Date().toISOString(), "online", server.id]);
  }
  res.json({ data: result });
});

router.get("/:id/status", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const status = await getServerStatus(server);
  await run("UPDATE servers SET last_status = ? WHERE id = ?", [status.status, server.id]);
  res.json({ data: status });
});

router.get("/:id/jobs", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const jobs = await getRemoteCrontab(server);
  res.json({ data: jobs });
});

router.post("/:id/jobs", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const existing = await getRemoteCrontab(server);
  const job = {
    id: uuidv4(),
    schedule: req.body.schedule,
    command: req.body.command,
    enabled: req.body.enabled !== false,
  };
  await writeRemoteCrontab(server, [...existing, job]);
  res.status(201).json({ data: job });
});

router.put("/:id/jobs/:jobId", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const jobs = await getRemoteCrontab(server);
  const updatedJobs = jobs.map((j) => (j.id === req.params.jobId ? { ...j, ...req.body } : j));
  await writeRemoteCrontab(server, updatedJobs);
  res.json({ data: updatedJobs.find((j) => j.id === req.params.jobId) });
});

router.delete("/:id/jobs/:jobId", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const jobs = await getRemoteCrontab(server);
  await writeRemoteCrontab(server, jobs.filter((j) => j.id !== req.params.jobId));
  res.json({ message: "Remote job deleted" });
});

router.post("/:id/jobs/:jobId/toggle", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const jobs = await getRemoteCrontab(server);
  const updatedJobs = jobs.map((j) => (j.id === req.params.jobId ? { ...j, enabled: !j.enabled } : j));
  await writeRemoteCrontab(server, updatedJobs);
  res.json({ data: updatedJobs.find((j) => j.id === req.params.jobId) });
});

router.post("/:id/jobs/:jobId/run", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const jobs = await getRemoteCrontab(server);
  const job = jobs.find((j) => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Remote job not found", code: "NOT_FOUND" });
  const result = await executeRemoteCommand(server, job.command);
  res.json({ data: result });
});

router.post("/:id/connect", async (req, res) => {
  const server = await get("SELECT * FROM servers WHERE id = ?", [req.params.id]);
  if (!server) return res.status(404).json({ error: "Server not found", code: "NOT_FOUND" });
  const result = await testConnection(server);
  res.json({ data: result });
});

router.post("/:id/disconnect", (req, res) => {
  res.json({ data: { success: true, message: "Disconnected" } });
});

module.exports = router;
