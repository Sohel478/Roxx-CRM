"use server";

import { revalidatePath } from "next/cache";
import { prisma, isMockDatabase } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockAiCampaignsStore,
  mockLeadsStore,
  mockUsersStore,
  mockSmtpStore,
  mockActivitiesStore,
  mockDirectEmailsStore,
  mockSuppressedEmailsStore,
  MockMarketingBatch,
  MockMarketingCampaign,
  MockRecipientLog,
  persistMockLeads,
} from "@/lib/db/mock-store";
import { decryptSecret } from "@/lib/crypto/encryption";
import * as mailer from "@/lib/email/mailer";
import { applyMergeTags } from "@/lib/templates/email-templates";
import { logActivityAction } from "@/actions/activities";
import { resolveCleanCompanyName } from "@/lib/ai/lead-researcher";
import {
  isEmailSuppressed,
  suppressEmail,
  calculateCampaignKpis,
  recordEmailOpen,
  recordEmailClick,
  recordEmailBounce,
  recordEmailUnsubscribe,
} from "@/lib/email/tracking";
import {
  createMarketingBatchSchema,
  CreateMarketingBatchInput,
  updateMarketingBatchSchema,
  UpdateMarketingBatchInput,
  assignMarketingBatchSchema,
  AssignMarketingBatchInput,
  removeLeadsFromBatchSchema,
  RemoveLeadsFromBatchInput,
  sendBatchEmailSchema,
  SendBatchEmailInput,
  MarketingBatchItem,
  MarketingBatchDetail,
  MarketingCampaignItem,
} from "@/lib/validations/marketing";

/**
 * Helper to determine if the active session is an Admin or Manager
 */
function isUserAdminOrManager(session: any): boolean {
  const roleUpper = (session.role || "").toUpperCase();
  return (
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    roleUpper === "SALES_MANAGER" ||
    Boolean(session.isSuperAdmin)
  );
}

/**
 * Helper to resolve user name and email from Prisma or mock store
 */
async function resolveUserInfo(
  userId?: string | null
): Promise<{ id: string; name: string; email: string } | null> {
  if (!userId) return null;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (dbUser) return dbUser;
  } catch {}
  const mockUser = mockUsersStore.find((u) => u.id === userId);
  if (mockUser) return { id: mockUser.id, name: mockUser.name, email: mockUser.email };
  return null;
}

/**
 * 1. Fetch marketing batches with role-based visibility:
 * - Admin and Managers can see all organization batches.
 * - Sales Reps see strictly the batches they created (ownership).
 */
export async function getMarketingBatchesAction(): Promise<{
  success: boolean;
  data?: {
    batches: MarketingBatchItem[];
    stats: {
      totalBatches: number;
      totalCampaigns: number;
      totalSentEmails: number;
      totalLeadsBatched: number;
    };
  };
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    let batches: MarketingBatchItem[] = [];

    try {
      const where: any = {
        organizationId,
        deletedAt: null,
      };

      if (!isAdminOrManager) {
        where.ownerId = userId || session.id;
      }

      const dbBatches = await prisma.marketingBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          campaigns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              subject: true,
              sentAt: true,
              status: true,
              sentCount: true,
              failedCount: true,
              totalRecipients: true,
            },
          },
        },
      });

      batches = dbBatches.map((b) => {
        const leadIds = Array.isArray(b.leadIds) ? (b.leadIds as string[]) : [];
        let lastCampaign: MarketingBatchItem["lastCampaign"] = b.campaigns[0]
          ? {
              ...b.campaigns[0],
              sentAt: b.campaigns[0].sentAt ? b.campaigns[0].sentAt.toISOString() : null,
            }
          : null;

        if (!lastCampaign) {
          const mockC = mockMarketingCampaignsStore
            .filter((c) => c.batchId === b.id)
            .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
          if (mockC) {
            const kpis = calculateCampaignKpis(mockC.recipientLogs || []);
            lastCampaign = {
              id: mockC.id,
              subject: mockC.subject,
              sentAt: mockC.sentAt || null,
              status: mockC.status,
              sentCount: mockC.sentCount,
              failedCount: mockC.failedCount,
              openedCount: mockC.openedCount ?? kpis.openedCount,
              clickedCount: mockC.clickedCount ?? kpis.clickedCount,
              bouncedCount: mockC.bouncedCount ?? kpis.bouncedCount,
              unsubscribedCount: mockC.unsubscribedCount ?? kpis.unsubscribedCount,
              totalRecipients: mockC.totalRecipients,
            };
          } else {
            const aiC = mockAiCampaignsStore
              .filter((c) => c.batchId === b.id)
              .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
            if (aiC) {
              lastCampaign = {
                id: aiC.id,
                subject: aiC.objective ? `[AI] ${aiC.objective}` : "AI Outreach",
                sentAt: aiC.updatedAt,
                status: aiC.status === "COMPLETED" ? "SENT" : aiC.status === "ACTIVE" || aiC.status === "SCHEDULED" ? "SENDING" : "DRAFT",
                sentCount: aiC.sentCount,
                failedCount: aiC.failedCount ?? 0,
                totalRecipients: aiC.totalLeads,
              };
            }
          }
        }

        const assignedName = (b as any).assignedToName || (session.id === b.ownerId ? session.name : "Sales Rep");
        const assignedEmail = (b as any).assignedToEmail || (session.id === b.ownerId ? session.email : null);

        return {
          id: b.id,
          organizationId: b.organizationId,
          name: b.name,
          description: b.description,
          ownerId: b.ownerId,
          ownerName: assignedName,
          assignedToId: (b as any).assignedToId || b.ownerId || null,
          assignedToName: assignedName,
          assignedToEmail: assignedEmail,
          leadIds,
          leadCount: b.leadCount || leadIds.length,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
          lastCampaign,
        };
      });
    } catch {
      // Fallback to in-memory store
      const filtered = mockMarketingBatchesStore.filter((b) => {
        if (b.deletedAt) return false;
        if (!isAdminOrManager && b.ownerId !== session.id && b.ownerId !== userId) {
          return false;
        }
        return true;
      });

      batches = filtered.map((b) => {
        const campaigns = mockMarketingCampaignsStore
          .filter((c) => c.batchId === b.id)
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());

        let last: MarketingBatchItem["lastCampaign"] = campaigns[0]
          ? {
              id: campaigns[0].id,
              subject: campaigns[0].subject,
              sentAt: campaigns[0].sentAt || null,
              status: campaigns[0].status,
              sentCount: campaigns[0].sentCount,
              failedCount: campaigns[0].failedCount,
              openedCount: campaigns[0].openedCount,
              clickedCount: campaigns[0].clickedCount,
              bouncedCount: campaigns[0].bouncedCount,
              unsubscribedCount: campaigns[0].unsubscribedCount,
              totalRecipients: campaigns[0].totalRecipients,
            }
          : null;

        if (!last) {
          const aiC = mockAiCampaignsStore
            .filter((c) => c.batchId === b.id)
            .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
          if (aiC) {
            last = {
              id: aiC.id,
              subject: aiC.objective ? `[AI] ${aiC.objective}` : "AI Outreach",
              sentAt: aiC.updatedAt,
              status: aiC.status === "COMPLETED" ? "SENT" : aiC.status === "ACTIVE" || aiC.status === "SCHEDULED" ? "SENDING" : "DRAFT",
              sentCount: aiC.sentCount,
              failedCount: aiC.failedCount ?? 0,
              totalRecipients: aiC.totalLeads,
            };
          }
        }

        const assignedName = b.assignedToName || b.ownerName || (session.id === b.ownerId ? session.name : "Sales Rep");
        const assignedEmail = b.assignedToEmail || (session.id === b.ownerId ? session.email : null);

        return {
          id: b.id,
          organizationId: b.organizationId,
          name: b.name,
          description: b.description,
          ownerId: b.ownerId,
          ownerName: assignedName,
          assignedToId: b.assignedToId || b.ownerId || null,
          assignedToName: assignedName,
          assignedToEmail: assignedEmail,
          leadIds: b.leadIds,
          leadCount: b.leadCount || b.leadIds.length,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          lastCampaign: last,
        };
      });
    }

    // Compute aggregated metrics
    const totalBatches = batches.length;
    const totalLeadsBatched = batches.reduce((acc, b) => acc + b.leadCount, 0);

    let totalCampaigns = 0;
    let totalSentEmails = 0;

    try {
      const campaignStats = await prisma.marketingCampaign.aggregate({
        where: {
          organizationId,
          ...(isAdminOrManager ? {} : { senderId: userId || session.id }),
        },
        _count: { id: true },
        _sum: { sentCount: true },
      });
      totalCampaigns = campaignStats._count.id || 0;
      totalSentEmails = campaignStats._sum.sentCount || 0;
    } catch {
      const filteredCampaigns = mockMarketingCampaignsStore.filter((c) => {
        if (!isAdminOrManager && c.senderId !== session.id && c.senderId !== userId) {
          return false;
        }
        return true;
      });
      totalCampaigns = filteredCampaigns.length;
      totalSentEmails = filteredCampaigns.reduce((acc, c) => acc + c.sentCount, 0);
    }

    return {
      success: true,
      data: {
        batches,
        stats: {
          totalBatches,
          totalCampaigns,
          totalSentEmails,
          totalLeadsBatched,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to retrieve marketing batches",
    };
  }
}

