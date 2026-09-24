"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockTasksStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  mockLeadsStore,
} from "@/lib/db/mock-store";
import {
  taskSchema,
  TaskFormData,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/validations/tasks";

export type { TaskItem, TaskFormData };

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Fetch tasks with smart filters, priority badges, and count aggregations
 */
export async function getTasksAction(params: {
  search?: string;
  status?: string;
  priority?: string;
  filter?: "all" | "today" | "overdue" | "upcoming" | "completed";
  leadId?: string;
  companyId?: string;
  opportunityId?: string;
} = {}) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);
  const todayStr = getTodayString();

  try {
    const where: any = {
      organizationId,
    };

    if (params.leadId) where.leadId = params.leadId;
    if (params.companyId) where.companyId = params.companyId;
    if (params.opportunityId) where.opportunityId = params.opportunityId;
    if (params.priority && params.priority !== "ALL") where.priority = params.priority;

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    const mapped: TaskItem[] = tasks.map((t) => ({
      id: t.id,
      organizationId: t.organizationId,
      title: t.title,
      description: t.description,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.name || "Unassigned",
      createdById: t.createdById,
      createdByName: t.createdBy?.name || "System",
      leadId: t.leadId,
      leadName: t.lead
        ? `${t.lead.firstName} ${t.lead.lastName || ""}`.trim()
        : null,
      companyId: t.companyId,
      companyName: t.company?.name || null,
      contactId: t.contactId,
      contactName: t.contact
        ? `${t.contact.firstName} ${t.contact.lastName || ""}`.trim()
        : null,
      opportunityId: t.opportunityId,
      opportunityName: t.opportunity?.name || null,
      dueAt: t.dueAt.toISOString().split("T")[0],
      priority: t.priority as TaskPriority,
      status: t.status as TaskStatus,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    }));

    // Filter items based on tab
    let filtered = mapped;
    if (params.filter === "today") {
      filtered = mapped.filter((t) => t.dueAt === todayStr && t.status !== "COMPLETED");
    } else if (params.filter === "overdue") {
      filtered = mapped.filter(
        (t) => t.dueAt < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED"
      );
    } else if (params.filter === "upcoming") {
      filtered = mapped.filter((t) => t.dueAt > todayStr && t.status !== "COMPLETED");
    } else if (params.filter === "completed") {
      filtered = mapped.filter((t) => t.status === "COMPLETED");
    } else if (params.status && params.status !== "ALL") {
      filtered = mapped.filter((t) => t.status === params.status);
    }

    const dueTodayCount = mapped.filter(
      (t) => t.dueAt === todayStr && t.status !== "COMPLETED"
    ).length;
    const overdueCount = mapped.filter(
      (t) => t.dueAt < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED"
    ).length;
    const upcomingCount = mapped.filter(
      (t) => t.dueAt > todayStr && t.status !== "COMPLETED"
    ).length;
    const completedCount = mapped.filter((t) => t.status === "COMPLETED").length;

    return {
      success: true,
      data: {
        items: filtered,
        summary: {
          total: mapped.length,
          dueToday: dueTodayCount,
          overdue: overdueCount,
          upcoming: upcomingCount,
          completed: completedCount,
        },
      },
    };
  } catch {
    // In-memory fallback
    const mapped: TaskItem[] = mockTasksStore.map((t) => ({ ...t }));

    let filtered = mapped.filter((t) => {
      if (params.leadId && t.leadId !== params.leadId) return false;
      if (params.companyId && t.companyId !== params.companyId) return false;
      if (params.opportunityId && t.opportunityId !== params.opportunityId) return false;
      if (params.priority && params.priority !== "ALL" && t.priority !== params.priority) {
        return false;
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesEntity =
          t.leadName?.toLowerCase().includes(q) ||
          t.companyName?.toLowerCase().includes(q) ||
          t.opportunityName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesEntity) return false;
      }
      return true;
    });

    if (params.filter === "today") {
      filtered = filtered.filter((t) => t.dueAt === todayStr && t.status !== "COMPLETED");
    } else if (params.filter === "overdue") {
      filtered = filtered.filter(
        (t) => t.dueAt < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED"
      );
    } else if (params.filter === "upcoming") {
      filtered = filtered.filter((t) => t.dueAt > todayStr && t.status !== "COMPLETED");
    } else if (params.filter === "completed") {
      filtered = filtered.filter((t) => t.status === "COMPLETED");
    } else if (params.status && params.status !== "ALL") {
      filtered = filtered.filter((t) => t.status === params.status);
    }

    const dueTodayCount = mapped.filter(
      (t) => t.dueAt === todayStr && t.status !== "COMPLETED"
    ).length;
    const overdueCount = mapped.filter(
      (t) => t.dueAt < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED"
    ).length;
    const upcomingCount = mapped.filter(
      (t) => t.dueAt > todayStr && t.status !== "COMPLETED"
    ).length;
    const completedCount = mapped.filter((t) => t.status === "COMPLETED").length;

    return {
      success: true,
      data: {
        items: filtered,
        summary: {
          total: mapped.length,
          dueToday: dueTodayCount,
          overdue: overdueCount,
          upcoming: upcomingCount,
          completed: completedCount,
        },
      },
    };
  }
}

