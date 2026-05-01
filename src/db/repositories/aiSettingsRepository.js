const { get, run } = require("../database");

const SINGLETON_ID = 1;

/**
 * Get the singleton AI settings row.
 *
 * @returns {Promise<Record<string, any>|null>}
 */
async function getAiSettings() {
  return get("SELECT * FROM ai_settings WHERE id = ?", [SINGLETON_ID]);
}

/**
 * Create or update AI settings row.
 *
 * @param {{
 *  enabled: number,
 *  provider: string,
 *  model: string,
 *  apiKeyEncrypted?: string|null
 * }} payload
 * @returns {Promise<Record<string, any>>}
 */
async function upsertAiSettings(payload) {
  const now = new Date().toISOString();
  const existing = await getAiSettings();
  if (existing) {
    const hasApiKeyUpdate = Object.prototype.hasOwnProperty.call(payload, "apiKeyEncrypted");
    await run(
      `UPDATE ai_settings
       SET enabled = ?, provider = ?, model = ?, api_key = ?, updated_at = ?
       WHERE id = ?`,
      [
        Number(payload.enabled ? 1 : 0),
        String(payload.provider || "nvidia"),
        String(payload.model || ""),
        hasApiKeyUpdate ? payload.apiKeyEncrypted || null : existing.api_key || null,
        now,
        SINGLETON_ID,
      ]
    );
  } else {
    await run(
      `INSERT INTO ai_settings (id, enabled, provider, api_key, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        SINGLETON_ID,
        Number(payload.enabled ? 1 : 0),
        String(payload.provider || "nvidia"),
        payload.apiKeyEncrypted || null,
        String(payload.model || ""),
        now,
        now,
      ]
    );
  }
  return (await getAiSettings()) || {};
}

/**
 * Remove encrypted API key while preserving toggle/model choice.
 *
 * @returns {Promise<Record<string, any>>}
 */
async function clearApiKey() {
  const existing = await getAiSettings();
  const now = new Date().toISOString();
  if (existing) {
    await run("UPDATE ai_settings SET api_key = NULL, updated_at = ? WHERE id = ?", [now, SINGLETON_ID]);
  } else {
    await run(
      `INSERT INTO ai_settings (id, enabled, provider, api_key, model, created_at, updated_at)
       VALUES (?, 0, 'nvidia', NULL, '', ?, ?)`,
      [SINGLETON_ID, now, now]
    );
  }
  return (await getAiSettings()) || {};
}

module.exports = {
  getAiSettings,
  upsertAiSettings,
  clearApiKey,
};
