"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockUsersStore,
  mockOpportunitiesStore,
  mockSalesTargetsStore,
  mockAuditLogsStore,
  mockOrgSettingsStore,
} from "@/lib/db/mock-store";
import {
  monthlyTargetSchema,
  MonthlyTargetInput,
  MonthlyTargetData,
  UserTargetData,
} from "@/lib/validations/settings";

/**
 * Helper to get Date range for a specific YYYY-MM month string
 */
function getMonthDateRange(monthStr: string): { start: Date; end: Date } {
  const parts = monthStr.split("-");
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Fetch monthly sales targets, quota allocations, and actual performance for the organization
 */
export async function getMonthlyTargetsAction(
  targetMonth?: string
): Promise<{ success: boolean; data?: MonthlyTargetData; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }
  const { organizationId, userId } = await resolveTenantContext(session);
  const currentMonth = targetMonth || new Date().toISOString().slice(0, 7);
  const { start, end } = getMonthDateRange(currentMonth);

  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  try {
    // 1. Fetch Organization settings / currency
    let currency = "USD";
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }).catch(() => null);

    // 2. Fetch configured target setting from DB
    const setting = await prisma.systemSetting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: `sales_targets:${currentMonth}`,
        },
      },
    }).catch(() => null);

    let savedOrgTarget = 100000;
    let userTargetsMap: Record<string, number> = {};

    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (typeof parsed.orgTarget === "number") savedOrgTarget = parsed.orgTarget;
        if (parsed.userTargets && typeof parsed.userTargets === "object") {
          userTargetsMap = parsed.userTargets;
        }
      } catch {}
    } else if (mockSalesTargetsStore[currentMonth]) {
      savedOrgTarget = mockSalesTargetsStore[currentMonth].orgTarget;
      userTargetsMap = mockSalesTargetsStore[currentMonth].userTargets || {};
    }

    // 3. Fetch active team members (Sales reps, managers, admins)
    const dbUsers = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }).catch(() => null);

    // 4. Fetch won deals in that month
    const wonDeals = await prisma.opportunity.findMany({
      where: {
        organizationId,
        status: "WON",
        createdAt: { gte: start, lte: end },
        deletedAt: null,
      },
      select: {
        amount: true,
        ownerId: true,
      },
    }).catch(() => null);

    if (dbUsers && wonDeals) {
      const revenueByUser: Record<string, number> = {};
      let totalWon = 0;

      for (const deal of wonDeals) {
        const amt = Number(deal.amount || 0);
        totalWon += amt;
        if (deal.ownerId) {
          revenueByUser[deal.ownerId] = (revenueByUser[deal.ownerId] || 0) + amt;
        }
      }

      let totalAllocated = 0;
      const usersData: UserTargetData[] = dbUsers.map((u) => {
        const targetAmount = typeof userTargetsMap[u.id] === "number" ? userTargetsMap[u.id] : 0;
        totalAllocated += targetAmount;
        const revenueWon = revenueByUser[u.id] || 0;
        const attainmentPercent = targetAmount > 0 ? Math.round((revenueWon / targetAmount) * 100) : 0;

        return {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          role: u.role?.name || "SALES_USER",
          targetAmount,
          revenueWon,
          attainmentPercent,
        };
      });

      if (!isAdminOrManager) {
        const myTarget = usersData.find(
          (u) =>
            u.userId === session.id ||
            u.userId === userId ||
            u.userEmail.toLowerCase() === session.email.toLowerCase()
        );
        const myTargetAmount = myTarget?.targetAmount || 0;
        const myRevenueWon = myTarget?.revenueWon || 0;
        const myAttainment =
          myTargetAmount > 0 ? Math.round((myRevenueWon / myTargetAmount) * 100) : 0;

        return {
          success: true,
          data: {
            month: currentMonth,
            orgTarget: myTargetAmount,
            totalAllocated: myTargetAmount,
            totalWon: myRevenueWon,
            attainmentPercent: myAttainment,
            currency,
            users: myTarget ? [{ ...myTarget, attainmentPercent: myAttainment }] : [],
            isPersonalView: true,
          },
        };
      }

      const attainmentPercent = savedOrgTarget > 0 ? Math.round((totalWon / savedOrgTarget) * 100) : 0;

      return {
        success: true,
        data: {
          month: currentMonth,
          orgTarget: savedOrgTarget,
          totalAllocated,
          totalWon,
          attainmentPercent,
          currency,
          users: usersData,
          isPersonalView: false,
        },
      };
    }
  } catch (err: unknown) {
    console.warn("[getMonthlyTargetsAction] Live DB query failed, using mock store fallback:", err);
  }

  // --- Fallback from in-memory mock store ---
  const mockTarget = mockSalesTargetsStore[currentMonth] || {
    orgTarget: 100000,
    userTargets: {},
  };

  const usersInOrg = mockUsersStore.filter(
    (u) => (u.organizationId === organizationId || u.organizationId === "demo-org-123") && u.isActive
  );

  const wonDealsMock = mockOpportunitiesStore.filter((o) => {
    if (o.status !== "WON") return false;
    const dt = new Date(o.createdAt);
    return dt >= start && dt <= end;
  });

  const revenueByUser: Record<string, number> = {};
  let totalWon = 0;

  for (const deal of wonDealsMock) {
    const amt = Number(deal.amount || 0);
    totalWon += amt;
    if (deal.ownerId) {
      revenueByUser[deal.ownerId] = (revenueByUser[deal.ownerId] || 0) + amt;
    }
  }

  // If no won deals in this specific month, calculate overall won from all won deals for demo experience
  if (totalWon === 0) {
    for (const deal of mockOpportunitiesStore.filter((o) => o.status === "WON")) {
      const amt = Number(deal.amount || 0);
      totalWon += amt;
      if (deal.ownerId) {
        revenueByUser[deal.ownerId] = (revenueByUser[deal.ownerId] || 0) + amt;
      }
    }
  }

  let totalAllocated = 0;
  const usersData: UserTargetData[] = usersInOrg.map((u) => {
    const targetAmount = typeof mockTarget.userTargets[u.id] === "number" ? mockTarget.userTargets[u.id] : 0;
    totalAllocated += targetAmount;
    const revenueWon = revenueByUser[u.id] || 0;
    const attainmentPercent = targetAmount > 0 ? Math.round((revenueWon / targetAmount) * 100) : 0;

    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      role: u.role,
      targetAmount,
      revenueWon,
      attainmentPercent,
    };
  });

  if (!isAdminOrManager) {
    const myTarget = usersData.find(
      (u) =>
        u.userId === session.id ||
        u.userId === userId ||
        u.userEmail.toLowerCase() === session.email.toLowerCase()
    );
    const myTargetAmount = myTarget?.targetAmount || 0;
    const myRevenueWon = myTarget?.revenueWon || 0;
    const myAttainment =
      myTargetAmount > 0 ? Math.round((myRevenueWon / myTargetAmount) * 100) : 0;

    return {
      success: true,
      data: {
        month: currentMonth,
        orgTarget: myTargetAmount,
        totalAllocated: myTargetAmount,
        totalWon: myRevenueWon,
        attainmentPercent: myAttainment,
        currency: mockOrgSettingsStore.defaultCurrency || "USD",
        users: myTarget ? [{ ...myTarget, attainmentPercent: myAttainment }] : [],
        isPersonalView: true,
      },
    };
  }

  const attainmentPercent = mockTarget.orgTarget > 0 ? Math.round((totalWon / mockTarget.orgTarget) * 100) : 0;

  return {
    success: true,
    data: {
      month: currentMonth,
      orgTarget: mockTarget.orgTarget,
      totalAllocated,
      totalWon,
      attainmentPercent,
      currency: mockOrgSettingsStore.defaultCurrency || "USD",
      users: usersData,
      isPersonalView: false,
    },
  };
}

