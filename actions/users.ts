"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { mockUsersStore, mockAuditLogsStore, mockOrganizationsStore, MockUser } from "@/lib/db/mock-store";
import { ensureDatabaseSchema } from "@/lib/db/migrate";
import {
  userCreateSchema,
  userUpdateSchema,
  UserCreateInput,
  UserUpdateInput,
  UserItem,
  UserRole,
} from "@/lib/validations/settings";

export type { UserItem, UserCreateInput, UserUpdateInput };

export interface TenantSeatUsage {
  usedSeats: number;
  maxSeats: number;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  organizationName: string;
  isSuperAdmin: boolean;
}

/**
 * Fetch tenant subscription and seat usage details
 */
export async function getTenantSeatUsageAction(): Promise<{
  success: boolean;
  data?: TenantSeatUsage;
  error?: string;
}> {
  const session = await requireAuth();
  await ensureDatabaseSchema();

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        maxSeats: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    const activeUserCount = await prisma.user.count({
      where: { organizationId: session.organizationId, isActive: true },
    });

    return {
      success: true,
      data: {
        usedSeats: activeUserCount,
        maxSeats: org?.maxSeats || 20,
        plan: org?.subscriptionPlan || "FREE_TRIAL",
        status: org?.subscriptionStatus || "TRIAL",
        trialEndsAt: org?.trialEndsAt ? org.trialEndsAt.toISOString() : null,
        subscriptionEndsAt: org?.subscriptionEndsAt ? org.subscriptionEndsAt.toISOString() : null,
        organizationName: org?.name || session.organizationName || "Company",
        isSuperAdmin: Boolean(session.isSuperAdmin),
      },
    };
  } catch {
    const mockOrg = mockOrganizationsStore.find((o) => o.id === session.organizationId);
    const usedSeats = mockUsersStore.filter(
      (u) => u.organizationId === session.organizationId && u.isActive
    ).length;

    return {
      success: true,
      data: {
        usedSeats,
        maxSeats: mockOrg?.maxSeats || 20,
        plan: mockOrg?.subscriptionPlan || "FREE_TRIAL",
        status: mockOrg?.subscriptionStatus || "TRIAL",
        trialEndsAt: mockOrg?.trialEndsAt || null,
        subscriptionEndsAt: mockOrg?.subscriptionEndsAt || null,
        organizationName: mockOrg?.name || session.organizationName || "Company",
        isSuperAdmin: Boolean(session.isSuperAdmin),
      },
    };
  }
}

/**
 * Fetch all team members for the organization
 */
export async function getUsersAction(): Promise<{
  success: boolean;
  data?: UserItem[];
  error?: string;
}> {
  const session = await requireAuth();
  await ensureDatabaseSchema();

  try {
    const dbUsers = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });

    const items: UserItem[] = dbUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role?.name as UserRole) || "SALES_USER",
      isActive: u.isActive,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: null,
    }));

    return { success: true, data: items };
  } catch {
    // Graceful fallback to centralized mock store
    const items: UserItem[] = mockUsersStore
      .filter((u) => u.organizationId === session.organizationId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      }));

    return { success: true, data: items };
  }
}

/**
 * Create/Invite a new team member
 */
