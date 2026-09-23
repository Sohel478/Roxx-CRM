import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password Security Utilities", () => {
  it("hashes plain text passwords into valid bcrypt hashes", async () => {
    const plain = "mySecretPassword123";
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("successfully verifies valid passwords", async () => {
    const plain = "testPassword456";
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it("rejects invalid passwords", async () => {
    const plain = "correctPassword";
    const hash = await hashPassword(plain);

    const isInvalid = await verifyPassword("wrongPassword", hash);
    expect(isInvalid).toBe(false);
  });
});
