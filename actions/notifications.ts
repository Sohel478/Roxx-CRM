"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { mockNotificationsStore, MockNotification } from "@/lib/db/mock-store";
import {
  NotificationItem,
  NotificationType,
} from "@/lib/validations/notifications";

/**
 * Fetch notifications for the currently logged-in user in their organization.
 */
export async function getNotificationsAction(params?: {
  unreadOnly?: boolean;
  limit?: number;
}) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);
  const currentUserId = session.id;
  const limit = params?.limit ?? 30;

  try {
    const userCondition = {
      OR: [
        { userId: currentUserId },
        { userId: "ALL" },
        ...(session.role === "ADMIN" ? [{ userId: "usr_admin" }] : []),
      ],
    };

    const where: any = {
      organizationId,
      ...userCondition,
    };

    if (params?.unreadOnly) {
      where.isRead = false;
    }

    const [rawNotifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          organizationId,
          isRead: false,
          ...userCondition,
        },
      }),
    ]);

    // Fast calculation of totalCount without redundant table scan when under limit
    let totalCount = rawNotifications.length;
    if (params?.unreadOnly) {
      totalCount = unreadCount;
    } else if (rawNotifications.length >= limit) {
      totalCount = await prisma.notification.count({
        where: {
          organizationId,
          ...userCondition,
        },
      });
    }

    const notifications: NotificationItem[] = rawNotifications.map((n) => ({
      id: n.id,
      organizationId: n.organizationId,
      userId: n.userId,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        notifications,
        unreadCount,
        totalCount,
      },
    };
  } catch {
    // Graceful fallback to in-memory store
    const orgNotifications = mockNotificationsStore.filter(
      (n) =>
        (n.organizationId === organizationId || organizationId === "demo-org-123") &&
        (n.userId === currentUserId ||
          n.userId === "usr_admin" ||
          n.userId === "ALL" ||
          session.role === "ADMIN")
    );

    // Sort by createdAt desc
    const sorted = [...orgNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalCount = sorted.length;
    const unreadCount = sorted.filter((n) => !n.isRead).length;

    let items = sorted;
    if (params?.unreadOnly) {
      items = items.filter((n) => !n.isRead);
    }
    items = items.slice(0, limit);

    const notifications: NotificationItem[] = items.map((n) => ({
      id: n.id,
      organizationId: n.organizationId,
      userId: n.userId,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
      isRead: n.isRead,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));

    return {
      success: true,
      data: {
        notifications,
        unreadCount,
        totalCount,
      },
    };
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsReadAction(id: string) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);

  try {
    await prisma.notification.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch {
    // Fallback: update in-memory store
    const item = mockNotificationsStore.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      item.readAt = new Date().toISOString();
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Mark all notifications as read for the current user and organization
 */
export async function markAllNotificationsAsReadAction() {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);

  try {
    await prisma.notification.updateMany({
      where: {
        organizationId,
        isRead: false,
        OR: [
          { userId: session.id },
          { userId: "ALL" },
          ...(session.role === "ADMIN" ? [{ userId: "usr_admin" }] : []),
        ],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch {
    // Fallback: update in-memory store
    mockNotificationsStore.forEach((n) => {
      if (
        (n.organizationId === organizationId || organizationId === "demo-org-123") &&
        !n.isRead
      ) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      }
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Delete a single notification
 */
export async function deleteNotificationAction(id: string) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);

  try {
    await prisma.notification.deleteMany({
      where: {
        id,
        organizationId,
      },
    });
  } catch {
    // Fallback: delete from in-memory store
    const index = mockNotificationsStore.findIndex((n) => n.id === id);
    if (index !== -1) {
      mockNotificationsStore.splice(index, 1);
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Helper to safely create a notification in database or mock store.
 * Never throws uncaught exceptions, so it can be called seamlessly inside any action.
 */
export async function createNotificationHelper(params: {
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: "lead" | "contact" | "company" | "opportunity" | "task" | "subscription" | "system" | string | null;
  entityId?: string | null;
}): Promise<void> {
  const targetUserId = params.userId || "ALL";
  const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  try {
    await prisma.notification.create({
      data: {
        id: newId,
        organizationId: params.organizationId,
        userId: targetUserId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        isRead: false,
        createdAt: now,
      },
    });
  } catch {
    // Save to mock store
    const mockItem: MockNotification = {
      id: newId,
      organizationId: params.organizationId,
      userId: targetUserId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      isRead: false,
      readAt: null,
      createdAt: now.toISOString(),
    };
    mockNotificationsStore.unshift(mockItem);
  }
}