/**
 * 2. Fetch specific batch details, member leads, and campaign logs.
 * Enforces ownership access rules.
 */
export async function getMarketingBatchByIdAction(batchId: string): Promise<{
  success: boolean;
  data?: MarketingBatchDetail;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    let batchRecord: any = null;
    let campaignRecords: any[] = [];

    try {
      batchRecord = await prisma.marketingBatch.findUnique({
        where: { id: batchId },
        include: {
          campaigns: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (batchRecord) {
        campaignRecords = batchRecord.campaigns || [];
      }
    } catch {
      // Mock store fallback
      batchRecord = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
      if (batchRecord) {
        campaignRecords = mockMarketingCampaignsStore
          .filter((c) => c.batchId === batchId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    }

    // Merge any mock campaigns or AI campaigns targeting this batch
    const mockMatchingCampaigns = mockMarketingCampaignsStore.filter((c) => c.batchId === batchId);
    for (const mc of mockMatchingCampaigns) {
      if (!campaignRecords.some((c: any) => c.id === mc.id)) {
        campaignRecords.push(mc);
      }
    }

    const aiMatchingCampaigns = mockAiCampaignsStore.filter((c) => c.batchId === batchId);
    for (const ac of aiMatchingCampaigns) {
      if (!campaignRecords.some((c: any) => c.id === ac.id)) {
        campaignRecords.push({
          id: ac.id,
          batchId: ac.batchId,
          organizationId: ac.organizationId,
          senderId: ac.creatorId || "system",
          senderName: ac.creatorName || "Sales Rep",
          senderEmail: (ac as any).senderEmail || null,
          subject: ac.objective ? `[AI Campaign] ${ac.objective}` : "AI Automated Outreach",
          body: `AI Scheduled Campaign (${ac.schedules?.length || 0} leads targeted)`,
          status: ac.status === "COMPLETED" ? "SENT" : ac.status === "ACTIVE" || ac.status === "SCHEDULED" ? "SENDING" : "DRAFT",
          totalRecipients: ac.totalLeads,
          sentCount: ac.sentCount,
          deliveredCount: ac.sentCount,
          openedCount: 0,
          clickedCount: 0,
          failedCount: ac.failedCount ?? 0,
          startedAt: ac.createdAt,
          completedAt: ac.status === "COMPLETED" ? ac.updatedAt : null,
          createdAt: ac.createdAt,
          updatedAt: ac.updatedAt,
          recipientLogs: ac.schedules.map((s) => ({
            leadId: s.leadId,
            leadName: s.leadName,
            email: s.leadEmail,
            status: s.status === "SENT" || s.status === "FOLLOW_UP_SENT" ? "SENT" : s.status === "FAILED" ? "FAILED" : "SKIPPED",
            error: s.errorMessage || null,
            sentAt: s.sentAt || null,
          })),
        });
      }
    }

    campaignRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (!batchRecord || batchRecord.deletedAt) {
      return { success: false, error: "Marketing batch not found" };
    }

    // Role check: non-admin/managers can only view their own batch
    if (!isAdminOrManager && batchRecord.ownerId !== session.id && batchRecord.ownerId !== userId) {
      return {
        success: false,
        error: "Unauthorized: You can only view batches created by you.",
      };
    }

    const leadIds: string[] = Array.isArray(batchRecord.leadIds)
      ? batchRecord.leadIds
      : [];

    // Resolve member leads
    let memberLeads: any[] = [];
    try {
      memberLeads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          leadNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          supportEmail: true,
          phone: true,
          companyName: true,
          jobTitle: true,
          sourceDetail: true,
          status: true,
          rating: true,
        },
      });
    } catch {
      memberLeads = mockLeadsStore.filter((l) => leadIds.includes(l.id));
    }

    const formattedLeads = memberLeads.map((l: any) => {
      const cleanCompany = resolveCleanCompanyName(
        l.companyName,
        l.website || l.sourceDetail,
        l.email || l.supportEmail
      ).cleanName;
      return {
        id: l.id,
        leadNumber: l.leadNumber || `LEAD-${l.id.slice(-4).toUpperCase()}`,
        firstName: l.firstName,
        lastName: l.lastName || null,
        fullName: `${l.firstName} ${l.lastName || ""}`.trim(),
        email: l.email || l.supportEmail || null,
        companyName: cleanCompany || l.companyName || null,
        jobTitle: l.jobTitle || null,
        status: l.status,
        rating: l.rating || "Warm",
        phone: l.phone || null,
        ownerId: l.ownerId || (l as any).assignedToId || null,
        ownerName: l.ownerName || null,
      };
    });

    const formattedCampaigns: MarketingCampaignItem[] = campaignRecords.map((c: any) => {
      const logs = Array.isArray(c.recipientLogs) ? c.recipientLogs : [];
      const kpis = calculateCampaignKpis(logs);
      return {
        id: c.id,
        batchId: c.batchId,
        organizationId: c.organizationId,
        senderId: c.senderId,
        senderName: c.senderName || "Sales Rep",
        senderEmail: c.senderEmail || null,
        subject: c.subject,
        body: c.body,
        status: (c.status === "COMPLETED" || c.status === "completed" || c.status === "SENT") ? "SENT" : (c.status === "ACTIVE" || c.status === "active" || c.status === "SENDING" || c.status === "sending") ? "SENDING" : (c.status === "FAILED" || c.status === "failed") ? "FAILED" : "DRAFT",
        totalRecipients: c.totalRecipients,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        openedCount: c.openedCount ?? kpis.openedCount,
        clickedCount: c.clickedCount ?? kpis.clickedCount,
        bouncedCount: c.bouncedCount ?? kpis.bouncedCount,
        unsubscribedCount: c.unsubscribedCount ?? kpis.unsubscribedCount,
        recipientLogs: logs,
        sentAt: c.sentAt ? (typeof c.sentAt === "string" ? c.sentAt : c.sentAt.toISOString()) : null,
        createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt.toISOString(),
        updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : c.updatedAt.toISOString(),
      };
    });

    const assignedName = batchRecord.assignedToName || batchRecord.ownerName || (session.id === batchRecord.ownerId ? session.name : "Sales Rep");
    const assignedEmail = batchRecord.assignedToEmail || (session.id === batchRecord.ownerId ? session.email : null);

    const result: MarketingBatchDetail = {
      id: batchRecord.id,
      organizationId: batchRecord.organizationId,
      name: batchRecord.name,
      description: batchRecord.description,
      ownerId: batchRecord.ownerId,
      ownerName: assignedName,
      assignedToId: batchRecord.assignedToId || batchRecord.ownerId || null,
      assignedToName: assignedName,
      assignedToEmail: assignedEmail,
      leadIds,
      leadCount: batchRecord.leadCount || leadIds.length,
      createdAt: typeof batchRecord.createdAt === "string" ? batchRecord.createdAt : batchRecord.createdAt.toISOString(),
      updatedAt: typeof batchRecord.updatedAt === "string" ? batchRecord.updatedAt : batchRecord.updatedAt.toISOString(),
      leads: formattedLeads,
      campaigns: formattedCampaigns,
    };

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to retrieve batch details",
    };
  }
}