export async function createUserAction(
  input: UserCreateInput
): Promise<{ success: boolean; data?: UserItem; error?: string }> {
  const session = await requirePermission("user:create");

  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid user data",
    };
  }

  const { name, email, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Enforce SaaS Seat Quota
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { maxSeats: true },
    });
    const maxSeats = org?.maxSeats || 20;

    const currentCount = await prisma.user.count({
      where: { organizationId: session.organizationId, isActive: true },
    });

    if (currentCount >= maxSeats) {
      return {
        success: false,
        error: `Seat limit reached (${currentCount}/${maxSeats} seats used). Please upgrade your subscription plan to add more team members.`,
      };
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return { success: false, error: "A user with this email address already exists." };
    }

    const hashedPassword = await hashPassword(password);

    // Get or find role
    let dbRole = await prisma.role.findFirst({
      where: { organizationId: session.organizationId, name: role },
    });

    if (!dbRole) {
      dbRole = await prisma.role.create({
        data: {
          organizationId: session.organizationId,
          name: role,
          description: `Standard ${role} Role`,
        },
      });
    }

    const newUser = await prisma.user.create({
      data: {
        organizationId: session.organizationId,
        roleId: dbRole.id,
        name,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        isActive: true,
      },
      include: { role: true },
    });

    // Record audit trail
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "USER_INVITED",
          entityType: "User",
          entityId: newUser.id,
          newValues: { name: newUser.name, email: newUser.email, role: dbRole.name },
        },
      });
    } catch {
      // Non-critical audit error
    }

    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: (newUser.role?.name as UserRole) || role,
        isActive: newUser.isActive,
        avatarUrl: newUser.avatarUrl,
        createdAt: newUser.createdAt.toISOString(),
        lastLoginAt: null,
      },
    };
  } catch {
    // Fallback in-memory mock store
    const mockOrg = mockOrganizationsStore.find((o) => o.id === session.organizationId);
    const mockMaxSeats = mockOrg?.maxSeats || 20;
    const currentMockCount = mockUsersStore.filter(
      (u) => u.organizationId === session.organizationId && u.isActive
    ).length;

    if (currentMockCount >= mockMaxSeats) {
      return {
        success: false,
        error: `Seat limit reached (${currentMockCount}/${mockMaxSeats} seats used). Please upgrade your subscription plan to add more team members.`,
      };
    }

    const existingMock = mockUsersStore.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (existingMock) {
      return { success: false, error: "A user with this email address already exists." };
    }

    const mockUser: MockUser = {
      id: `usr_${Date.now()}`,
      organizationId: session.organizationId,
      name,
      email: normalizedEmail,
      role,
      isActive: true,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    mockUsersStore.unshift(mockUser);

    // Add audit log
    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name,
      action: "USER_INVITED",
      entityType: "User",
      entityId: mockUser.id,
      oldValues: null,
      newValues: { name: mockUser.name, email: mockUser.email, role: mockUser.role },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        isActive: mockUser.isActive,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        lastLoginAt: null,
      },
    };
  }
}

/**
 * Update an existing team member's role or status
 */
export async function updateUserAction(
  input: UserUpdateInput
): Promise<{ success: boolean; data?: UserItem; error?: string }> {
  const session = await requirePermission("user:update");

  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid update data",
    };
  }

  const { id, name, role, isActive } = parsed.data;

  // Prevent self-deactivation or demotion of current admin
  if (session.id === id && !isActive) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  try {
    let dbRole = await prisma.role.findFirst({
      where: { organizationId: session.organizationId, name: role },
    });

    if (!dbRole) {
      dbRole = await prisma.role.create({
        data: {
          organizationId: session.organizationId,
          name: role,
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name,
        roleId: dbRole.id,
        isActive,
      },
      include: { role: true },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: updated.id,
          newValues: { name: updated.name, role: dbRole.name, isActive: updated.isActive },
        },
      });
    } catch {
      // Non-critical audit error
    }

    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: (updated.role?.name as UserRole) || role,
        isActive: updated.isActive,
        avatarUrl: updated.avatarUrl,
        createdAt: updated.createdAt.toISOString(),
        lastLoginAt: null,
      },
    };
  } catch {
    // Fallback store
    const idx = mockUsersStore.findIndex((u) => u.id === id);
    if (idx === -1) {
      return { success: false, error: "User not found" };
    }

    const oldUser = mockUsersStore[idx];
    mockUsersStore[idx] = {
      ...oldUser,
      name,
      role,
      isActive,
    };

    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: id,
      oldValues: { name: oldUser.name, role: oldUser.role, isActive: oldUser.isActive },
      newValues: { name, role, isActive },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings");

    return {
      success: true,
      data: {
        id: mockUsersStore[idx].id,
        name: mockUsersStore[idx].name,
        email: mockUsersStore[idx].email,
        role: mockUsersStore[idx].role,
        isActive: mockUsersStore[idx].isActive,
        avatarUrl: mockUsersStore[idx].avatarUrl,
        createdAt: mockUsersStore[idx].createdAt,
        lastLoginAt: mockUsersStore[idx].lastLoginAt,
      },
    };
  }
}

/**
 * Toggle user active/inactive state quickly
 */
export async function toggleUserActiveAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requirePermission("user:update");

  if (session.id === userId) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    const newActive = !user.isActive;
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: newActive },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: newActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          entityType: "User",
          entityId: userId,
          newValues: { isActive: newActive },
        },
      });
    } catch {
      // Non-critical audit error
    }

    revalidatePath("/settings");
    return { success: true };
  } catch {
    const user = mockUsersStore.find((u) => u.id === userId);
    if (!user) return { success: false, error: "User not found" };

    user.isActive = !user.isActive;

    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name,
      action: user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: userId,
      oldValues: { isActive: !user.isActive },
      newValues: { isActive: user.isActive },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings");
    return { success: true };
  }
}
