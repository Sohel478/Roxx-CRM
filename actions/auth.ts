"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  SessionUser,
} from "@/lib/auth/session";
import {
  mockOrganizationsStore,
  mockUsersStore,
} from "@/lib/db/mock-store";
import { ensureDatabaseSchema } from "@/lib/db/migrate";

const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please provide a valid work email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

export const ALL_ADMIN_PERMISSIONS = [
  "lead:create", "lead:read", "lead:update", "lead:delete", "lead:assign",
  "company:create", "company:read", "company:update", "company:delete",
  "contact:create", "contact:read", "contact:update", "contact:delete",
  "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
  "task:create", "task:read", "task:update", "task:delete",
  "activity:create", "activity:read", "activity:update",
  "report:view", "report:export",
  "user:create", "user:read", "user:update", "user:delete",
  "settings:read", "settings:update",
];

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
      "company:create", "company:read", "company:update", "company:delete",
      "contact:create", "contact:read", "contact:update", "contact:delete",
      "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
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
      "lead:create", "lead:read", "lead:update", "lead:delete",
      "company:create", "company:read", "company:update", "company:delete",
      "contact:create", "contact:read", "contact:update", "contact:delete",
      "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
      "task:create", "task:read", "task:update", "task:delete",
      "activity:create", "activity:read", "activity:update",
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

  // Auto-migrate database schema if needed (self-healing)
  await ensureDatabaseSchema();

  try {
    // Attempt database authentication first
    let user: any = null;
    try {
      user = await prisma.user.findUnique({
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
    } catch (dbErr) {
      console.warn("[loginAction] Database user lookup failed (using fallback if applicable):", dbErr);
    }

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "This account has been deactivated" };
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return { success: false, error: "Invalid email or password" };
      }

      const permissions: string[] = Array.isArray(user.role?.permissions)
        ? user.role.permissions
            .map((rp: any) => rp?.permission?.key)
            .filter((k: any): k is string => Boolean(k))
        : ALL_ADMIN_PERMISSIONS;

      const roleName = user.role?.name || "ADMIN";
      const organizationName = user.organization?.name || "Demo Company";
      const subscriptionPlan = user.organization?.subscriptionPlan || "FREE_TRIAL";
      const subscriptionStatus = user.organization?.subscriptionStatus || "TRIAL";
      const maxSeats = typeof user.organization?.maxSeats === "number" ? user.organization.maxSeats : 20;

      let trialEndsAt: string | null = null;
      if (user.organization?.trialEndsAt) {
        try {
          trialEndsAt = new Date(user.organization.trialEndsAt).toISOString();
        } catch {}
      }

      let subscriptionEndsAt: string | null = null;
      if (user.organization?.subscriptionEndsAt) {
        try {
          subscriptionEndsAt = new Date(user.organization.subscriptionEndsAt).toISOString();
        } catch {}
      }

      const isSuperAdmin = Boolean(
        user.isSuperAdmin || email.toLowerCase() === "admin@roxx-crm.local"
      );

      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: user.id,
        organizationId: user.organizationId,
        organizationName,
        email: user.email,
        name: user.name || "User",
        role: roleName,
        permissions: permissions.length > 0 ? permissions : ALL_ADMIN_PERMISSIONS,
        isSuperAdmin,
        subscriptionPlan,
        subscriptionStatus,
        maxSeats,
        trialEndsAt,
        subscriptionEndsAt,
      };

      const token = await createSessionToken(sessionUser);
      await setSessionCookie(token);

      // Record audit event safely
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
            newValues: { email: user.email, role: roleName },
          },
        });
      } catch {
        // Audit failures should not crash login
      }
    } else {
      // Check demo fallback users for local development
      const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
      if (demoUser && password === "password123") {
        const isSuperAdmin = email.toLowerCase() === "admin@roxx-crm.local";
        const sessionUser: Omit<SessionUser, "expiresAt"> = {
          id: `demo-user-${demoUser.role.toLowerCase()}`,
          organizationId: "demo-org-123",
          organizationName: "Demo Company",
          email,
          name: demoUser.name,
          role: demoUser.role,
          permissions: demoUser.permissions,
          isSuperAdmin,
          subscriptionPlan: "FREE_TRIAL",
          subscriptionStatus: "TRIAL",
          maxSeats: 20,
          trialEndsAt: new Date(Date.now() + 24 * 86400000).toISOString(),
        };

        const token = await createSessionToken(sessionUser);
        await setSessionCookie(token);
      } else {
        return { success: false, error: "Invalid email or password" };
      }
    }
  } catch (err: unknown) {
    if ((err as any)?.digest?.includes?.("NEXT_REDIRECT") || (err as any)?.message === "NEXT_REDIRECT") {
      throw err;
    }
    console.error("[loginAction] Unexpected error:", err);
    // Database connection issue fallback to demo accounts
    const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
    if (demoUser && password === "password123") {
      const isSuperAdmin = email.toLowerCase() === "admin@roxx-crm.local";
      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: `demo-user-${demoUser.role.toLowerCase()}`,
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email,
        name: demoUser.name,
        role: demoUser.role,
        permissions: demoUser.permissions,
        isSuperAdmin,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionStatus: "TRIAL",
        maxSeats: 20,
        trialEndsAt: new Date(Date.now() + 24 * 86400000).toISOString(),
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

export async function registerOrganizationAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid registration data",
    };
  }

  const { companyName, name, email, password, phone } = parsed.data;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);
  const now = new Date();

  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const slug = `${slugBase || "company"}-${randomSuffix}`;

  await ensureDatabaseSchema();

  try {
    // Check if user email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        success: false,
        error: "An account with this email address already exists. Please sign in.",
      };
    }

    const passwordHash = await hashPassword(password);

    // 1. Create Organization with 30-day Free Trial & 20 seats
    const org = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionStatus: "TRIAL",
        maxSeats: 20,
        trialEndsAt,
        billingEmail: email,
        billingPhone: (phone as string) || null,
        subscriptionNotes: "Self-serve registered. 30-Day Free Trial (20 Seats)",
      },
    });

    // 2. Create Roles for the new organization
    const adminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: "ADMIN",
        description: "Full administrative access to all CRM resources and settings",
      },
    });

    await prisma.role.createMany({
      data: [
        {
          organizationId: org.id,
          name: "MANAGER",
          description: "Can view and manage team records, assign leads, and inspect reports",
        },
        {
          organizationId: org.id,
          name: "SALES_USER",
          description: "Manages assigned leads, contacts, opportunities, and activities",
        },
        {
          organizationId: org.id,
          name: "READ_ONLY",
          description: "Read-only inspection of CRM data",
        },
      ],
    });

    // 3. Create default sales pipeline with stages
    await prisma.pipeline.create({
      data: {
        organizationId: org.id,
        name: "Standard Sales Pipeline",
        isDefault: true,
        stages: {
          create: [
            { name: "Discovery", order: 1, probability: 10, color: "#6366f1" },
            { name: "Qualification", order: 2, probability: 30, color: "#3b82f6" },
            { name: "Proposal", order: 3, probability: 60, color: "#eab308" },
            { name: "Negotiation", order: 4, probability: 80, color: "#f97316" },
            { name: "Closed Won", order: 5, probability: 100, color: "#22c55e", isWon: true },
            { name: "Closed Lost", order: 6, probability: 0, color: "#ef4444", isLost: true },
          ],
        },
      },
    });

    // 4. Create the User as ADMIN
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: adminRole.id,
        email,
        name,
        passwordHash,
        isActive: true,
        isSuperAdmin: false,
      },
    });

    // 5. Establish Session
    const sessionUser: Omit<SessionUser, "expiresAt"> = {
      id: user.id,
      organizationId: org.id,
      organizationName: org.name,
      email: user.email,
      name: user.name,
      role: "ADMIN",
      permissions: ALL_ADMIN_PERMISSIONS,
      isSuperAdmin: false,
      subscriptionPlan: org.subscriptionPlan,
      subscriptionStatus: org.subscriptionStatus,
      maxSeats: org.maxSeats,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionEndsAt: null,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "ORGANIZATION_REGISTERED",
          entityType: "Organization",
          entityId: org.id,
          newValues: { name: companyName, email, plan: "FREE_TRIAL", maxSeats: 20 },
        },
      });
    } catch {}
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    // Fallback: If DB is unreachable, store in mock store and allow sign-up
    console.warn("[registerOrganizationAction] Live DB unreachable, using mock store fallback:", err);

    const orgId = `org_${Date.now()}`;
    const userId = `usr_${Date.now()}`;

    mockOrganizationsStore.unshift({
      id: orgId,
      name: companyName,
      slug,
      subscriptionPlan: "FREE_TRIAL",
      subscriptionStatus: "TRIAL",
      maxSeats: 20,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionEndsAt: null,
      billingEmail: email,
      billingPhone: (phone as string) || null,
      subscriptionNotes: "Self-serve registration 30-day Free Trial (20 seats)",
      createdAt: now.toISOString(),
    });

    mockUsersStore.unshift({
      id: userId,
      organizationId: orgId,
      name,
      email,
      role: "ADMIN",
      isActive: true,
      isSuperAdmin: false,
      avatarUrl: null,
      createdAt: now.toISOString(),
      lastLoginAt: now.toISOString(),
    });

    const sessionUser: Omit<SessionUser, "expiresAt"> = {
      id: userId,
      organizationId: orgId,
      organizationName: companyName,
      email,
      name,
      role: "ADMIN",
      permissions: ALL_ADMIN_PERMISSIONS,
      isSuperAdmin: false,
      subscriptionPlan: "FREE_TRIAL",
      subscriptionStatus: "TRIAL",
      maxSeats: 20,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionEndsAt: null,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);
  }

  redirect("/dashboard");
}

export async function getCurrentUserAction(): Promise<SessionUser | null> {
  return await getSession();
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

export async function clearSessionAndRedirectAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login?reset=true");
}

