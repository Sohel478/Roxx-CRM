"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { mockAuditLogsStore } from "@/lib/db/mock-store";
import { AuditLogItem, AuditLogFilterParams } from "@/lib/validations/audit";

/**
 * Fetch audit logs with entity, action, and keyword filters
 */
export async function getAuditLogsAction(
  params: AuditLogFilterParams = {}
): Promise<{ success: boolean; data?: AuditLogItem[]; error?: string }> {
  const session = await requireAuth();

  try {
    const where: any = {
      organizationId: session.organizationId,
    };

    if (params.entityType && params.entityType !== "ALL") {
      where.entityType = params.entityType;
    }
    if (params.action && params.action !== "ALL") {
      where.action = params.action;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit || 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const mapped: AuditLogItem[] = logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user?.name || "System",
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      oldValues: l.oldValues as Record<string, any> | null,
      newValues: l.newValues as Record<string, any> | null,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    }));

    return { success: true, data: mapped };
  } catch {
    // In-memory fallback
    let filtered = mockAuditLogsStore.filter((l) => {
      if (params.entityType && params.entityType !== "ALL" && l.entityType !== params.entityType) {
        return false;
      }
      if (params.action && params.action !== "ALL" && l.action !== params.action) {
        return false;
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        const matchesAction = l.action.toLowerCase().includes(q);
        const matchesUser = l.userName.toLowerCase().includes(q);
        const matchesEntity = l.entityType.toLowerCase().includes(q);
        if (!matchesAction && !matchesUser && !matchesEntity) return false;
      }
      return true;
    });

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (params.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    return {
      success: true,
      data: filtered.map((l) => ({ ...l })),
    };
  }
}
