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
import { changePasswordSchema } from "@/lib/validations/settings";

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

import type { AuthState } from "@/types/auth";

const ALL_ADMIN_PERMISSIONS = [
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
  "sohel@techflux.in": {
    name: "Sohel Jatu",
    role: "SUPER_ADMIN",
    permissions: ALL_ADMIN_PERMISSIONS,
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

    const isOwner = email.toLowerCase() === "sohel@techflux.in";

    // 1. Direct authentication for SaaS Owner
    if (isOwner) {
      if (password !== "Momo$143") {
        return { success: false, error: "Invalid credentials for SaaS Owner" };
      }

      // Upsert into Neon DB so owner record is persistent in Postgres
      let ownerId = "platform-owner-sohel";
      try {
        const passwordHash = await hashPassword("Momo$143");
        const fallbackRole = await prisma.role.findFirst();
        const fallbackOrg = await prisma.organization.findFirst();
        if (fallbackRole && fallbackOrg) {
          const dbOwner = await prisma.user.upsert({
            where: { email: "sohel@techflux.in" },
            update: {
              passwordHash,
              isSuperAdmin: true,
              isActive: true,
            },
            create: {
              organizationId: fallbackOrg.id,
              roleId: fallbackRole.id,
              name: "Sohel Jatu",
              email: "sohel@techflux.in",
              passwordHash,
              isSuperAdmin: true,
              isActive: true,
            },
          });
          ownerId = dbOwner.id;
        }
      } catch (upsertErr) {
        console.warn("[loginAction] Could not sync owner to DB:", upsertErr);
      }

      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: ownerId,
        organizationId: "platform-system-org",
        organizationName: "Roxx Platform Administration",
        email: "sohel@techflux.in",
        name: "Sohel Jatu",
        role: "SUPER_ADMIN",
        permissions: ALL_ADMIN_PERMISSIONS,
        isSuperAdmin: true,
        subscriptionPlan: "ENTERPRISE",
        subscriptionStatus: "ACTIVE",
        maxSeats: 99999,
        trialEndsAt: null,
        subscriptionEndsAt: null,
      };

      const token = await createSessionToken(sessionUser);
      await setSessionCookie(token);

      const callbackUrl = (formData.get("callbackUrl") as string) || "";
      if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("/dashboard")) {
        redirect(callbackUrl);
      } else {
        redirect("/super-admin/dashboard");
      }
    }

    // 2. Organization User Authentication (Strictly NOT Super Admin)
    if (user) {
      if (!user.isActive) {
        return { success: false, error: "This account has been deactivated" };
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return { success: false, error: "Invalid email or password" };
      }

      // Cleanse DB if user was mistakenly flagged as isSuperAdmin
      if (user.isSuperAdmin) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { isSuperAdmin: false },
          });
        } catch {}
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

      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: user.id,
        organizationId: user.organizationId,
        organizationName,
        email: user.email,
        name: user.name || "User",
        role: roleName,
        permissions: permissions.length > 0 ? permissions : ALL_ADMIN_PERMISSIONS,
        isSuperAdmin: false, // Strict: Org users (Admin, Manager, Sales) can NEVER be Super Admin
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
      // 3. Fallback accounts for development & demo
      const mockUser = mockUsersStore.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      let isMockValid = false;
      if (mockUser && mockUser.passwordHash) {
        isMockValid = await verifyPassword(password, mockUser.passwordHash);
      } else {
        const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
        if (demoUser && password === "password123") {
          isMockValid = true;
        }
      }

      if (isMockValid) {
        const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
        const role = mockUser?.role || demoUser?.role || "ADMIN";
        const name = mockUser?.name || demoUser?.name || "Demo User";
        const permissions = demoUser?.permissions || ALL_ADMIN_PERMISSIONS;

        const sessionUser: Omit<SessionUser, "expiresAt"> = {
          id: mockUser?.id || `demo-user-${role.toLowerCase()}`,
          organizationId: mockUser?.organizationId || "demo-org-123",
          organizationName: "Demo Company",
          email,
          name,
          role,
          permissions,
          isSuperAdmin: false, // Strict: Demo org admin, manager, sales are NOT Super Admin
          subscriptionPlan: "FREE_TRIAL",
          subscriptionStatus: "TRIAL",
          maxSeats: 20,
          trialEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
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
    const mockUser = mockUsersStore.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    let isMockValid = false;
    if (mockUser && mockUser.passwordHash) {
      isMockValid = await verifyPassword(password, mockUser.passwordHash);
    } else {
      const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
      if (demoUser && password === "password123") {
        isMockValid = true;
      }
    }

    if (isMockValid) {
      const demoUser = DEMO_FALLBACK_USERS[email.toLowerCase()];
      const role = mockUser?.role || demoUser?.role || "ADMIN";
      const name = mockUser?.name || demoUser?.name || "Demo User";
      const permissions = demoUser?.permissions || ALL_ADMIN_PERMISSIONS;

      const sessionUser: Omit<SessionUser, "expiresAt"> = {
        id: mockUser?.id || `demo-user-${role.toLowerCase()}`,
        organizationId: mockUser?.organizationId || "demo-org-123",
        organizationName: "Demo Company",
        email,
        name,
        role,
        permissions,
        isSuperAdmin: false,
        subscriptionPlan: "FREE_TRIAL",
        subscriptionStatus: "TRIAL",
        maxSeats: 20,
        trialEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
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

  const callbackUrl = (formData.get("callbackUrl") as string) || "";
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("/super-admin")) {
    redirect(callbackUrl);
  } else {
    redirect("/dashboard");
  }
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
      const defaultPlan = await prisma.plan.findFirst({
        where: { slug: "starter" },
      });
      if (defaultPlan) {
        const sub = await prisma.subscription.create({
          data: {
            organizationId: org.id,
            planId: defaultPlan.id,
            status: "TRIAL",
            trialStartDate: now,
            trialEndDate: trialEndsAt,
            renewalDate: trialEndsAt,
            billingInterval: "MONTHLY",
          },
        });
        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            organizationId: org.id,
            eventType: "CREATED",
            newPlanId: defaultPlan.id,
            notes: "Automatic 30-day Free Trial created upon signup",
            createdBy: user.id,
          },
        }).catch(() => {});
      }
    } catch {}

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

