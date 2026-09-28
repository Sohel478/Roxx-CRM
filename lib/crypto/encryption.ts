import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "roxx-crm-default-smtp-secret-key-32b!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns formatted string: `${ivHex}:${authTagHex}:${encryptedHex}`
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM formatted string.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";

  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
      // In case string was not encrypted or legacy plain
      return cipherText;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt secret:", error);
    return "";
  }
}

/**
 * Returns a masked representation of a secret
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return "";
  return "••••••••••••";
}