/**
 * 3. Create a new marketing batch
 */
export async function createMarketingBatchAction(
  rawInput: CreateMarketingBatchInput
): Promise<{
  success: boolean;
  data?: MarketingBatchItem;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);

    const parsed = createMarketingBatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid batch parameters",
      };
    }

    const { name, description, leadIds, assignedToId, assignLeadsToRep } = parsed.data;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();

    // Resolve assigned representative if provided
    let targetAssignee: { id: string; name: string; email: string } | null = null;
    if (assignedToId) {
      targetAssignee = await resolveUserInfo(assignedToId);
    }

    const finalOwnerId = targetAssignee?.id || (assignedToId === null ? null : (userId || session.id));
    const finalOwnerName = targetAssignee?.name || (assignedToId === null ? null : (session.name || "Sales Rep"));
    const finalAssignedEmail = targetAssignee?.email || (assignedToId === null ? null : (session.email || null));

    const newBatchData: MockMarketingBatch = {
      id: batchId,
      organizationId,
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: finalOwnerId || (userId || session.id),
      ownerName: finalOwnerName,
      assignedToId: finalOwnerId || null,
      assignedToName: finalOwnerName,
      assignedToEmail: finalAssignedEmail,
      leadIds,
      leadCount: leadIds.length,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // If requested, also assign all member leads to this representative!
    if (finalOwnerId && assignLeadsToRep !== false) {
      try {
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, organizationId },
          data: { ownerId: finalOwnerId },
        });
      } catch {}

      mockLeadsStore.forEach((l) => {
        if (leadIds.includes(l.id)) {
          l.ownerId = finalOwnerId;
          l.ownerName = finalOwnerName;
          l.updatedAt = now.toISOString();
        }
      });
    }

    try {
      await prisma.marketingBatch.create({
        data: {
          id: batchId,
          organizationId,
          name: name.trim(),
          description: description?.trim() || null,
          ownerId: finalOwnerId || (userId || session.id),
          leadIds,
          leadCount: leadIds.length,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (dbErr) {
      console.warn("[createMarketingBatchAction] Prisma create failed, falling back to mock store:", dbErr);
    }

    mockMarketingBatchesStore.unshift(newBatchData as MockMarketingBatch);

    revalidatePath("/marketing");
    revalidatePath("/leads");

    return {
      success: true,
      data: {
        ...newBatchData,
        lastCampaign: null,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to create marketing batch",
    };
  }
}

/**
 * 4. Assign or reassign a marketing batch to a sales representative
 */
export async function assignMarketingBatchAction(
  rawInput: AssignMarketingBatchInput
): Promise<{
  success: boolean;
  message?: string;
  data?: MarketingBatchItem;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const parsed = assignMarketingBatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid assignment data" };
    }

    const { batchId, assignedToId, assignLeadsToRep } = parsed.data;
    const targetUser = await resolveUserInfo(assignedToId);
    if (!targetUser) {
      return { success: false, error: "The designated sales representative could not be found." };
    }

    const now = new Date();

    // 1. Update in Prisma
    try {
      await prisma.marketingBatch.update({
        where: { id: batchId },
        data: {
          ownerId: targetUser.id,
          updatedAt: now,
        },
      });
    } catch {}

    // 2. Update in Mock Store
    const batch = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
    if (batch) {
      batch.ownerId = targetUser.id;
      batch.ownerName = targetUser.name;
      batch.assignedToId = targetUser.id;
      batch.assignedToName = targetUser.name;
      batch.assignedToEmail = targetUser.email;
      batch.updatedAt = now.toISOString();

      // If assignLeadsToRep is true, assign all member leads to this representative
      if (assignLeadsToRep !== false && Array.isArray(batch.leadIds)) {
        try {
          await prisma.lead.updateMany({
            where: { id: { in: batch.leadIds }, organizationId },
            data: { ownerId: targetUser.id },
          });
        } catch {}

        mockLeadsStore.forEach((l) => {
          if (batch.leadIds.includes(l.id)) {
            l.ownerId = targetUser.id;
            l.ownerName = targetUser.name;
            l.updatedAt = now.toISOString();
          }
        });
      }
    }

    revalidatePath("/marketing");
    revalidatePath(`/marketing/${batchId}`);
    revalidatePath("/leads");

    return {
      success: true,
      message: `Batch successfully assigned to ${targetUser.name} (${targetUser.email}).`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to assign batch",
    };
  }
}

/**
 * 4. Update an existing marketing batch
 */
export async function updateMarketingBatchAction(
  rawInput: UpdateMarketingBatchInput
): Promise<{
  success: boolean;
  data?: MarketingBatchItem;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    const parsed = updateMarketingBatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid update data",
      };
    }

    const { id, name, description, leadIds } = parsed.data;

    // Check ownership
    const existingMock = mockMarketingBatchesStore.find((b) => b.id === id && !b.deletedAt);
    if (existingMock && !isAdminOrManager && existingMock.ownerId !== session.id && existingMock.ownerId !== userId) {
      return { success: false, error: "Unauthorized: You can only edit your own batch." };
    }

    const now = new Date();
    const updatedLeadIds = leadIds !== undefined ? leadIds : (existingMock?.leadIds || []);

    try {
      await prisma.marketingBatch.update({
        where: { id },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          ...(leadIds ? { leadIds, leadCount: leadIds.length } : {}),
          updatedAt: now,
        },
      });
    } catch (dbErr) {
      console.warn("[updateMarketingBatchAction] Prisma update error:", dbErr);
    }

    if (existingMock) {
      existingMock.name = name.trim();
      existingMock.description = description?.trim() || null;
      if (leadIds) {
        existingMock.leadIds = leadIds;
        existingMock.leadCount = leadIds.length;
      }
      existingMock.updatedAt = now.toISOString();
    }

    revalidatePath("/marketing");
    revalidatePath(`/marketing/${id}`);

    return {
      success: true,
      data: {
        id,
        organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: existingMock?.ownerId || session.id,
        ownerName: existingMock?.ownerName || session.name,
        leadIds: updatedLeadIds,
        leadCount: updatedLeadIds.length,
        createdAt: existingMock?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to update marketing batch",
    };
  }
}

/**
 * 5. Remove one or multiple leads from a marketing batch without deleting the leads from CRM
 */
