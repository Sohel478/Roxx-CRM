import { describe, it, expect } from "vitest";
import {
  taskSchema,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/validations/tasks";

describe("Tasks & Reminders Validation Rules", () => {
  it("validates a complete and valid task payload", () => {
    const valid = {
      title: "Follow up with Sarah Connor on cloud proposal",
      description: "Discuss seat pricing and SLA tiers before Thursday",
      dueAt: "2026-10-15",
      priority: "HIGH" as const,
      status: "PENDING" as const,
      companyId: "comp_1",
      contactId: "cont_1",
    };

    const res = taskSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.title).toBe("Follow up with Sarah Connor on cloud proposal");
      expect(res.data.priority).toBe("HIGH");
      expect(res.data.status).toBe("PENDING");
      expect(res.data.dueAt).toBe("2026-10-15");
    }
  });

  it("rejects task with title shorter than 2 characters", () => {
    const invalid = {
      title: "F",
      dueAt: "2026-10-15",
    };

    const res = taskSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("at least 2 characters");
    }
  });

  it("rejects task with invalid due date format", () => {
    const invalid = {
      title: "Schedule quarterly review",
      dueAt: "not-a-real-date",
    };

    const res = taskSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Invalid due date format");
    }
  });

  it("supports all standardized task priority levels", () => {
    expect(TASK_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);

    TASK_PRIORITIES.forEach((priority) => {
      const res = taskSchema.safeParse({
        title: `Test task for ${priority}`,
        dueAt: "2026-10-01",
        priority,
      });
      expect(res.success).toBe(true);
    });
  });

  it("supports all standardized task status values", () => {
    expect(TASK_STATUSES).toEqual(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

    TASK_STATUSES.forEach((status) => {
      const res = taskSchema.safeParse({
        title: `Test task for ${status}`,
        dueAt: "2026-10-01",
        status,
      });
      expect(res.success).toBe(true);
    });
  });

  it("correctly identifies overdue, today, and upcoming dates", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const tasks = [
      { id: "1", title: "Task 1", dueAt: yesterday, status: "PENDING" },
      { id: "2", title: "Task 2", dueAt: todayStr, status: "PENDING" },
      { id: "3", title: "Task 3", dueAt: tomorrow, status: "PENDING" },
      { id: "4", title: "Task 4", dueAt: yesterday, status: "COMPLETED" },
    ];

    const isOverdue = (t: (typeof tasks)[0]) =>
      t.dueAt < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED";
    const isToday = (t: (typeof tasks)[0]) =>
      t.dueAt === todayStr && t.status !== "COMPLETED";
    const isUpcoming = (t: (typeof tasks)[0]) =>
      t.dueAt > todayStr && t.status !== "COMPLETED";

    const overdueTasks = tasks.filter(isOverdue);
    const todayTasks = tasks.filter(isToday);
    const upcomingTasks = tasks.filter(isUpcoming);

    expect(overdueTasks.map((t) => t.id)).toEqual(["1"]);
    expect(todayTasks.map((t) => t.id)).toEqual(["2"]);
    expect(upcomingTasks.map((t) => t.id)).toEqual(["3"]);
  });
});
