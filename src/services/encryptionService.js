/**
 * encryptionService.js
 *
 * Central encryption/decryption helper for sensitive values.
 */
const { encrypt, decrypt } = require("./sshService");

/**
 * Encrypt a plaintext value.
 *
 * @param {string} value
 * @returns {string}
 */
function encryptValue(value) {
  return encrypt(String(value || ""));
}

/**
 * Decrypt an encrypted value.
 *
 * @param {string} value
 * @returns {string}
 */
function decryptValue(value) {
  return decrypt(String(value || ""));
}

module.exports = {
  encryptValue,
  decryptValue,
};