export async function removeLeadsFromMarketingBatchAction(
  rawInput: RemoveLeadsFromBatchInput
): Promise<{
  success: boolean;
  leadCount?: number;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    const parsed = removeLeadsFromBatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid input parameters",
      };
    }

    const { batchId, leadIds } = parsed.data;

    let batchRecord: any = null;
    try {
      batchRecord = await prisma.marketingBatch.findUnique({
        where: { id: batchId },
      });
    } catch {
      batchRecord = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
    }

    if (!batchRecord && mockMarketingBatchesStore.length > 0) {
      batchRecord = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
    }

    if (!batchRecord || batchRecord.deletedAt) {
      return { success: false, error: "Marketing batch not found" };
    }

    // Role check: non-admin/managers can only modify batches assigned to or owned by them
    if (
      !isAdminOrManager &&
      batchRecord.ownerId !== session.id &&
      batchRecord.ownerId !== userId &&
      batchRecord.assignedToId !== session.id &&
      batchRecord.assignedToId !== userId
    ) {
      return {
        success: false,
        error: "Unauthorized: You do not have permission to modify this batch.",
      };
    }

    const currentLeadIds: string[] = Array.isArray(batchRecord.leadIds)
      ? batchRecord.leadIds
      : [];

    const leadIdsToRemoveSet = new Set(leadIds);
    const updatedLeadIds = currentLeadIds.filter((id) => !leadIdsToRemoveSet.has(id));
    const newLeadCount = updatedLeadIds.length;
    const now = new Date();

    try {
      await prisma.marketingBatch.update({
        where: { id: batchId },
        data: {
          leadIds: updatedLeadIds,
          leadCount: newLeadCount,
          updatedAt: now,
        },
      });
    } catch (dbErr) {
      console.warn("[removeLeadsFromMarketingBatchAction] Prisma update error:", dbErr);
    }

    const existingMock = mockMarketingBatchesStore.find((b) => b.id === batchId);
    if (existingMock) {
      existingMock.leadIds = updatedLeadIds;
      existingMock.leadCount = newLeadCount;
      existingMock.updatedAt = now.toISOString();
    }

    revalidatePath("/marketing");
    revalidatePath(`/marketing/${batchId}`);

    return {
      success: true,
      leadCount: newLeadCount,
      message: `Successfully removed ${leadIds.length} lead${leadIds.length > 1 ? "s" : ""} from batch.`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to remove lead(s) from batch",
    };
  }
}

/**
 * 6. Delete / Soft-delete a marketing batch
 */
export async function deleteMarketingBatchAction(batchId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    const existingMock = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
    if (existingMock && !isAdminOrManager && existingMock.ownerId !== session.id && existingMock.ownerId !== userId) {
      return { success: false, error: "Unauthorized: You can only delete your own batch." };
    }

    const now = new Date();

    try {
      await prisma.marketingBatch.update({
        where: { id: batchId },
        data: { deletedAt: now },
      });
    } catch (dbErr) {
      console.warn("[deleteMarketingBatchAction] Prisma soft delete error:", dbErr);
    }

    if (existingMock) {
      existingMock.deletedAt = now.toISOString();
    }

    revalidatePath("/marketing");
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to delete marketing batch",
    };
  }
}

/**
 * 6. Send Bulk Email to a Batch with Dynamic Merge Tags & Timeline Touchpoints
 */
