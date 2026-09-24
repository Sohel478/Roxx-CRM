"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockActivitiesStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  mockLeadsStore,
} from "@/lib/db/mock-store";
import {
  activitySchema,
  ActivityFormData,
  ActivityItem,
  ActivityType,
} from "@/lib/validations/activities";

/**
 * Fetch activities with chronological ordering and type metrics
 */
export async function getActivitiesAction(params: {
  type?: string;
  leadId?: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  limit?: number;
} = {}) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);

  try {
    const where: any = {
      organizationId,
    };

    if (params.type && params.type !== "ALL") {
      where.type = params.type;
    }
    if (params.leadId) where.leadId = params.leadId;
    if (params.companyId) where.companyId = params.companyId;
    if (params.contactId) where.contactId = params.contactId;
    if (params.opportunityId) where.opportunityId = params.opportunityId;

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { activityAt: "desc" },
      take: params.limit || 100,
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    const mapped: ActivityItem[] = activities.map((a) => ({
      id: a.id,
      organizationId: a.organizationId,
      type: a.type as ActivityType,
      subject: a.subject,
      description: a.description,
      leadId: a.leadId,
      leadName: a.lead ? `${a.lead.firstName} ${a.lead.lastName || ""}`.trim() : null,
      companyId: a.companyId,
      companyName: a.company?.name || null,
      contactId: a.contactId,
      contactName: a.contact
        ? `${a.contact.firstName} ${a.contact.lastName || ""}`.trim()
        : null,
      opportunityId: a.opportunityId,
      opportunityName: a.opportunity?.name || null,
      userId: a.userId,
      userName: a.user?.name || "System",
      activityAt: a.activityAt.toISOString(),
      durationMinutes: a.durationMinutes,
      outcome: a.outcome,
      createdAt: a.createdAt.toISOString(),
    }));

    // Calculate aggregations
    const allActivities = await prisma.activity.findMany({
      where: { organizationId: session.organizationId },
      select: { type: true },
    });

    const callsCount = allActivities.filter((a) => a.type === "CALL").length;
    const meetingsCount = allActivities.filter((a) => a.type === "MEETING").length;
    const emailsCount = allActivities.filter((a) => a.type === "EMAIL").length;
    const notesCount = allActivities.filter((a) => a.type === "NOTE").length;

    return {
      success: true,
      data: {
        items: mapped,
        summary: {
          total: allActivities.length,
          callsCount,
          meetingsCount,
          emailsCount,
          notesCount,
        },
      },
    };
  } catch {
    // In-memory fallback
    const mapped: ActivityItem[] = mockActivitiesStore.map((a) => ({ ...a }));

    let filtered = mapped.filter((a) => {
      if (params.type && params.type !== "ALL" && a.type !== params.type) return false;
      if (params.leadId && a.leadId !== params.leadId) return false;
      if (params.companyId && a.companyId !== params.companyId) return false;
      if (params.contactId && a.contactId !== params.contactId) return false;
      if (params.opportunityId && a.opportunityId !== params.opportunityId) return false;
      return true;
    });

    // Sort descending by activity date
    filtered.sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime());

    if (params.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    const callsCount = mapped.filter((a) => a.type === "CALL").length;
    const meetingsCount = mapped.filter((a) => a.type === "MEETING").length;
    const emailsCount = mapped.filter((a) => a.type === "EMAIL").length;
    const notesCount = mapped.filter((a) => a.type === "NOTE").length;

    return {
      success: true,
      data: {
        items: filtered,
        summary: {
          total: mapped.length,
          callsCount,
          meetingsCount,
          emailsCount,
          notesCount,
        },
      },
    };
  }
}

export async function logActivityAction(raw: ActivityFormData) {
  try {
    const session = await requirePermission("activity:create");

    const validated = activitySchema.safeParse(raw);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || "Invalid activity data",
      };
    }

    const data = validated.data;
    const actId = `act_${Date.now()}`;
    const now = new Date().toISOString();
    const activityDate = data.activityAt ? new Date(data.activityAt) : new Date();

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
      const activity = await prisma.activity.create({
        data: {
          organizationId,
          type: data.type,
          subject: data.subject,
          description: data.description || null,
          leadId: data.leadId || null,
          companyId: data.companyId || null,
          contactId: data.contactId || null,
          opportunityId: data.opportunityId || null,
          userId: userId || session.id,
          activityAt: activityDate,
          durationMinutes: data.durationMinutes || null,
          outcome: data.outcome || null,
        },
      });

      // Also sync mock store
      mockActivitiesStore.unshift({
        id: activity.id,
        organizationId: session.organizationId,
        type: data.type,
        subject: data.subject,
        description: data.description || null,
        leadId: data.leadId || null,
        leadName,
        companyId: data.companyId || null,
        companyName: compName,
        contactId: data.contactId || null,
        contactName,
        opportunityId: data.opportunityId || null,
        opportunityName: oppName,
        userId: session.id,
        userName: session.name || "Alex Sales",
        activityAt: activityDate.toISOString(),
        durationMinutes: data.durationMinutes || null,
        outcome: data.outcome || null,
        createdAt: now,
      });

      revalidatePath("/activities");
      revalidatePath("/tasks");
      if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
      if (data.opportunityId) revalidatePath(`/opportunities/${data.opportunityId}`);
      return { success: true, data: { id: activity.id } };
    } catch {
      // In-memory fallback
      mockActivitiesStore.unshift({
        id: actId,
        organizationId: session.organizationId,
        type: data.type,
        subject: data.subject,
        description: data.description || null,
        leadId: data.leadId || null,
        leadName,
        companyId: data.companyId || null,
        companyName: compName,
        contactId: data.contactId || null,
        contactName,
        opportunityId: data.opportunityId || null,
        opportunityName: oppName,
        userId: session.id,
        userName: session.name || "Alex Sales",
        activityAt: activityDate.toISOString(),
        durationMinutes: data.durationMinutes || null,
        outcome: data.outcome || null,
        createdAt: now,
      });

      revalidatePath("/activities");
      revalidatePath("/tasks");
      if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
      if (data.opportunityId) revalidatePath(`/opportunities/${data.opportunityId}`);
      return { success: true, data: { id: actId } };
    }
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to log activity" };
  }
}

/**
 * Delete an activity log
 */
export async function deleteActivityAction(id: string) {
  try {
    await requireAuth();

    try {
      await prisma.activity.delete({
        where: { id },
      });

      const index = mockActivitiesStore.findIndex((a) => a.id === id);
      if (index !== -1) mockActivitiesStore.splice(index, 1);

      revalidatePath("/activities");
      revalidatePath("/dashboard");
      return { success: true };
    } catch {
      const index = mockActivitiesStore.findIndex((a) => a.id === id);
      if (index !== -1) {
        mockActivitiesStore.splice(index, 1);
        revalidatePath("/activities");
        revalidatePath("/dashboard");
        return { success: true };
      }
      return { success: false, error: "Activity not found" };
    }
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to delete activity" };
  }
}
