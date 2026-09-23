import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  base64UrlEncode,
  SessionUser,
} from "@/lib/auth/session";

describe("Session & Token Utilities", () => {
  const mockUser: Omit<SessionUser, "expiresAt"> = {
    id: "usr_123",
    organizationId: "org_456",
    organizationName: "Test Org",
    email: "test@roxx-crm.local",
    name: "Test User",
    role: "ADMIN",
    permissions: ["lead:create", "lead:read", "lead:update"],
  };

  it("creates and verifies a valid signed session token", async () => {
    const token = await createSessionToken(mockUser);
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(mockUser.id);
    expect(verified?.email).toBe(mockUser.email);
    expect(verified?.role).toBe("ADMIN");
    expect(verified?.permissions).toContain("lead:create");
    expect(verified?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered token signature", async () => {
    const token = await createSessionToken(mockUser);
    const [payload, sig] = token.split(".");

    // Alter the signature
    const tamperedSig = sig.slice(0, -3) + "xyz";
    const tamperedToken = `${payload}.${tamperedSig}`;

    const verified = await verifySessionToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken(mockUser);
    const [, sig] = token.split(".");

    // Alter the payload to try elevating privileges
    const maliciousPayload = base64UrlEncode(
      new TextEncoder().encode(
        JSON.stringify({ ...mockUser, role: "SUPER_ADMIN", expiresAt: Date.now() + 100000 })
      )
    );
    const forgedToken = `${maliciousPayload}.${sig}`;

    const verified = await verifySessionToken(forgedToken);
    expect(verified).toBeNull();
  });

  it("rejects an expired token", async () => {
    // Manually construct token with past timestamp
    const expiredPayload = {
      ...mockUser,
      expiresAt: Date.now() - 10000, // 10 seconds ago
    };
    const jsonBytes = new TextEncoder().encode(JSON.stringify(expiredPayload));
    const encodedPayload = base64UrlEncode(jsonBytes);

    // Sign it with valid key
    const validToken = await createSessionToken(mockUser);
    const [, sig] = validToken.split(".");

    const expiredToken = `${encodedPayload}.${sig}`;
    const verified = await verifySessionToken(expiredToken);
    expect(verified).toBeNull();
  });
});