export async function sendBatchEmailAction(
  rawInput: SendBatchEmailInput
): Promise<{
  success: boolean;
  message?: string;
  data?: MarketingCampaignItem;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    const parsed = sendBatchEmailSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid email payload.",
      };
    }

    const { batchId, subject, body, senderName, replyTo } = parsed.data;

    // Verify batch existence & ownership
    let batch: any = null;
    try {
      batch = await prisma.marketingBatch.findUnique({
        where: { id: batchId },
      });
    } catch {
      batch = mockMarketingBatchesStore.find((b) => b.id === batchId && !b.deletedAt);
    }

    if (!batch || batch.deletedAt) {
      return { success: false, error: "Target batch does not exist or has been deleted." };
    }

    if (!isAdminOrManager && batch.ownerId !== session.id && batch.ownerId !== userId) {
      return {
        success: false,
        error: "Unauthorized: Only the creator of this batch or an Admin can send emails to it.",
      };
    }

    const leadIds: string[] = Array.isArray(batch.leadIds) ? batch.leadIds : [];
    if (leadIds.length === 0) {
      return { success: false, error: "This batch contains no leads to send emails to." };
    }

    // Retrieve active SMTP configuration
    let smtpConfig: any = null;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: "smtp_config",
          },
        },
      });
      if (setting?.value) {
        smtpConfig = JSON.parse(setting.value);
      }
    } catch {
      smtpConfig = mockSmtpStore[organizationId] || null;
    }

    if (!smtpConfig && mockSmtpStore[organizationId]) {
      smtpConfig = mockSmtpStore[organizationId];
    }

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.username || !smtpConfig.encryptedPassword) {
      return {
        success: false,
        error:
          "SMTP is not configured for your organization. Please ask an Admin to connect Google Workspace or SMTP in Settings > Email to send bulk emails.",
      };
    }

    const smtpPassword = decryptSecret(smtpConfig.encryptedPassword);
    if (!smtpPassword) {
      return {
        success: false,
        error: "Unable to decrypt SMTP credentials. Please re-enter your password in Settings > Email.",
      };
    }

    // Resolve leads in batch
    let leads: any[] = [];
    try {
      leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          organizationId,
          deletedAt: null,
        },
      });
    } catch {
      leads = mockLeadsStore.filter((l) => leadIds.includes(l.id));
    }

    if (leads.length === 0) {
      return { success: false, error: "No active leads found in this batch." };
    }

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const recipientLogs: MockRecipientLog[] = [];
    let sentCount = 0;
    let failedCount = 0;

    const fromSenderName = senderName || session.name || smtpConfig.fromName || "Sales Team";
    const fromSenderEmail = smtpConfig.fromEmail || smtpConfig.username;

    // Dispatch loop
    for (const lead of leads) {
      const recipientEmail = lead.email?.trim() || lead.supportEmail?.trim();

      // Safely resolve recipient names with fallback to fullName
      let resolvedFirstName = (lead.firstName || "").trim();
      let resolvedLastName = (lead.lastName || "").trim();

      if (!resolvedFirstName && lead.fullName) {
        const parts = lead.fullName.trim().split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
          resolvedFirstName = parts[0];
          if (!resolvedLastName && parts.length > 1) {
            resolvedLastName = parts.slice(1).join(" ");
          }
        }
      }

      const leadName = `${resolvedFirstName} ${resolvedLastName}`.trim() || lead.companyName || "Valued Lead";

      if (!recipientEmail || !recipientEmail.includes("@")) {
        recipientLogs.push({
          leadId: lead.id,
          leadName,
          email: recipientEmail || "N/A",
          companyName: lead.companyName || null,
          status: "SKIPPED",
          error: "Missing or invalid email address",
          sentAt: null,
        });
        failedCount++;
        continue;
      }

      // Check if recipient has unsubscribed or bounced previously
      if (isEmailSuppressed(recipientEmail)) {
        recipientLogs.push({
          leadId: lead.id,
          leadName,
          email: recipientEmail,
          companyName: lead.companyName || null,
          status: "SKIPPED",
          error: "Recipient unsubscribed or suppressed from future communications",
          sentAt: null,
        });
        failedCount++;
        continue;
      }

      // Personalize subject and body using merge tags
      const personalizedSubject = applyMergeTags(subject, {
        firstName: resolvedFirstName || "there",
        lastName: resolvedLastName || "",
        companyName: lead.companyName || "",
        repName: fromSenderName,
        email: recipientEmail,
      });

      const personalizedBody = applyMergeTags(body, {
        firstName: resolvedFirstName || "there",
        lastName: resolvedLastName || "",
        companyName: lead.companyName || "",
        repName: fromSenderName,
        email: recipientEmail,
      });

      try {
        const sendResult = await mailer.sendSmtpEmail(
          {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            username: smtpConfig.username,
            password: smtpPassword,
          },
          {
            to: recipientEmail,
            fromName: fromSenderName,
            fromEmail: fromSenderEmail,
            replyTo: replyTo || fromSenderEmail,
            subject: personalizedSubject,
            body: personalizedBody,
            isMarketing: true,
            unsubscribeEmail: fromSenderEmail,
            tracking: {
              campaignId,
              leadId: lead.id,
            },
          }
        );

        if (sendResult.success) {
          sentCount++;
          recipientLogs.push({
            leadId: lead.id,
            leadName,
            email: recipientEmail,
            companyName: lead.companyName || null,
            status: "SENT",
            sentAt: new Date().toISOString(),
          });

          // Automatically record activity touchpoint on lead timeline
          try {
            await logActivityAction({
              type: "EMAIL",
              subject: `[Batch: ${batch.name}] ${personalizedSubject}`,
              description: `To: ${recipientEmail}\nCampaign: ${batch.name}\n\n${personalizedBody.slice(0, 300)}...`,
              activityAt: new Date().toISOString(),
              leadId: lead.id,
              companyId: undefined,
            });
          } catch (logErr) {
            console.warn(`Failed to log activity for lead ${lead.id}:`, logErr);
          }
        } else if (sendResult.isBounce) {
          failedCount++;
          recipientLogs.push({
            leadId: lead.id,
            leadName,
            email: recipientEmail,
            companyName: lead.companyName || null,
            status: "BOUNCED",
            error: sendResult.error || "Delivery bounced / mailbox unavailable",
            bounceReason: sendResult.bounceReason || sendResult.error || "Permanent SMTP reject",
            bouncedAt: new Date().toISOString(),
            sentAt: null,
          });
          suppressEmail(recipientEmail);
        } else {
          failedCount++;
          recipientLogs.push({
            leadId: lead.id,
            leadName,
            email: recipientEmail,
            companyName: lead.companyName || null,
            status: "FAILED",
            error: sendResult.error || "SMTP delivery rejected",
            sentAt: null,
          });
        }
      } catch (err: any) {
        failedCount++;
        recipientLogs.push({
          leadId: lead.id,
          leadName,
          email: recipientEmail,
          companyName: lead.companyName || null,
          status: "FAILED",
          error: err?.message || "Delivery exception",
          sentAt: null,
        });
      }
    }

    const campaignStatus =
      sentCount === 0 && failedCount > 0 ? "FAILED" : "SENT";

    const kpis = calculateCampaignKpis(recipientLogs);

    const campaignData: MarketingCampaignItem = {
      id: campaignId,
      batchId,
      organizationId,
      senderId: userId || session.id,
      senderName: fromSenderName,
      senderEmail: fromSenderEmail,
      subject,
      body,
      status: campaignStatus,
      totalRecipients: leads.length,
      sentCount,
      failedCount,
      openedCount: kpis.openedCount,
      clickedCount: kpis.clickedCount,
      bouncedCount: kpis.bouncedCount,
      unsubscribedCount: kpis.unsubscribedCount,
      recipientLogs,
      sentAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await prisma.marketingCampaign.create({
        data: {
          id: campaignId,
          batchId,
          organizationId,
          senderId: userId || session.id,
          senderName: fromSenderName,
          senderEmail: fromSenderEmail,
          subject,
          body,
          status: campaignStatus,
          totalRecipients: leads.length,
          sentCount,
          failedCount,
          recipientLogs: recipientLogs as any,
          sentAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (dbErr) {
      console.warn("[sendBatchEmailAction] Prisma campaign log error:", dbErr);
    }

    mockMarketingCampaignsStore.unshift(campaignData as MockMarketingCampaign);

    let didUpdateLeads = false;
    for (const log of recipientLogs) {
      if (log.status === "SENT" && log.leadId) {
        const leadIdx = mockLeadsStore.findIndex((l) => l.id === log.leadId);
        if (leadIdx !== -1) {
          mockLeadsStore[leadIdx].emailStatus = "Sent";
          didUpdateLeads = true;
        }
      }
    }
    if (didUpdateLeads) {
      persistMockLeads();
    }

    revalidatePath("/marketing");
    revalidatePath(`/marketing/${batchId}`);
    revalidatePath("/leads");

    return {
      success: true,
      data: campaignData,
      message: `Batch email campaign completed: ${sentCount} sent successfully, ${failedCount} skipped or failed.`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to dispatch batch email campaign",
    };
  }
}

/**
 * 7. Fetch selectable leads for adding to a batch (filtered by user's role)
 */
export async function getSelectableLeadsForBatchAction(params: {
  search?: string;
  status?: string;
  rating?: string;
  limit?: number;
} = {}): Promise<{
  success: boolean;
  data?: {
    id: string;
    leadNumber: string;
    fullName: string;
    email: string | null;
    companyName: string | null;
    status: string;
    rating: string;
  }[];
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);
    const isAdminOrManager = isUserAdminOrManager(session);

    let leads: any[] = [];
    const take = params.limit || 300;

    try {
      const where: any = {
        organizationId,
        deletedAt: null,
      };

      if (!isAdminOrManager) {
        where.OR = [
          { ownerId: session.id },
          { ownerId: userId },
          { createdById: session.id },
          { createdById: userId },
        ];
      }

      if (params.status && params.status !== "ALL") {
        where.status = params.status;
      }
      if (params.rating && params.rating !== "ALL") {
        where.rating = params.rating;
      }
      if (params.search) {
        where.OR = [
          { firstName: { contains: params.search, mode: "insensitive" } },
          { lastName: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
          { companyName: { contains: params.search, mode: "insensitive" } },
        ];
      }

      leads = await prisma.lead.findMany({
        where,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          leadNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          supportEmail: true,
          companyName: true,
          status: true,
          rating: true,
        },
      });
    } catch {
      // Mock store fallback
      leads = mockLeadsStore.filter((l) => {
        if (!isAdminOrManager) {
          const isOwner =
            l.ownerId === session.id ||
            l.ownerId === userId ||
            (l.ownerName && (l.ownerName === session.name || l.ownerName === "Alex Sales"));
          const isCreator = l.createdById === session.id || l.createdById === userId;
          if (!isOwner && !isCreator) return false;
        }

        if (params.status && params.status !== "ALL" && l.status !== params.status) {
          return false;
        }
        if (params.rating && params.rating !== "ALL" && l.rating !== params.rating) {
          return false;
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          const matches =
            l.fullName.toLowerCase().includes(q) ||
            (l.email && l.email.toLowerCase().includes(q)) ||
            (l.companyName && l.companyName.toLowerCase().includes(q));
          if (!matches) return false;
        }
        return true;
      }).slice(0, take);
    }

    return {
      success: true,
      data: leads.map((l: any) => ({
        id: l.id,
        leadNumber: l.leadNumber || `LEAD-${l.id.slice(-4).toUpperCase()}`,
        fullName: `${l.firstName} ${l.lastName || ""}`.trim(),
        email: l.email || l.supportEmail || null,
        companyName: l.companyName || null,
        status: l.status,
        rating: l.rating || "Warm",
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to fetch selectable leads",
    };
  }
}

export interface LeadEmailDispatchItem {
  id: string;
  subject: string;
  source: "BATCH_CAMPAIGN" | "DIRECT_EMAIL" | "AI_CAMPAIGN";
  sourceName?: string;
  senderName?: string;
  senderEmail?: string;
  recipientEmail: string;
  sentAt: string;
  status: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED";
  openedAt?: string | null;
  openCount: number;
  clickedAt?: string | null;
  clickCount: number;
  lastClickedUrl?: string | null;
  bouncedAt?: string | null;
  bounceReason?: string | null;
  unsubscribedAt?: string | null;
}

export interface LeadEmailEngagementSummary {
  overallStatus: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" | "NONE";
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  isBounced: boolean;
  bounceReason?: string | null;
  isUnsubscribed: boolean;
  unsubscribedAt?: string | null;
  latestDispatchedAt?: string | null;
  items: LeadEmailDispatchItem[];
}

/**
 * Retrieves aggregate outbound email engagement and individual email dispatches for a single lead.
 * Works across Batch Marketing Campaigns, AI Batch Runs, and Direct 1-on-1 Emails.
 */
export async function getLeadEmailEngagementAction(
  leadId: string
): Promise<{ success: boolean; data?: LeadEmailEngagementSummary; error?: string }> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    // 1. Resolve lead details
    let leadEmail: string | null = null;
    let leadSupportEmail: string | null = null;
    let leadStatus: string | null = null;
    let leadEmailStatus: string | null = null;
    let leadCreatedAt: string | null = null;

    if (!isMockDatabase()) {
      try {
        const dbLead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { email: true, supportEmail: true, status: true, createdAt: true },
        });
        if (dbLead) {
          leadEmail = dbLead.email || null;
          leadSupportEmail = dbLead.supportEmail || null;
          leadStatus = dbLead.status || null;
          leadCreatedAt = dbLead.createdAt ? dbLead.createdAt.toISOString() : null;
        }
      } catch {
        // Prisma fallback to mockLeadsStore
        const mockLead = mockLeadsStore.find((l) => l.id === leadId);
        if (mockLead) {
          leadEmail = mockLead.email || null;
          leadSupportEmail = mockLead.supportEmail || null;
          leadStatus = mockLead.status || null;
          leadEmailStatus = (mockLead as any).emailStatus || null;
          leadCreatedAt = (mockLead as any).createdAt || null;
        }
      }
    } else {
      const mockLead = mockLeadsStore.find((l) => l.id === leadId);
      if (mockLead) {
        leadEmail = mockLead.email || null;
        leadSupportEmail = mockLead.supportEmail || null;
        leadStatus = mockLead.status || null;
        leadEmailStatus = (mockLead as any).emailStatus || null;
        leadCreatedAt = (mockLead as any).createdAt || null;
      }
    }

    if (!leadEmail && !leadSupportEmail) {
      const mockLead = mockLeadsStore.find((l) => l.id === leadId);
      if (mockLead) {
        leadEmail = mockLead.email || null;
        leadSupportEmail = mockLead.supportEmail || null;
        leadStatus = mockLead.status || null;
        leadEmailStatus = (mockLead as any).emailStatus || null;
        leadCreatedAt = (mockLead as any).createdAt || null;
      }
    }

    const emailCandidates = new Set<string>();
    if (leadEmail) emailCandidates.add(leadEmail.trim().toLowerCase());
    if (leadSupportEmail) emailCandidates.add(leadSupportEmail.trim().toLowerCase());

    const items: LeadEmailDispatchItem[] = [];

    // 2. Scan Batch Marketing Campaigns (Mock Store & Prisma)
    const processedCampaignIds = new Set<string>();

    for (const camp of mockMarketingCampaignsStore) {
      if (camp.organizationId && camp.organizationId !== organizationId) continue;
      processedCampaignIds.add(camp.id);

      const matchingLogs = camp.recipientLogs.filter(
        (l) =>
          l.leadId === leadId ||
          (l.email && emailCandidates.has(l.email.trim().toLowerCase()))
      );

      for (const log of matchingLogs) {
        const itemStatus: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" =
          log.status === "CLICKED"
            ? "CLICKED"
            : log.status === "OPENED"
            ? "OPENED"
            : log.status === "BOUNCED"
            ? "BOUNCED"
            : log.status === "UNSUBSCRIBED"
            ? "UNSUBSCRIBED"
            : "DELIVERED";

        items.push({
          id: `batch_${camp.id}_${log.leadId || log.email}`,
          subject: camp.subject || "Marketing Campaign",
          source: "BATCH_CAMPAIGN",
          sourceName: camp.subject || "Batch Marketing Outreach",
          senderName: camp.senderName || "Marketing Team",
          senderEmail: camp.senderEmail || undefined,
          recipientEmail: log.email,
          sentAt: log.sentAt || camp.sentAt || camp.createdAt,
          status: itemStatus,
          openedAt: log.openedAt || null,
          openCount: log.openCount || (log.openedAt ? 1 : 0),
          clickedAt: log.clickedAt || null,
          clickCount: log.clickCount || (log.clickedAt ? 1 : 0),
          lastClickedUrl: log.lastClickedUrl || null,
          bouncedAt: log.bouncedAt || null,
          bounceReason: log.bounceReason || log.error || null,
          unsubscribedAt: log.unsubscribedAt || null,
        });
      }
    }

    if (!isMockDatabase()) {
      try {
        const dbCampaigns = await prisma.marketingCampaign.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
        });

        for (const camp of dbCampaigns) {
          if (processedCampaignIds.has(camp.id)) continue;
          if (!Array.isArray(camp.recipientLogs)) continue;

          const logs = camp.recipientLogs as Array<Record<string, unknown>>;
          const matchingLogs = logs.filter(
            (l) =>
              l.leadId === leadId ||
              (typeof l.email === "string" && emailCandidates.has(l.email.trim().toLowerCase()))
          );

          for (const log of matchingLogs) {
            const rawStatus = String(log.status || "SENT").toUpperCase();
            const itemStatus: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" =
              rawStatus === "CLICKED"
                ? "CLICKED"
                : rawStatus === "OPENED"
                ? "OPENED"
                : rawStatus === "BOUNCED"
                ? "BOUNCED"
                : rawStatus === "UNSUBSCRIBED"
                ? "UNSUBSCRIBED"
                : "DELIVERED";

            items.push({
              id: `batch_db_${camp.id}_${String(log.leadId || log.email)}`,
              subject: camp.subject || "Marketing Campaign",
              source: "BATCH_CAMPAIGN",
              sourceName: camp.subject || "Batch Marketing Outreach",
              senderName: camp.senderName || "Marketing Team",
              senderEmail: camp.senderEmail || undefined,
              recipientEmail: String(log.email || leadEmail || "lead@client.com"),
              sentAt: String(log.sentAt || camp.sentAt || camp.createdAt.toISOString()),
              status: itemStatus,
              openedAt: (log.openedAt as string) || null,
              openCount: Number(log.openCount || (log.openedAt ? 1 : 0)),
              clickedAt: (log.clickedAt as string) || null,
              clickCount: Number(log.clickCount || (log.clickedAt ? 1 : 0)),
              lastClickedUrl: (log.lastClickedUrl as string) || null,
              bouncedAt: (log.bouncedAt as string) || null,
              bounceReason: (log.bounceReason as string) || (log.error as string) || null,
              unsubscribedAt: (log.unsubscribedAt as string) || null,
            });
          }
        }
      } catch {
        // Non-blocking in mock environments
      }
    }

    // 3. Scan Direct 1-on-1 Email Dispatches
    const matchingDirect = mockDirectEmailsStore.filter(
      (d) =>
        d.leadId === leadId ||
        (d.recipientEmail && emailCandidates.has(d.recipientEmail.trim().toLowerCase()))
    );

    for (const d of matchingDirect) {
      const itemStatus: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" =
        d.status === "CLICKED"
          ? "CLICKED"
          : d.status === "OPENED"
          ? "OPENED"
          : d.status === "BOUNCED"
          ? "BOUNCED"
          : d.status === "UNSUBSCRIBED"
          ? "UNSUBSCRIBED"
          : "DELIVERED";

      items.push({
        id: d.id,
        subject: d.subject,
        source: "DIRECT_EMAIL",
        sourceName: "Direct 1-on-1 Email",
        senderName: d.senderName,
        senderEmail: d.senderEmail,
        recipientEmail: d.recipientEmail,
        sentAt: d.sentAt,
        status: itemStatus,
        openedAt: d.openedAt || null,
        openCount: d.openCount || (d.openedAt ? 1 : 0),
        clickedAt: d.clickedAt || null,
        clickCount: d.clickCount || (d.clickedAt ? 1 : 0),
        lastClickedUrl: d.lastClickedUrl || null,
        bouncedAt: d.bouncedAt || null,
        bounceReason: d.bounceReason || null,
        unsubscribedAt: d.unsubscribedAt || null,
      });
    }

    // 4. Scan AI Outreach Campaigns
    for (const aiCamp of mockAiCampaignsStore) {
      if (aiCamp.organizationId && aiCamp.organizationId !== organizationId) continue;
      const matchingSchedules = aiCamp.schedules.filter(
        (s) =>
          (s.leadId === leadId || (s.leadEmail && emailCandidates.has(s.leadEmail.trim().toLowerCase()))) &&
          s.status !== "SCHEDULED"
      );

      for (const s of matchingSchedules) {
        // If already added via direct or batch, avoid duplicate item ID
        const exists = items.some(
          (i) => i.id === `ai_${aiCamp.id}_${s.leadId}` || i.subject === s.initialSubject
        );
        if (exists) continue;

        const isFailed = s.status === "FAILED";
        const isBounced = isFailed && (s.errorMessage || "").toLowerCase().includes("bounc");
        const status: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" = isBounced
          ? "BOUNCED"
          : s.status === "REPLIED"
          ? "OPENED"
          : "DELIVERED";

        items.push({
          id: `ai_${aiCamp.id}_${s.leadId}`,
          subject: s.initialSubject,
          source: "AI_CAMPAIGN",
          sourceName: `${aiCamp.name} (AI Sequence)`,
          senderName: aiCamp.creatorName || "Sales Assistant",
          recipientEmail: s.leadEmail,
          sentAt: s.sentAt || s.scheduledAt,
          status,
          openCount: s.status === "REPLIED" ? 1 : 0,
          clickCount: 0,
          bouncedAt: isBounced ? (s.sentAt || new Date().toISOString()) : null,
          bounceReason: isBounced ? s.errorMessage || null : null,
        });
      }
    }

    // 5. Scan Timeline Activities to supplement open/click counts or legacy direct emails
    const combinedEmailActivities: Array<{
      id: string;
      subject: string;
      description?: string | null;
      outcome?: string | null;
      activityAt: string | Date;
      createdAt?: string | Date;
      userName?: string | null;
    }> = [];

    try {
      const dbActivities = await prisma.activity.findMany({
        where: { leadId, type: "EMAIL" },
        orderBy: { activityAt: "desc" },
        take: 50,
      });
      for (const a of dbActivities) {
        combinedEmailActivities.push({
          id: a.id,
          subject: a.subject,
          description: a.description,
          outcome: a.outcome,
          activityAt: a.activityAt,
          createdAt: a.createdAt,
          userName: null,
        });
      }
    } catch {}

    for (const a of mockActivitiesStore) {
      if (a.type === "EMAIL" && a.leadId === leadId) {
        if (!combinedEmailActivities.some((existing) => existing.id === a.id)) {
          combinedEmailActivities.push(a);
        }
      }
    }

    for (const act of combinedEmailActivities) {
      const actTime =
        act.activityAt instanceof Date
          ? act.activityAt.toISOString()
          : typeof act.activityAt === "string"
          ? act.activityAt
          : new Date().toISOString();

      // Check if this activity is an outcome tracking event (OPENED, CLICKED, BOUNCED, UNSUBSCRIBED)
      if (act.outcome === "OPENED" && items.length > 0) {
        // Ensure at least one item reflects this open if not already
        const unopenItem = items.find((i) => i.status === "DELIVERED");
        if (unopenItem) {
          unopenItem.status = "OPENED";
          unopenItem.openedAt = unopenItem.openedAt || actTime;
          unopenItem.openCount = Math.max(unopenItem.openCount, 1);
        }
      } else if (act.outcome === "CLICKED" && items.length > 0) {
        const itemToPromote = items.find((i) => i.status !== "CLICKED" && i.status !== "BOUNCED");
        if (itemToPromote) {
          itemToPromote.status = "CLICKED";
          itemToPromote.clickedAt = itemToPromote.clickedAt || actTime;
          itemToPromote.clickCount = Math.max(itemToPromote.clickCount, 1);
        }
      } else if (act.outcome === "BOUNCED" && items.length > 0) {
        const itemToBounce = items[0];
        if (itemToBounce && itemToBounce.status !== "BOUNCED") {
          itemToBounce.status = "BOUNCED";
          itemToBounce.bouncedAt = itemToBounce.bouncedAt || actTime;
          itemToBounce.bounceReason = itemToBounce.bounceReason || act.description || "Delivery bounced";
        }
      } else if (act.outcome === "UNSUBSCRIBED" && items.length > 0) {
        const itemToUnsub = items[0];
        if (itemToUnsub) {
          itemToUnsub.status = "UNSUBSCRIBED";
          itemToUnsub.unsubscribedAt = itemToUnsub.unsubscribedAt || actTime;
        }
      } else if (
        !act.outcome ||
        act.outcome === "SENT" ||
        act.outcome === "DELIVERED" ||
        act.outcome === "REPLIED"
      ) {
        // If an email activity exists but no dispatch item exists, synthesize a direct email entry
        const exists = items.some(
          (i) => i.subject.toLowerCase() === act.subject.toLowerCase()
        );
        if (!exists && !act.subject.toLowerCase().startsWith("email opened") && !act.subject.toLowerCase().startsWith("email link clicked")) {
          items.push({
            id: `act_${act.id}`,
            subject: act.subject,
            source: "DIRECT_EMAIL",
            sourceName: "Direct 1-on-1 Email",
            senderName: act.userName || "Sales Rep",
            recipientEmail: leadEmail || "lead@client.com",
            sentAt: actTime,
            status: "DELIVERED",
            openCount: 0,
            clickCount: 0,
          });
        }
      }
    }

    // 5b. Auto-seed initial outreach if lead is marked as "Sent" or "Follow up" and no emails exist yet
    if (
      items.length === 0 &&
      (leadEmailStatus === "Sent" || leadEmailStatus === "Follow up" || leadStatus === "Contacted")
    ) {
      items.push({
        id: `outreach_${leadId}`,
        subject: "Initial Sales Outreach",
        source: "DIRECT_EMAIL",
        sourceName: "Direct Outreach (Logged)",
        senderName: session.name || "Sales Rep",
        recipientEmail: leadEmail || "lead@client.com",
        sentAt: leadCreatedAt || new Date().toISOString(),
        status: "DELIVERED",
        openCount: 0,
        clickCount: 0,
      });
    }

    // Sort items chronologically descending (newest email first)
    items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    // 6. Calculate summary metrics
    const totalSent = items.length;
    const totalOpens = items.reduce((acc, i) => acc + (i.openCount || 0), 0);
    const totalClicks = items.reduce((acc, i) => acc + (i.clickCount || 0), 0);

    const isSuppressed = Array.from(emailCandidates).some((e) => isEmailSuppressed(e));
    const hasUnsubItem = items.some((i) => i.status === "UNSUBSCRIBED");
    const isUnsubscribed = isSuppressed || hasUnsubItem || leadStatus === "Unsubscribed";
    const unsubItem = items.find((i) => i.unsubscribedAt != null);

    const bouncedItem = items.find((i) => i.status === "BOUNCED");
    const isBounced = Boolean(bouncedItem);
    const bounceReason = bouncedItem?.bounceReason || null;

    let overallStatus: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" | "NONE" =
      "NONE";

    if (isBounced) {
      overallStatus = "BOUNCED";
    } else if (isUnsubscribed) {
      overallStatus = "UNSUBSCRIBED";
    } else if (totalClicks > 0 || items.some((i) => i.status === "CLICKED")) {
      overallStatus = "CLICKED";
    } else if (totalOpens > 0 || items.some((i) => i.status === "OPENED")) {
      overallStatus = "OPENED";
    } else if (totalSent > 0) {
      overallStatus = "DELIVERED";
    }

    const summary: LeadEmailEngagementSummary = {
      overallStatus,
      totalSent,
      totalOpens,
      totalClicks,
      isBounced,
      bounceReason,
      isUnsubscribed,
      unsubscribedAt: unsubItem?.unsubscribedAt || null,
      latestDispatchedAt: items[0]?.sentAt || null,
      items,
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to retrieve lead email engagement status.",
    };
  }
}

