"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  SessionUser,
} from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export interface AuthState {
  success: boolean;
  error?: string;
}

// Built-in demo accounts to allow immediate local testing before Neon DB connection is configured
const DEMO_FALLBACK_USERS: Record<
  string,
  {
    name: string;
    role: string;
    permissions: string[];
  }
> = {
  "admin@roxx-crm.local": {
    name: "Admin User",
    role: "ADMIN",
    permissions: [
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
  },
  "manager@roxx-crm.local": {
    name: "Sarah Manager",
    role: "MANAGER",
    permissions: [
      "lead:create", "lead:read", "lead:update", "lead:delete", "lead:assign",
      "company:create", "company:read", "company:update",
      "contact:create", "contact:read", "contact:update",
      "opportunity:create", "opportunity:read", "opportunity:update",
      "task:create", "task:read", "task:update", "task:delete",
      "activity:create", "activity:read", "activity:update",
      "report:view", "report:export",
      "user:read",
    ],
  },
  "sales@roxx-crm.local": {
    name: "Alex Sales",
    role: "SALES_USER",
    permissions: [
      "lead:create", "lead:read", "lead:update",
      "company:create", "company:read",
      "contact:create", "contact:read", "contact:update",
      "opportunity:create", "opportunity:read", "opportunity:update",
      "task:create", "task:read", "task:update",
      "activity:create", "activity:read",
      "report:view",
    ],
  },
};

export async function loginAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid credentials format",
    };
  }

  const { email, password } = parsed.data;

  try {
    // Attempt database authentication first
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "This account has been deactivated" };
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return { success: false, error: "Invalid email or password" };
      }

      const permissions = user.role.permissions.map((rp) => rp.permission.key);

      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions,
      };

      const token = await createSessionToken(sessionUser);
      await setSessionCookie(token);

      // Record audit event
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
            newValues: { email: user.email, role: user.role.name },
          },
        });
      } catch {
        // Audit failures should not crash login
      }
    } else {
      // Check demo fallback users for local development
      const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
      if (demoUser && password === "password123") {
        const sessionUser: Omit<SessionUser, "expiresAt"> = {
          id: `demo-user-${demoUser.role.toLowerCase()}`,
          organizationId: "demo-org-123",
          organizationName: "Demo Company",
          email,
          name: demoUser.name,
          role: demoUser.role,
          permissions: demoUser.permissions,
        };

        const token = await createSessionToken(sessionUser);
        await setSessionCookie(token);
      } else {
        return { success: false, error: "Invalid email or password" };
      }
    }
  } catch (err: unknown) {
    // Database connection issue fallback to demo accounts
    const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
    if (demoUser && password === "password123") {
      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: `demo-user-${demoUser.role.toLowerCase()}`,
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email,
        name: demoUser.name,
        role: demoUser.role,
        permissions: demoUser.permissions,
      };

      const token = await createSessionToken(sessionUser);
      await setSessionCookie(token);
    } else {
      return {
        success: false,
        error: "Invalid email or password. Use password: password123 for demo accounts.",
      };
    }
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "USER_LOGOUT",
          entityType: "User",
          entityId: session.id,
        },
      });
    } catch {
      // Ignore DB audit error on logout
    }
  }

  await clearSessionCookie();
  redirect("/login");
}
