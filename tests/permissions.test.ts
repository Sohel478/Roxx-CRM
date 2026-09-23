import { describe, it, expect } from "vitest";

describe("Role-Based Access Control (RBAC) Matrix", () => {
  const rolePermissions: Record<string, string[]> = {
    ADMIN: [
      "lead:create", "lead:read", "lead:update", "lead:delete", "lead:assign",
      "company:create", "company:read", "company:update", "company:delete",
      "contact:create", "contact:read", "contact:update", "contact:delete",
      "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
      "task:create", "task:read", "task:update", "task:delete",
      "activity:create", "activity:read", "activity:update",
      "report:view", "report:export",
      "user:create", "user:read", "user:update", "user:delete",
      "settings:read", "settings:update",
    ],
    MANAGER: [
      "lead:create", "lead:read", "lead:update", "lead:delete", "lead:assign",
      "company:create", "company:read", "company:update",
      "contact:create", "contact:read", "contact:update",
      "opportunity:create", "opportunity:read", "opportunity:update",
      "task:create", "task:read", "task:update", "task:delete",
      "activity:create", "activity:read", "activity:update",
      "report:view", "report:export",
      "user:read",
    ],
    SALES_USER: [
      "lead:create", "lead:read", "lead:update",
      "company:create", "company:read",
      "contact:create", "contact:read", "contact:update",
      "opportunity:create", "opportunity:read", "opportunity:update",
      "task:create", "task:read", "task:update",
      "activity:create", "activity:read",
      "report:view",
    ],
    READ_ONLY: [
      "lead:read", "company:read", "contact:read", "opportunity:read",
      "task:read", "activity:read", "report:view",
    ],
  };

  function hasPermission(role: string, permission: string): boolean {
    if (role === "ADMIN") return true;
    return rolePermissions[role]?.includes(permission) ?? false;
  }

  it("grants Admin full permissions across all modules", () => {
    expect(hasPermission("ADMIN", "user:create")).toBe(true);
    expect(hasPermission("ADMIN", "lead:assign")).toBe(true);
    expect(hasPermission("ADMIN", "settings:update")).toBe(true);
  });

  it("permits Manager to assign leads and view team reports but prevents system settings edits", () => {
    expect(hasPermission("MANAGER", "lead:assign")).toBe(true);
    expect(hasPermission("MANAGER", "report:export")).toBe(true);
    expect(hasPermission("MANAGER", "settings:update")).toBe(false);
    expect(hasPermission("MANAGER", "user:delete")).toBe(false);
  });

  it("permits Sales User to manage leads and deals but denies lead assignment and user management", () => {
    expect(hasPermission("SALES_USER", "lead:create")).toBe(true);
    expect(hasPermission("SALES_USER", "opportunity:update")).toBe(true);
    expect(hasPermission("SALES_USER", "lead:assign")).toBe(false);
    expect(hasPermission("SALES_USER", "lead:delete")).toBe(false);
    expect(hasPermission("SALES_USER", "user:create")).toBe(false);
  });

  it("restricts Read Only role to read actions only", () => {
    expect(hasPermission("READ_ONLY", "lead:read")).toBe(true);
    expect(hasPermission("READ_ONLY", "lead:create")).toBe(false);
    expect(hasPermission("READ_ONLY", "opportunity:create")).toBe(false);
  });
});