export interface ChangePasswordState {
  success: boolean;
  error?: string;
  message?: string;
}

export async function changePasswordAction(
  prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required. Please sign in again." };
  }

  const rawData = {
    currentPassword: String(formData.get("currentPassword") || ""),
    newPassword: String(formData.get("newPassword") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
  };

  const validation = changePasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Validation failed",
    };
  }

  const { currentPassword, newPassword } = validation.data;

  try {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.id },
          { email: session.email.toLowerCase() },
        ],
      },
    });

    if (dbUser) {
      const isCurrentValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isCurrentValid) {
        return { success: false, error: "Current password does not match our records." };
      }

      const newPasswordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: dbUser.id },
        data: { passwordHash: newPasswordHash },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId: session.organizationId,
            userId: session.id,
            action: "USER_PASSWORD_CHANGED",
            entityType: "User",
            entityId: dbUser.id,
            newValues: { changedAt: new Date().toISOString() },
          },
        });
      } catch {}

      return {
        success: true,
        message: "Your password has been changed successfully.",
      };
    }
  } catch (dbErr: any) {
    console.warn("[changePasswordAction] DB lookup failed, falling back to mock store:", dbErr);
  }

  // Fallback in mockUsersStore
  const mockUser = mockUsersStore.find(
    (u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase()
  );

  if (mockUser) {
    let isCurrentValid = false;
    if (mockUser.passwordHash) {
      isCurrentValid = await verifyPassword(currentPassword, mockUser.passwordHash);
    } else {
      const expectedFallback = mockUser.isSuperAdmin ? "Momo$143" : "password123";
      isCurrentValid = currentPassword === expectedFallback;
    }

    if (!isCurrentValid) {
      return { success: false, error: "Current password does not match our records." };
    }

    const newPasswordHash = await hashPassword(newPassword);
    mockUser.passwordHash = newPasswordHash;

    return {
      success: true,
      message: "Your password has been changed successfully.",
    };
  }

  // Fallback demo user
  if (session.id.startsWith("demo-user-") || session.email.endsWith("@roxx-crm.local")) {
    if (currentPassword !== "password123") {
      return { success: false, error: "Current password does not match our records." };
    }

    const newPasswordHash = await hashPassword(newPassword);
    mockUsersStore.push({
      id: session.id,
      organizationId: session.organizationId,
      name: session.name,
      email: session.email,
      role: (session.role as any) || "ADMIN",
      isActive: true,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      passwordHash: newPasswordHash,
    });

    return {
      success: true,
      message: "Your password has been changed successfully.",
    };
  }

  return { success: false, error: "User account could not be found to update password." };
}

