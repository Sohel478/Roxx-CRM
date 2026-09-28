import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationFilterSchema, NotificationItem, NotificationType } from "@/lib/validations/notifications";
import { mockNotificationsStore, MockNotification } from "@/lib/db/mock-store";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", async () => {
  return {
    requireAuth: vi.fn().mockResolvedValue({
      id: "usr_admin",
      organizationId: "demo-org-123",
      email: "admin@roxx-crm.local",
      name: "Admin User",
      role: "ADMIN",
      permissions: ["*"],
    }),
  };
});

vi.mock("@/lib/auth/tenant", async () => {
  return {
    resolveTenantContext: vi.fn().mockResolvedValue({
      organizationId: "demo-org-123",
      userId: "usr_admin",
    }),
  };
});

vi.mock("@/lib/db/migrate", () => ({
  ensureDatabaseSchema: vi.fn().mockResolvedValue(undefined),
}));

// Force prisma to fail so fallback to in-memory mock store is tested
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      count: vi.fn().mockRejectedValue(new Error("DB offline")),
      updateMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      deleteMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      create: vi.fn().mockRejectedValue(new Error("DB offline")),
    },
  },
}));

import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  deleteNotificationAction,
  createNotificationHelper,
} from "@/actions/notifications";

describe("Notifications System Validation & State Management", () => {
  beforeEach(() => {
    // Reset mock store with predictable test items
    mockNotificationsStore.length = 0;
    mockNotificationsStore.push(
      {
        id: "test_notif_1",
        organizationId: "demo-org-123",
        userId: "usr_admin",
        type: "LEAD_ASSIGNED",
        title: "New High-Value Lead Assigned",
        message: "Rajesh Sharma (₹750,000) assigned to you.",
        entityType: "lead",
        entityId: "lead_1",
        isRead: false,
        readAt: null,
        createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
      },
      {
        id: "test_notif_2",
        organizationId: "demo-org-123",
        userId: "usr_admin",
        type: "TASK_DUE",
        title: "Urgent Task Due Today",
        message: "Follow up with Alpha Corp is due.",
        entityType: "task",
        entityId: "task_1",
        isRead: false,
        readAt: null,
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        id: "test_notif_3",
        organizationId: "demo-org-123",
        userId: "usr_admin",
        type: "OPPORTUNITY_WON",
        title: "Deal Closed - Won! 🎉",
        message: "Acme Cloud Migration won for ₹450,000.",
        entityType: "opportunity",
        entityId: "opp_1",
        isRead: true,
        readAt: new Date(Date.now() - 60 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
      }
    );
  });

  describe("Validation Schema", () => {
    it("validates empty filter input with default limit 30", () => {
      const res = notificationFilterSchema.safeParse({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.limit).toBe(30);
        expect(res.data.unreadOnly).toBeUndefined();
      }
    });

    it("validates unreadOnly filter with custom limit", () => {
      const res = notificationFilterSchema.safeParse({ unreadOnly: true, limit: 15 });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.unreadOnly).toBe(true);
        expect(res.data.limit).toBe(15);
      }
    });

    it("rejects limits exceeding 100", () => {
      const res = notificationFilterSchema.safeParse({ limit: 150 });
      expect(res.success).toBe(false);
    });
  });

  describe("Server Actions & Mock Store Resilience", () => {
    it("fetches notifications and correctly counts unread vs total", async () => {
      const res = await getNotificationsAction();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.totalCount).toBe(3);
      expect(res.data?.unreadCount).toBe(2);
      expect(res.data?.notifications).toHaveLength(3);
      expect(res.data?.notifications[0].id).toBe("test_notif_1");
    });

    it("filters only unread notifications when unreadOnly is requested", async () => {
      const res = await getNotificationsAction({ unreadOnly: true });
      expect(res.success).toBe(true);
      expect(res.data?.notifications).toHaveLength(2);
      expect(res.data?.notifications.every((n) => !n.isRead)).toBe(true);
    });

    it("marks a single notification as read", async () => {
      const markRes = await markNotificationAsReadAction("test_notif_1");
      expect(markRes.success).toBe(true);

      const afterRes = await getNotificationsAction();
      expect(afterRes.data?.unreadCount).toBe(1);
      const updated = afterRes.data?.notifications.find((n) => n.id === "test_notif_1");
      expect(updated?.isRead).toBe(true);
      expect(updated?.readAt).toBeTruthy();
    });

    it("marks all notifications as read", async () => {
      const markAllRes = await markAllNotificationsAsReadAction();
      expect(markAllRes.success).toBe(true);

      const afterRes = await getNotificationsAction();
      expect(afterRes.data?.unreadCount).toBe(0);
      expect(afterRes.data?.notifications.every((n) => n.isRead)).toBe(true);
    });

    it("deletes a notification permanently", async () => {
      const deleteRes = await deleteNotificationAction("test_notif_2");
      expect(deleteRes.success).toBe(true);

      const afterRes = await getNotificationsAction();
      expect(afterRes.data?.totalCount).toBe(2);
      expect(afterRes.data?.notifications.find((n) => n.id === "test_notif_2")).toBeUndefined();
    });

    it("creates a new notification using createNotificationHelper", async () => {
      await createNotificationHelper({
        organizationId: "demo-org-123",
        userId: "usr_admin",
        type: "CONTACT_CREATED",
        title: "New Contact Created",
        message: "Ananya Roy was added under TechCorp.",
        entityType: "contact",
        entityId: "cont_new_1",
      });

      const afterRes = await getNotificationsAction();
      expect(afterRes.data?.totalCount).toBe(4);
      expect(afterRes.data?.unreadCount).toBe(3);
      const newest = afterRes.data?.notifications[0];
      expect(newest?.title).toBe("New Contact Created");
      expect(newest?.type).toBe("CONTACT_CREATED");
      expect(newest?.entityType).toBe("contact");
    });
  });
});
