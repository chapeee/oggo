const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { all, run } = require("../db/database");
const { generateKeyPair, encrypt } = require("../services/sshService");

const router = express.Router();

router.get("/", async (req, res) => {
  const keys = (await all("SELECT id, name, algorithm, public_key, created_at FROM ssh_keys ORDER BY created_at DESC"))
    .map((key) => ({
      ...key,
      fingerprint: (key.public_key || "").slice(-16),
    }));
  res.json({ data: keys });
});

router.post("/", async (req, res) => {
  const now = new Date().toISOString();
  const payload = {
    id: uuidv4(),
    name: req.body.name || `Key ${new Date().toLocaleDateString()}`,
    algorithm: req.body.algorithm || "RSA",
    public_key: req.body.publicKey || "",
    private_key_encrypted: encrypt(req.body.privateKey || ""),
    created_at: now,
  };
  if (!payload.public_key || !req.body.privateKey) {
    return res.status(400).json({ error: "publicKey and privateKey are required", code: "VALIDATION_ERROR" });
  }
  await run(
    "INSERT INTO ssh_keys (id, name, algorithm, public_key, private_key_encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [payload.id, payload.name, payload.algorithm, payload.public_key, payload.private_key_encrypted, payload.created_at]
  );
  res.status(201).json({ data: { id: payload.id, name: payload.name, algorithm: payload.algorithm, public_key: payload.public_key } });
});

router.delete("/:id", async (req, res) => {
  await run("DELETE FROM ssh_keys WHERE id = ?", [req.params.id]);
  res.json({ message: "Key deleted" });
});

router.post("/generate", (req, res) => {
  const type = req.body.type === "ed25519" ? "ed25519" : "rsa";
  const generated = generateKeyPair(type);
  res.json({ data: generated });
});

module.exports = router;