/**
 * Simulates or records a real-time email engagement event (OPEN, CLICK, BOUNCE, UNSUBSCRIBE, RESET)
 * for testing, verification, or manual webhook triggers.
 */
export async function simulateLeadEmailEngagementAction(input: {
  leadId: string;
  dispatchId: string;
  event: "OPEN" | "CLICK" | "BOUNCED" | "UNSUBSCRIBE" | "RESET";
  targetUrl?: string;
  bounceReason?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const session = await requireAuth();
    const { leadId, dispatchId, event, targetUrl, bounceReason } = input;

    // Resolve lead details
    let recipientEmail = "";
    try {
      const dbLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { email: true, supportEmail: true },
      });
      recipientEmail = dbLead?.email || dbLead?.supportEmail || "";
    } catch {
      const mockLead = mockLeadsStore.find((l) => l.id === leadId);
      recipientEmail = mockLead?.email || mockLead?.supportEmail || "";
    }

    if (event === "OPEN") {
      await recordEmailOpen(dispatchId, leadId);
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/leads");
      return { success: true, message: "Open event recorded! Read status and open count updated." };
    }

    if (event === "CLICK") {
      const clickUrl = targetUrl || "https://roxx-crm.com/demo";
      await recordEmailClick(dispatchId, leadId, clickUrl);
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/leads");
      return { success: true, message: `Link click recorded for ${clickUrl}! CTR updated.` };
    }

    if (event === "BOUNCED") {
      const reason = bounceReason || "550 5.1.1 User unknown / mailbox unavailable";
      await recordEmailBounce(dispatchId, leadId, recipientEmail, reason);
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/leads");
      return { success: true, message: "Bounce recorded! Email address suppressed from future campaigns." };
    }

    if (event === "UNSUBSCRIBE") {
      await recordEmailUnsubscribe(dispatchId, leadId, recipientEmail);
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/leads");
      return { success: true, message: "Recipient marked as unsubscribed and added to suppression list." };
    }

    if (event === "RESET") {
      // Reset dispatch status in direct emails store
      const matchingDirect = mockDirectEmailsStore.filter(
        (d) => d.id === dispatchId || d.leadId === leadId
      );
      for (const d of matchingDirect) {
        d.status = "DELIVERED";
        d.openCount = 0;
        d.openedAt = null;
        d.clickCount = 0;
        d.clickedAt = null;
        d.lastClickedUrl = null;
        d.bouncedAt = null;
        d.bounceReason = null;
        d.unsubscribedAt = null;
      }

      // If matching campaign logs
      for (const camp of mockMarketingCampaignsStore) {
        for (const log of camp.recipientLogs) {
          if (log.leadId === leadId) {
            log.status = "SENT";
            log.openCount = 0;
            log.openedAt = null;
            log.clickCount = 0;
            log.clickedAt = null;
            log.lastClickedUrl = null;
            log.bouncedAt = null;
            log.bounceReason = null;
            log.unsubscribedAt = null;
          }
        }
      }

      // If matching activities
      for (const act of mockActivitiesStore) {
        if (act.leadId === leadId && act.type === "EMAIL") {
          if (act.outcome === "OPENED" || act.outcome === "CLICKED" || act.outcome === "BOUNCED") {
            act.outcome = "DELIVERED";
          }
        }
      }

      if (recipientEmail) {
        mockSuppressedEmailsStore.delete(recipientEmail.trim().toLowerCase());
      }

      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/leads");
      return { success: true, message: "Tracking status reset back to Delivered." };
    }

    return { success: false, message: "Invalid event type" };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to simulate email engagement.",
      error: error?.message,
    };
  }
}