/**
 * Create a new task
 */
export async function createTaskAction(raw: TaskFormData) {
  const session = await requireAuth();
  await requirePermission("task:create");

  const validated = taskSchema.safeParse(raw);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid task data",
    };
  }

  const data = validated.data;
  const taskId = `task_${Date.now()}`;
  const now = new Date().toISOString();

  // Resolve entity names for mock store
  let compName = null;
  if (data.companyId) {
    const comp = mockCompaniesStore.find((c) => c.id === data.companyId);
    if (comp) compName = comp.name;
  }
  let contactName = null;
  if (data.contactId) {
    const cont = mockContactsStore.find((c) => c.id === data.contactId);
    if (cont) contactName = cont.fullName;
  }
  let oppName = null;
  if (data.opportunityId) {
    const opp = mockOpportunitiesStore.find((o) => o.id === data.opportunityId);
    if (opp) oppName = opp.name;
  }
  let leadName = null;
  if (data.leadId) {
    const lead = mockLeadsStore.find((l) => l.id === data.leadId);
    if (lead) leadName = lead.fullName;
  }

  try {
    const { organizationId, userId } = await resolveTenantContext(session);
    const task = await prisma.task.create({
      data: {
        organizationId,
        title: data.title,
        description: data.description || null,
        assignedToId: data.assignedToId || userId || session.id,
        createdById: userId || session.id,
        leadId: data.leadId || null,
        companyId: data.companyId || null,
        contactId: data.contactId || null,
        opportunityId: data.opportunityId || null,
        dueAt: new Date(data.dueAt),
        priority: data.priority,
        status: data.status,
      },
    });

    // Also sync mock store
    mockTasksStore.unshift({
      id: task.id,
      organizationId: session.organizationId,
      title: data.title,
      description: data.description || null,
      assignedToId: data.assignedToId || session.id,
      assignedToName: data.assignedToName || session.name || "Alex Sales",
      createdById: session.id,
      createdByName: session.name || "Alex Sales",
      leadId: data.leadId || null,
      leadName,
      companyId: data.companyId || null,
      companyName: compName,
      contactId: data.contactId || null,
      contactName,
      opportunityId: data.opportunityId || null,
      opportunityName: oppName,
      dueAt: data.dueAt.includes("T") ? data.dueAt.split("T")[0] : data.dueAt,
      priority: data.priority,
      status: data.status,
      completedAt: null,
      createdAt: now,
    });

    revalidatePath("/tasks");
    revalidatePath("/activities");
    revalidatePath("/dashboard");
    return { success: true, data: { id: task.id } };
  } catch {
    // In-memory fallback
    mockTasksStore.unshift({
      id: taskId,
      organizationId: session.organizationId,
      title: data.title,
      description: data.description || null,
      assignedToId: data.assignedToId || session.id,
      assignedToName: data.assignedToName || session.name || "Alex Sales",
      createdById: session.id,
      createdByName: session.name || "Alex Sales",
      leadId: data.leadId || null,
      leadName,
      companyId: data.companyId || null,
      companyName: compName,
      contactId: data.contactId || null,
      contactName,
      opportunityId: data.opportunityId || null,
      opportunityName: oppName,
      dueAt: data.dueAt.includes("T") ? data.dueAt.split("T")[0] : data.dueAt,
      priority: data.priority,
      status: data.status,
      completedAt: null,
      createdAt: now,
    });

    revalidatePath("/tasks");
    revalidatePath("/activities");
    revalidatePath("/dashboard");
    return { success: true, data: { id: taskId } };
  }
}

