const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");
const { getoggoDataDir } = require("./platformService");
const { getAiSettings, upsertAiSettings, clearApiKey } = require("../db/repositories/aiSettingsRepository");
const { executeGuiCommand, getSession } = require("./terminalSessionManager");

const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";
const MODEL_OPTIONS = [
  { id: "meta/llama-3.1-70b-instruct", label: "Meta Llama 3.1 70B Instruct" },
  { id: "meta/llama-3.1-8b-instruct", label: "Meta Llama 3.1 8B Instruct" },
  { id: "mistralai/mixtral-8x7b-instruct-v0.1", label: "Mixtral 8x7B Instruct" },
  { id: "qwen/qwen2.5-72b-instruct", label: "Qwen 2.5 72B Instruct" },
];
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const SESSION_CONTEXT_CACHE = new Map();

/**
 * Resolve secret seed from OS keychain where available; fall back to machine-bound file secret.
 *
 * @returns {Promise<string>}
 */
async function resolveSecretSeed() {
  try {
    // Optional dependency: if keytar is available, use OS keychain.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const keytar = require("keytar");
    const service = "cronix.ai.assistant";
    const account = `${os.hostname()}:${os.userInfo().username}`;
    let value = await keytar.getPassword(service, account);
    if (!value) {
      value = crypto.randomBytes(32).toString("hex");
      await keytar.setPassword(service, account, value);
    }
    return value;
  } catch (_error) {
    // Fallback path intentionally silent to avoid key material leakage.
  }

  const secretDir = getoggoDataDir();
  const secretFile = path.join(secretDir, ".ai-machine-secret");
  await fs.ensureDir(secretDir);
  if (!(await fs.pathExists(secretFile))) {
    await fs.writeFile(secretFile, crypto.randomBytes(32).toString("hex"), { encoding: "utf8" });
  }
  return String(await fs.readFile(secretFile, "utf8")).trim();
}

/**
 * Derive stable encryption key for this machine/user.
 *
 * @returns {Promise<Buffer>}
 */
async function deriveEncryptionKey() {
  const seed = await resolveSecretSeed();
  const machineSalt = `${os.platform()}|${os.arch()}|${os.hostname()}|${os.userInfo().username}`;
  return crypto.scryptSync(`${seed}|${machineSalt}`, "cronix-ai-settings", 32);
}

/**
 * Encrypt a sensitive value using AES-256-GCM.
 *
 * @param {string} value
 * @returns {Promise<string>}
 */
