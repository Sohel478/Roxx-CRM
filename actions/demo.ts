"use server";

import { prisma } from "@/lib/db/prisma";
import {
  createSessionToken,
  setSessionCookie,
  SESSION_MAX_AGE,
} from "@/lib/auth/session";
import { ensureDatabaseSchema } from "@/lib/db/migrate";
import {
  mockOrganizationsStore,
  mockUsersStore,
} from "@/lib/db/mock-store";

/**
 * Logs in the user as either Demo Admin or Demo Sales Rep in 1 click.
 * Strictly adheres to Next.js Server Action guidelines (async function only).
 */
export async function loginAsDemoAction(role: "ADMIN" | "SALES_USER"): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const isMock =
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes("ep-sample-pooler") ||
      process.env.DATABASE_URL.includes("user:password");

    const targetEmail =
      role === "ADMIN" ? "admin@roxx-crm.local" : "sales@roxx-crm.local";

    if (isMock) {
      const demoOrg =
        mockOrganizationsStore.find((o) => o.slug === "demo-company" || o.isDemo) ||
        mockOrganizationsStore[0];
      const demoUser =
        mockUsersStore.find((u) => u.email === targetEmail) || mockUsersStore[0];

      const token = await createSessionToken({
        id: demoUser.id,
        organizationId: demoOrg.id,
        organizationName: demoOrg.name,
        email: demoUser.email,
        name: demoUser.name,
        role: role === "ADMIN" ? "ADMIN" : "SALES_USER",
        permissions:
          role === "ADMIN"
            ? ["all"]
            : [
                "lead:create",
                "lead:read",
                "lead:update",
                "lead:delete",
                "opportunity:create",
                "opportunity:read",
                "opportunity:update",
                "task:create",
                "task:read",
                "task:update",
                "activity:create",
                "activity:read",
                "report:view",
              ],
        isSuperAdmin: false, // Demo user is NEVER super admin
        isDemo: true,
        subscriptionPlan: demoOrg.subscriptionPlan,
        subscriptionStatus: demoOrg.subscriptionStatus,
        maxSeats: demoOrg.maxSeats,
        trialEndsAt: demoOrg.trialEndsAt,
      });

      await setSessionCookie(token);
      return { success: true };
    }

    await ensureDatabaseSchema();

    // 1. Locate Demo Organization
    let demoOrg = await prisma.organization.findFirst({
      where: {
        OR: [{ slug: "demo-company" }, { isDemo: true }],
      },
    });

    if (!demoOrg) {
      demoOrg = await prisma.organization.create({
        data: {
          name: "Demo Company",
          slug: "demo-company",
          isDemo: true,
          subscriptionPlan: "FREE_TRIAL",
          subscriptionStatus: "TRIAL",
          maxSeats: 20,
          trialEndsAt: new Date(Date.now() + 30 * 86400000),
          website: "https://demo.roxx-crm.local",
          billingEmail: "admin@roxx-crm.local",
        },
      });
    }

    // 2. Locate User
    let user = await prisma.user.findFirst({
      where: {
        email: targetEmail,
        organizationId: demoOrg.id,
      },
      include: {
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

    // Fallback if not found in DB
    if (!user) {
      user = await prisma.user.findFirst({
        where: { organizationId: demoOrg.id },
        include: {
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
    }

    const permissions =
      user?.role?.permissions?.map((rp) => rp.permission.key) ||
      (role === "ADMIN" ? ["all"] : ["lead:read", "opportunity:read"]);

    const token = await createSessionToken({
      id: user?.id || "demo-user-id",
      organizationId: demoOrg.id,
      organizationName: demoOrg.name,
      email: user?.email || targetEmail,
      name: user?.name || (role === "ADMIN" ? "Demo Admin" : "Demo Sales Rep"),
      role: role === "ADMIN" ? "ADMIN" : "SALES_USER",
      permissions,
      isSuperAdmin: false, // Strict: Demo user cannot have Super Admin access
      isDemo: true,
      subscriptionPlan: String(demoOrg.subscriptionPlan),
      subscriptionStatus: String(demoOrg.subscriptionStatus),
      maxSeats: demoOrg.maxSeats,
      trialEndsAt: demoOrg.trialEndsAt?.toISOString() || null,
      subscriptionEndsAt: demoOrg.subscriptionEndsAt?.toISOString() || null,
    });

    await setSessionCookie(token);
    return { success: true };
  } catch (err: any) {
    console.error("[loginAsDemoAction] error:", err);
    return {
      success: false,
      error: err.message || "Failed to initialize demo session",
    };
  }
}