/**
 * Toggle task completion status
 */
export async function toggleTaskStatusAction(id: string, completed: boolean) {
  const session = await requireAuth();
  await requirePermission("task:update");

  const newStatus: TaskStatus = completed ? "COMPLETED" : "PENDING";
  const completedAt = completed ? new Date() : null;

  try {
    await prisma.task.update({
      where: { id },
      data: {
        status: newStatus,
        completedAt,
        completedById: completed ? session.id : null,
      },
    });

    const mockItem = mockTasksStore.find((t) => t.id === id);
    if (mockItem) {
      mockItem.status = newStatus;
      mockItem.completedAt = completedAt ? completedAt.toISOString() : null;
    }

    revalidatePath("/tasks");
    revalidatePath("/activities");
    return { success: true };
  } catch {
    const mockItem = mockTasksStore.find((t) => t.id === id);
    if (mockItem) {
      mockItem.status = newStatus;
      mockItem.completedAt = completedAt ? completedAt.toISOString() : null;
      revalidatePath("/tasks");
      revalidatePath("/activities");
      return { success: true };
    }
    return { success: false, error: "Task not found" };
  }
}

/**
 * Update an existing task
 */
export async function updateTaskAction(id: string, raw: Partial<TaskFormData>) {
  await requirePermission("task:update");

  try {
    const updateData: any = {};
    if (raw.title !== undefined) updateData.title = raw.title;
    if (raw.description !== undefined) updateData.description = raw.description;
    if (raw.priority !== undefined) updateData.priority = raw.priority;
    if (raw.status !== undefined) updateData.status = raw.status;
    if (raw.dueAt !== undefined) updateData.dueAt = new Date(raw.dueAt);

    await prisma.task.update({
      where: { id },
      data: updateData,
    });

    const mockItem = mockTasksStore.find((t) => t.id === id);
    if (mockItem) {
      if (raw.title) mockItem.title = raw.title;
      if (raw.description !== undefined) mockItem.description = raw.description || null;
      if (raw.priority) mockItem.priority = raw.priority;
      if (raw.status) mockItem.status = raw.status;
      if (raw.dueAt) {
        mockItem.dueAt = raw.dueAt.includes("T") ? raw.dueAt.split("T")[0] : raw.dueAt;
      }
    }

    revalidatePath("/tasks");
    return { success: true };
  } catch {
    const mockItem = mockTasksStore.find((t) => t.id === id);
    if (mockItem) {
      if (raw.title) mockItem.title = raw.title;
      if (raw.description !== undefined) mockItem.description = raw.description || null;
      if (raw.priority) mockItem.priority = raw.priority;
      if (raw.status) mockItem.status = raw.status;
      if (raw.dueAt) {
        mockItem.dueAt = raw.dueAt.includes("T") ? raw.dueAt.split("T")[0] : raw.dueAt;
      }
      revalidatePath("/tasks");
      return { success: true };
    }
    return { success: false, error: "Task not found" };
  }
}

/**
 * Delete a task
 */
export async function deleteTaskAction(id: string) {
  await requirePermission("task:delete");

  try {
    await prisma.task.delete({
      where: { id },
    });

    const index = mockTasksStore.findIndex((t) => t.id === id);
    if (index !== -1) mockTasksStore.splice(index, 1);

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    const index = mockTasksStore.findIndex((t) => t.id === id);
    if (index !== -1) {
      mockTasksStore.splice(index, 1);
      revalidatePath("/tasks");
      revalidatePath("/dashboard");
      return { success: true };
    }
    return { success: false, error: "Task not found" };
  }
}