async function encryptSecret(value) {
  const key = await deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypt an encrypted sensitive value.
 *
 * @param {string} payload
 * @returns {Promise<string>}
 */
async function decryptSecret(payload) {
  if (!payload) return "";
  const [ivB64, tagB64, dataB64] = String(payload).split(".");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  const key = await deriveEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

/**
 * Serialize settings for UI without leaking key.
 *
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>}
 */
function toPublicSettings(row) {
  return {
    enabled: Boolean(row?.enabled),
    provider: String(row?.provider || "nvidia"),
    model: String(row?.model || DEFAULT_MODEL),
    hasApiKey: Boolean(row?.api_key),
    models: MODEL_OPTIONS,
  };
}

/**
 * Parse context marker output from remote probe script.
 *
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
function parseContextMarker(text) {
  const markerLine = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("__CRONIX_AI_CTX__"));
  if (!markerLine) return null;
  const payload = markerLine.replace("__CRONIX_AI_CTX__", "");
  const [osFamily, distro, version, shell, arch, sudoAvailable, pkgManager] = payload.split("|");
  return {
    osFamily: osFamily || "Linux",
    distro: distro || "Unknown",
    version: version || "",
    shell: shell || "sh",
    arch: arch || "x86_64",
    sudoAvailable: sudoAvailable || "no",
    pkgManager: pkgManager || "unknown",
  };
}

/**
 * Build remote context detection command.
 *
 * @returns {string}
 */
function getContextProbeCommand() {
  // Keep bash `${...}` variables escaped (`\${...}`) because this command itself
  // is assembled inside a JavaScript template literal.
  return `sh -lc 'OS="$(uname -s 2>/dev/null || echo Linux)"; ARCH="$(uname -m 2>/dev/null || echo x86_64)"; SHELL_NAME="$(basename "\${SHELL:-sh}")"; DISTRO="Unknown"; VERSION=""; if [ -f /etc/os-release ]; then . /etc/os-release; DISTRO="\${NAME:-\$ID}"; VERSION="\${VERSION_ID:-}"; fi; if [ "$(id -u 2>/dev/null || echo 1)" = "0" ]; then SUDO_OK="yes"; elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then SUDO_OK="yes"; else SUDO_OK="no"; fi; PKG="unknown"; for c in apt dnf yum pacman apk brew zypper; do if command -v "$c" >/dev/null 2>&1; then PKG="$c"; break; fi; done; printf "__CRONIX_AI_CTX__%s\\n" "$OS|$DISTRO|$VERSION|$SHELL_NAME|$ARCH|$SUDO_OK|$PKG"'`;
}

/**
 * Resolve and cache terminal server context for the active SSH session.
 *
 * @param {string} sessionId
 * @returns {Promise<Record<string, string>>}
 */
async function resolveSessionContext(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.closed) {
    throw new Error("SSH session not active");
  }
  if (SESSION_CONTEXT_CACHE.has(sessionId)) {
    return SESSION_CONTEXT_CACHE.get(sessionId);
  }

  const probe = await executeGuiCommand(sessionId, getContextProbeCommand(), { timeoutMs: 12000, silent: true });
  const parsed = parseContextMarker(`${probe.output || ""}\n${probe.errorOutput || ""}`) || {
    osFamily: "Linux",
    distro: "Unknown",
    version: "",
    shell: "sh",
    arch: "x86_64",
    sudoAvailable: "no",
    pkgManager: "unknown",
  };
  SESSION_CONTEXT_CACHE.set(sessionId, parsed);
  return parsed;
}

/**
 * Build strict system prompt for shell command generation.
 *
 * @param {Record<string, string>} ctx
 * @returns {string}
 */
function buildSystemPrompt(ctx) {
  return `You are a shell command generator. The user is connected via SSH to a ${ctx.osFamily} ${ctx.distro} ${ctx.version} system running ${ctx.shell} on ${ctx.arch}. Sudo available: ${ctx.sudoAvailable}. Package manager: ${ctx.pkgManager}.

Respond with exactly ONE shell command that fulfills the user's request. Output rules:
1. Only the command, nothing else.
2. No explanation, no comments, no markdown, no backticks, no quotes around the command.
3. Prefer the native package manager and the most idiomatic tool for this distro.
4. If sudo is needed and available, include it.
5. If the request is ambiguous, pick the most common interpretation for this OS.`;
}

/**
 * Convert LLM output into a single executable command line.
 *
 * @param {string} raw
 * @returns {string}
 */
function sanitizeCommand(raw) {
  const normalized = String(raw || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/`/g, "")
    .trim();
  const firstLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
  return firstLine.replace(/^\$\s*/, "").replace(/^command:\s*/i, "").trim();
}

/**
 * Run NVIDIA chat completion and return one shell command.
 *
 * @param {{
 *  apiKey: string,
 *  model: string,
 *  prompt: string,
 *  ctx: Record<string, string>
 * }} payload
 * @returns {Promise<string>}
 */
async function requestNvidiaCommand(payload) {
  const response = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model || DEFAULT_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(payload.ctx) },
        { role: "user", content: String(payload.prompt || "") },
      ],
      temperature: 0.15,
      max_tokens: 200,
      stream: false,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(body?.error?.message || body?.error || `NVIDIA API error (${response.status})`);
    throw new Error(message);
  }
  const content = String(body?.choices?.[0]?.message?.content || "");
  const command = sanitizeCommand(content);
  if (!command) {
    throw new Error("AI returned an empty command");
  }
  return command;
}

/**
 * Get AI assistant settings for frontend.
 *
 * @returns {Promise<Record<string, any>>}
 */
async function getAssistantSettings() {
  const row = await getAiSettings();
  return toPublicSettings(row);
}

/**
 * Save assistant settings and optionally validate API key.
 *
 * @param {{ enabled?: boolean, model?: string, apiKey?: string, validate?: boolean }} input
 * @returns {Promise<Record<string, any>>}
 */
async function saveAssistantSettings(input = {}) {
  const current = await getAiSettings();
  const nextEnabled = Object.prototype.hasOwnProperty.call(input, "enabled")
    ? Boolean(input.enabled)
    : Boolean(current?.enabled);
  const nextModel = String(input.model || current?.model || DEFAULT_MODEL);
  const apiKeyPlain = String(input.apiKey || "").trim();

  if (input.validate && apiKeyPlain) {
    await requestNvidiaCommand({
      apiKey: apiKeyPlain,
      model: nextModel,
      prompt: "show command to print hello",
      ctx: {
        osFamily: "Linux",
        distro: "Ubuntu",
        version: "22.04",
        shell: "bash",
        arch: "x86_64",
        sudoAvailable: "yes",
        pkgManager: "apt",
      },
    });
  }

  const payload = {
    enabled: nextEnabled ? 1 : 0,
    provider: "nvidia",
    model: nextModel,
  };
  if (apiKeyPlain) {
    payload.apiKeyEncrypted = await encryptSecret(apiKeyPlain);
  }
  const row = await upsertAiSettings(payload);
  return toPublicSettings(row);
}

/**
 * Verify saved credentials can call NVIDIA API.
 *
 * @returns {Promise<{ok: boolean}>}
 */
async function testAssistantConnection() {
  const row = await getAiSettings();
  if (!row?.api_key) {
    throw new Error("NVIDIA API key not set");
  }
  const apiKey = await decryptSecret(String(row.api_key));
  await requestNvidiaCommand({
    apiKey,
    model: String(row.model || DEFAULT_MODEL),
    prompt: "show command to print test",
    ctx: {
      osFamily: "Linux",
      distro: "Ubuntu",
      version: "22.04",
      shell: "bash",
      arch: "x86_64",
      sudoAvailable: "yes",
      pkgManager: "apt",
    },
  });
  return { ok: true };
}

/**
 * Forget API key while preserving user toggle/model values.
 *
 * @returns {Promise<Record<string, any>>}
 */
async function forgetAssistantKey() {
  const row = await clearApiKey();
  return toPublicSettings(row);
}

/**
 * Generate one command for a dia-ai user prompt.
 *
 * @param {{ sessionId: string, prompt: string }} input
 * @returns {Promise<{command: string, context: Record<string, string>}>}
 */
async function generateAssistantCommand(input) {
  const settings = await getAiSettings();
  if (!settings || !settings.enabled) {
    throw new Error("AI assistant is disabled");
  }
  if (!settings.api_key) {
    throw new Error("NVIDIA API key is missing");
  }
  const prompt = String(input.prompt || "").trim().slice(0, 1000);
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const apiKey = await decryptSecret(String(settings.api_key));
  const context = await resolveSessionContext(String(input.sessionId || ""));
  const command = await requestNvidiaCommand({
    apiKey,
    model: String(settings.model || DEFAULT_MODEL),
    prompt,
    ctx: context,
  });
  return { command, context };
}

module.exports = {
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  getAssistantSettings,
  saveAssistantSettings,
  testAssistantConnection,
  forgetAssistantKey,
  generateAssistantCommand,
};
