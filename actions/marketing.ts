"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockLeadsStore,
  mockSmtpStore,
  MockMarketingBatch,
  MockMarketingCampaign,
  MockRecipientLog,
} from "@/lib/db/mock-store";
import { decryptSecret } from "@/lib/crypto/encryption";
import * as mailer from "@/lib/email/mailer";
import { applyMergeTags } from "@/lib/templates/email-templates";
import { logActivityAction } from "@/actions/activities";
import {
  createMarketingBatchSchema,
  CreateMarketingBatchInput,
  updateMarketingBatchSchema,
  UpdateMarketingBatchInput,
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
        const lastCampaign = b.campaigns[0]
          ? {
              ...b.campaigns[0],
              sentAt: b.campaigns[0].sentAt ? b.campaigns[0].sentAt.toISOString() : null,
            }
          : null;

        return {
          id: b.id,
          organizationId: b.organizationId,
          name: b.name,
          description: b.description,
          ownerId: b.ownerId,
          ownerName: session.id === b.ownerId ? session.name : "Sales Rep",
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

        const last = campaigns[0]
          ? {
              id: campaigns[0].id,
              subject: campaigns[0].subject,
              sentAt: campaigns[0].sentAt || null,
              status: campaigns[0].status,
              sentCount: campaigns[0].sentCount,
              failedCount: campaigns[0].failedCount,
              totalRecipients: campaigns[0].totalRecipients,
            }
          : null;

        return {
          id: b.id,
          organizationId: b.organizationId,
          name: b.name,
          description: b.description,
          ownerId: b.ownerId,
          ownerName: b.ownerName || (session.id === b.ownerId ? session.name : "Sales Rep"),
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
          status: true,
          rating: true,
        },
      });
    } catch {
      memberLeads = mockLeadsStore.filter((l) => leadIds.includes(l.id));
    }

    const formattedLeads = memberLeads.map((l: any) => ({
      id: l.id,
      leadNumber: l.leadNumber || `LEAD-${l.id.slice(-4).toUpperCase()}`,
      firstName: l.firstName,
      lastName: l.lastName || null,
      fullName: `${l.firstName} ${l.lastName || ""}`.trim(),
      email: l.email || l.supportEmail || null,
      companyName: l.companyName || null,
      jobTitle: l.jobTitle || null,
      status: l.status,
      rating: l.rating || "Warm",
      phone: l.phone || null,
    }));

    const formattedCampaigns: MarketingCampaignItem[] = campaignRecords.map((c: any) => ({
      id: c.id,
      batchId: c.batchId,
      organizationId: c.organizationId,
      senderId: c.senderId,
      senderName: c.senderName || "Sales Rep",
      senderEmail: c.senderEmail || null,
      subject: c.subject,
      body: c.body,
      status: c.status,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      recipientLogs: Array.isArray(c.recipientLogs) ? c.recipientLogs : [],
      sentAt: c.sentAt ? (typeof c.sentAt === "string" ? c.sentAt : c.sentAt.toISOString()) : null,
      createdAt: typeof c.createdAt === "string" ? c.createdAt : c.createdAt.toISOString(),
      updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : c.updatedAt.toISOString(),
    }));

    const result: MarketingBatchDetail = {
      id: batchRecord.id,
      organizationId: batchRecord.organizationId,
      name: batchRecord.name,
      description: batchRecord.description,
      ownerId: batchRecord.ownerId,
      ownerName: batchRecord.ownerName || (session.id === batchRecord.ownerId ? session.name : "Sales Rep"),
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

    const { name, description, leadIds } = parsed.data;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();

    const newBatchData = {
      id: batchId,
      organizationId,
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: userId || session.id,
      ownerName: session.name || "Sales Rep",
      leadIds,
      leadCount: leadIds.length,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await prisma.marketingBatch.create({
        data: {
          id: batchId,
          organizationId,
          name: name.trim(),
          description: description?.trim() || null,
          ownerId: userId || session.id,
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
 * 5. Delete / Soft-delete a marketing batch
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
