const fs = require("fs");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const ping = require("ping");
const { Client } = require("ssh2");
const { v4: uuidv4 } = require("uuid");
const { getDb, getDbEngine, get, run } = require("../db/database");
const { loadConfig } = require("../config/configLoader");

function getEncryptKey() {
  const config = loadConfig();
  return config?.security?.encryptionKey || "oggo-secret-key-change-this";
}

function encrypt(text) {
  if (!text) return "";
  return CryptoJS.AES.encrypt(text, getEncryptKey()).toString();
}

function decrypt(ciphertext) {
  if (!ciphertext) return "";
  const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}

function fingerprintFromHostKey(hostKey) {
  return crypto.createHash("sha256").update(hostKey).digest("base64");
}

async function verifyOrSaveHostFingerprint(server, hostKey) {
  const config = loadConfig();
  if (!config?.security?.verifyHostKeys) return true;
  const fingerprint = fingerprintFromHostKey(hostKey);
  const existing = await get("SELECT * FROM known_hosts WHERE host = ? AND port = ?", [
    server.host,
    server.port || 22,
  ]);

  if (!existing) {
    await run("INSERT INTO known_hosts (id, host, port, fingerprint, added_at) VALUES (?, ?, ?, ?, ?)", [
      uuidv4(),
      server.host,
      server.port || 22,
      fingerprint,
      new Date().toISOString(),
    ]);
    return true;
  }
  return existing.fingerprint === fingerprint;
}

function buildConnectConfig(server) {
  const config = loadConfig();
  const connectConfig = {
    host: server.host,
    port: Number(server.port || 22),
    username: server.username,
    readyTimeout: Number((config?.security?.sshTimeoutSeconds || 10) * 1000),
    keepaliveInterval: Number((config?.security?.sshKeepAliveSeconds || 10) * 1000),
    hostHash: "sha256",
    hostVerifier: (hostKeyHash, callback) => {
      try {
        const port = Number(server.port || 22);
        const saveOrVerify = async () => {
          const existing = await get("SELECT * FROM known_hosts WHERE host = ? AND port = ?", [
            server.host,
            port,
          ]);
          if (!existing) {
            await run("INSERT INTO known_hosts (id, host, port, fingerprint, added_at) VALUES (?, ?, ?, ?, ?)", [
              uuidv4(),
              server.host,
              port,
              hostKeyHash,
              new Date().toISOString(),
            ]);
            callback(true);
            return;
          }
          callback(existing.fingerprint === hostKeyHash);
        };
        saveOrVerify().catch(() => callback(false));
      } catch (_error) {
        callback(false);
      }
    },
  };

  if (server.auth_type === "password") {
    const decryptedPassword = decrypt(server.password);
    connectConfig.password = decryptedPassword || server.password;
  } else if (server.auth_type === "key") {
    if (server.private_key_content) {
      const decryptedKey = decrypt(server.private_key_content);
      connectConfig.privateKey = decryptedKey || server.private_key_content;
    } else if (server.private_key_path) {
      connectConfig.privateKey = fs.readFileSync(server.private_key_path, "utf8");
    }
  } else if (server.auth_type === "key_passphrase") {
    if (server.private_key_content) {
      const decryptedKey = decrypt(server.private_key_content);
      connectConfig.privateKey = decryptedKey || server.private_key_content;
    } else {
      connectConfig.privateKey = fs.readFileSync(server.private_key_path, "utf8");
    }
    const decryptedPassphrase = decrypt(server.passphrase);
    connectConfig.passphrase = decryptedPassphrase || server.passphrase;
  }

  return connectConfig;
}

function parseCrontab(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(
        /^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+?)(?:\s+#\s*oggo ([a-zA-Z0-9-]+))?$/
      );
      if (!match) return null;
      return {
        id: match[3] || uuidv4(),
        schedule: match[1],
        command: match[2],
        enabled: 1,
        source: "remote",
      };
    })
    .filter(Boolean);
}

function executeRemoteCommand(server, command, options = {}) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";
    let errorOutput = "";
    let completed = false;
    const startedAt = Date.now();
    const timeoutMs = Number(options.timeoutMs || 15000);

    const timeout = setTimeout(() => {
      if (completed) return;
      completed = true;
      conn.end();
      reject(new Error("Connection timeout"));
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          reject(err);
          return;
        }

        stream.on("data", (data) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        stream.on("close", (code) => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          conn.end();
          resolve({ output, errorOutput, exitCode: code, durationMs: Date.now() - startedAt });
        });
      });
    });

    conn.on("error", (error) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      reject(error);
    });

    conn.connect(buildConnectConfig(server));
  });
}

async function getRemoteCrontab(server) {
  const result = await executeRemoteCommand(server, "crontab -l");
  if (result.exitCode === 1 || /no crontab/i.test(result.errorOutput || "")) return [];
  return parseCrontab(result.output);
}

async function writeRemoteCrontab(server, jobs) {
  const crontabString = jobs
    .filter((job) => job.enabled)
    .map((job) => `${job.schedule} ${job.command} # Oggo:${job.id}`)
    .join("\n");

  const escaped = crontabString.replace(/"/g, '\\"');
  return executeRemoteCommand(server, `echo "${escaped}" | crontab -`);
}

function testConnection(server) {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.end();
      resolve({ success: false, message: "Connection timed out" });
    }, 10000);

    conn.on("ready", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      conn.end();
      resolve({ success: true, message: "Connection successful" });
    });

    conn.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ success: false, message: err.message });
    });

    conn.connect(buildConnectConfig(server));
  });
}

async function getServerStatus(server) {
  const pingResult = await ping.promise.probe(server.host, { timeout: 3 });
  if (!pingResult.alive) {
    return { online: false, status: "offline", message: "Host unreachable" };
  }
  const tested = await testConnection(server);
  return {
    online: tested.success,
    status: tested.success ? "online" : "offline",
    message: tested.message,
  };
}

function generateKeyPair(type = "rsa") {
  const { generateKeyPairSync } = require("crypto");
  if (type === "ed25519") {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey, publicKey, algorithm: "ED25519" };
  }

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { privateKey, publicKey, algorithm: "RSA" };
}

function sanitizeServer(server) {
  if (!server) return null;
  const copy = { ...server };
  copy.hasPassword = Boolean(copy.password);
  copy.hasPrivateKey = Boolean(copy.private_key_content || copy.private_key_path);
  copy.hasPassphrase = Boolean(copy.passphrase);
  delete copy.password;
  delete copy.private_key_content;
  delete copy.passphrase;
  return copy;
}

module.exports = {
  encrypt,
  decrypt,
  buildConnectConfig,
  parseCrontab,
  executeRemoteCommand,
  getRemoteCrontab,
  writeRemoteCrontab,
  testConnection,
  getServerStatus,
  generateKeyPair,
  sanitizeServer,
  verifyOrSaveHostFingerprint,
};
