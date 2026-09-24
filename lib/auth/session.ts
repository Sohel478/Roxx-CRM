import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE_NAME = "roxx_crm_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  expiresAt: number;
}

const DEFAULT_SECRET = "roxx-crm-default-development-secret-key-at-least-32-chars";

function getSecretKey(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

// Convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to string
function uint8ArrayToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Base64Url Encode
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Base64Url Decode
export function base64UrlDecode(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HMAC-SHA256 signature using Web Crypto API (supported in Edge and Node.js)
async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToUint8Array(data) as BufferSource
  );
  return base64UrlEncode(signature);
}

/**
 * Generate a cryptographically signed session token.
 */
export async function createSessionToken(user: Omit<SessionUser, "expiresAt">): Promise<string> {
  try {
    const payload: SessionUser = {
      ...user,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    };
    const json = JSON.stringify(payload);
    const encodedPayload = base64UrlEncode(stringToUint8Array(json));
    const signature = await sign(encodedPayload, getSecretKey());
    return `${encodedPayload}.${signature}`;
  } catch (err) {
    console.error("Failed to create session token:", err);
    throw new Error("Failed to create session token");
  }
}

/**
 * Verify and decode a session token. Returns null if expired or signature invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    if (!encodedPayload || !signature) return null;

    const expectedSignature = await sign(encodedPayload, getSecretKey());

    if (!expectedSignature || signature !== expectedSignature) {
      return null; // Tampered or invalid signature
    }

    const jsonBytes = base64UrlDecode(encodedPayload);
    const jsonStr = uint8ArrayToString(jsonBytes);
    const payload: SessionUser = JSON.parse(jsonStr);

    if (!payload || !payload.id || !payload.organizationId) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null; // Session expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Server-side helper to write the session cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
  } catch {
    // Ignore cookie write errors if called after response sent
  }
}

/**
 * Server-side helper to delete the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore cookie delete errors if called after response sent
  }
}

/**
 * Get the currently authenticated user from cookies.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Enforce authentication in Server Components or Server Actions.
 * Redirects to /login if unauthenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Enforce specific permission in Server Actions.
 * Throws an error or returns session if authorized.
 */
export async function requirePermission(permissionKey: string): Promise<SessionUser> {
  const session = await requireAuth();

  // Admin role automatically possesses all permissions
  if (session.role === "ADMIN") {
    return session;
  }

  if (!session.permissions.includes(permissionKey)) {
    throw new Error(`Unauthorized: Missing required permission [${permissionKey}]`);
  }

  return session;
}