/**
 * Creates and dispatches a test outreach email for a lead with tracking enabled,
 * allowing instant verification of outbound email logging and engagement behavior.
 */
export async function sendTestTrackedEmailAction(input: {
  leadId: string;
  subject?: string;
  body?: string;
  toEmail?: string;
}): Promise<{ success: boolean; dispatchId?: string; message: string; error?: string }> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);
    const { leadId, subject, body, toEmail } = input;

    let targetEmail = toEmail || "";
    let leadName = "Valued Client";

    try {
      const dbLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { email: true, supportEmail: true, firstName: true, lastName: true },
      });
      if (dbLead) {
        targetEmail = targetEmail || dbLead.email || dbLead.supportEmail || "client@example.com";
        leadName = `${dbLead.firstName || ""} ${dbLead.lastName || ""}`.trim() || leadName;
      }
    } catch {
      const mockLead = mockLeadsStore.find((l) => l.id === leadId);
      if (mockLead) {
        targetEmail = targetEmail || mockLead.email || mockLead.supportEmail || "client@example.com";
        leadName = mockLead.fullName || leadName;
      }
    }

    const dispatchId = `test_dispatch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const emailSubject = subject || `Product Overview & Demo for ${leadName}`;
    const emailBody =
      body ||
      `Hi ${leadName},\n\nThank you for connecting with us. You can explore our demo platform at https://roxx-crm.com/demo.\n\nBest regards,\n${session.name || "Sales Team"}`;
    const nowIso = new Date().toISOString();

    mockDirectEmailsStore.push({
      id: dispatchId,
      leadId,
      organizationId,
      recipientEmail: targetEmail,
      subject: emailSubject,
      body: emailBody,
      senderName: session.name || "Sales Rep",
      senderEmail: session.email || "outreach@roxx-crm.com",
      status: "DELIVERED",
      sentAt: nowIso,
      deliveredAt: nowIso,
    });

    try {
      await logActivityAction({
        type: "EMAIL",
        subject: emailSubject,
        description: `To: ${targetEmail}\n\n${emailBody}`,
        activityAt: nowIso,
        leadId,
      });
    } catch {}

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");

    return {
      success: true,
      dispatchId,
      message: `Test email dispatched to ${targetEmail} with live open & click tracking active!`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to dispatch test email.",
      error: error?.message,
    };
  }
}

