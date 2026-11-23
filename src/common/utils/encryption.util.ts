import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'wp-automation-storage-salt';

/**
 * Derives a 32-byte key from a secret string.
 */
function deriveKey(secret?: string): Buffer {
  const masterKey = secret || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-wp-automation-encryption-key-32';
  return crypto.scryptSync(masterKey, SALT, 32);
}

/**
 * Encrypts a plain text string using AES-256-GCM.
 * Output format: iv:authTag:encryptedHex
 */
export function encryptText(text: string, secret?: string): string {
  if (!text) return text;
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: iv:authTag:encryptedHex
 */
export function decryptText(encryptedText: string, secret?: string): string {
  if (!encryptedText) return encryptedText;

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // If not in encrypted format (e.g. legacy plain text), return as-is
    return encryptedText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