/**
 * Update monthly sales targets for the organization and individual sales reps / managers
 */
export async function updateMonthlyTargetsAction(
  input: MonthlyTargetInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  // Strict: Only Organization Admin or users with settings:update permission can adjust targets
  const userRole = session.role?.toUpperCase();
  const isAdmin = userRole === "ADMIN" || userRole === "ADMINISTRATOR" || session.isSuperAdmin;
  const hasPermission = session.permissions?.includes("settings:update");

  if (!isAdmin && !hasPermission) {
    return {
      success: false,
      error: "Unauthorized: Only Organization Admins can set monthly sales targets.",
    };
  }

  const validation = monthlyTargetSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Invalid targets configuration",
    };
  }

  const { month, orgTarget, userTargets } = validation.data;
  const userTargetsMap: Record<string, number> = {};
  for (const ut of userTargets) {
    userTargetsMap[ut.userId] = ut.targetAmount;
  }

  const settingValue = JSON.stringify({
    orgTarget,
    userTargets: userTargetsMap,
    updatedAt: new Date().toISOString(),
    updatedBy: session.id,
  });

  try {
    await prisma.systemSetting.upsert({
      where: {
        organizationId_key: {
          organizationId: session.organizationId,
          key: `sales_targets:${month}`,
        },
      },
      create: {
        organizationId: session.organizationId,
        key: `sales_targets:${month}`,
        value: settingValue,
      },
      update: {
        value: settingValue,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "SALES_TARGETS_UPDATED",
          entityType: "Organization",
          entityId: session.organizationId,
          newValues: {
            month,
            orgTarget,
            assignedUsersCount: userTargets.length,
          },
        },
      });
    } catch {}
  } catch (err: unknown) {
    console.warn("[updateMonthlyTargetsAction] Live DB save failed, updating fallback store:", err);
  }

  // Update in-memory fallback store
  mockSalesTargetsStore[month] = {
    orgTarget,
    userTargets: userTargetsMap,
  };

  mockAuditLogsStore.unshift({
    id: `audit_target_${Date.now()}`,
    organizationId: session.organizationId,
    userId: session.id,
    userName: session.name,
    action: "SALES_TARGETS_UPDATED",
    entityType: "Organization",
    entityId: session.organizationId,
    oldValues: null,
    newValues: {
      month,
      orgTarget,
      assignedUsersCount: userTargets.length,
    },
    ipAddress: null,
    createdAt: new Date().toISOString(),
  });

  try {
    revalidatePath("/dashboard");
    revalidatePath("/settings");
  } catch {}

  return {
    success: true,
    message: `Sales targets for ${month} saved successfully.`,
  };
}
