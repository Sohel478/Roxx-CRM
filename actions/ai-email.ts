"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockLeadsStore,
  mockUsersStore,
  mockActivitiesStore,
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockSmtpStore,
  mockAiCampaignsStore,
  mockAiConfigsStore,
  MockMarketingCampaign,
  MockAiCampaign,
  MockAiLeadSchedule,
  MockAiConfig,
} from "@/lib/db/mock-store";
import { decryptSecret } from "@/lib/crypto/encryption";
import * as mailer from "@/lib/email/mailer";
import {
  generatePersonalizedLeadEmail,
  buildLeadResearchBrief,
  LeadResearchContext,
  AiEmailSuggestion,
} from "@/lib/ai/lead-researcher";
import {
  studyMarketingBatch,
  BatchStudyConfig,
  BatchStudyResult,
  BatchStudyLeadInput,
} from "@/lib/ai/batch-study-engine";
import { analyzeEmailDeliverability } from "@/lib/email/deliverability-analyzer";
import { logActivityAction } from "@/actions/activities";
import {
  aiStudyBatchSchema,
  AiStudyBatchInput,
  aiScheduleBatchSchema,
  AiScheduleBatchInput,
  aiLeadEmailGenerateSchema,
  AiLeadEmailGenerateInput,
  aiConfigSchema,
  AiConfigInput,
} from "@/lib/validations/marketing";

/**
 * 1. Generate an intelligent research brief & suggested email for an individual lead
 */
export async function generateLeadAiEmailAction(
  input: AiLeadEmailGenerateInput
): Promise<{
  success: boolean;
  data?: {
    researchBrief: any;
    suggestion: AiEmailSuggestion;
    deliverability: any;
  };
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const parsed = aiLeadEmailGenerateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    }

    const { leadId, objective, tone, customInstruction, valueProposition } = parsed.data;

    // Fetch lead details
    let lead: any = null;
    try {
      lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });
    } catch {
      lead = mockLeadsStore.find((l) => l.id === leadId);
    }

    if (!lead && mockLeadsStore.length > 0) {
      lead = mockLeadsStore.find((l) => l.id === leadId);
    }

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    // Fetch past activities
    let pastActivitiesSummary = "";
    try {
      const activities = await prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 3,
      });
      if (activities.length > 0) {
        pastActivitiesSummary = activities
          .map((a) => `[${a.type}]: ${a.subject} (${a.description || ""})`)
          .join(" | ");
      }
    } catch {
      const mockActs = mockActivitiesStore.filter((a) => a.leadId === leadId).slice(0, 3);
      if (mockActs.length > 0) {
        pastActivitiesSummary = mockActs
          .map((a) => `[${a.type}]: ${a.subject} (${a.description || ""})`)
          .join(" | ");
      }
    }

    // Strict Guardrail: Lead must be assigned to an active sales representative
    const assignedRepId = lead.ownerId || (lead as any).assignedToId;
    if (!assignedRepId) {
      return {
        success: false,
        error:
          "Cannot generate AI email: This lead is unassigned. Please assign an owner or sales representative to this lead before AI can research and email them.",
      };
    }

    let repName = session.name || "Sales Representative";
    let repEmail = session.email || "";

    if (assignedRepId && assignedRepId !== session.id) {
      const u = mockUsersStore.find((user) => user.id === assignedRepId);
      if (u) {
        repName = u.name;
        repEmail = u.email;
      }
    }

    // Fetch AI config
    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const context: LeadResearchContext = {
      leadId: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      companyName: lead.companyName,
      jobTitle: lead.jobTitle,
      email: lead.email || lead.supportEmail,
      phone: lead.phone,
      customerLinkedin: lead.customerLinkedin,
      companyLinkedin: lead.companyLinkedin,
      website: lead.website,
      source: lead.source,
      sourceDetail: lead.sourceDetail,
      rating: lead.rating,
      description: lead.description,
      companyIndustry: lead.industry,
      repName,
      repEmail,
      organizationName: configData?.companyMatrix?.companyName || session.organizationName || "Roxx CRM",
      pastActivitiesSummary,
      companyMatrix: configData?.companyMatrix,
    };

    const brief = buildLeadResearchBrief(context);
    const suggestion = await generatePersonalizedLeadEmail(context, {
      objective: objective as any,
      tone: tone as any,
      customInstruction,
      valueProposition: valueProposition || configData?.defaultCompanyPitch || configData?.companyMatrix?.elevatorPitch || undefined,
      apiKey: configData?.apiKey || undefined,
      aiProvider: configData?.aiProvider || "builtin",
    });

    const deliverability = analyzeEmailDeliverability({
      subject: suggestion.subject,
      body: suggestion.body,
    });

    return {
      success: true,
      data: {
        researchBrief: brief,
        suggestion,
        deliverability,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to generate AI email for lead",
    };
  }
}

/**
 * 2. Study all leads in a marketing batch one-by-one and generate individual tailored emails
 */
export async function studyMarketingBatchAiAction(
  input: AiStudyBatchInput
): Promise<{
  success: boolean;
  data?: BatchStudyResult;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const parsed = aiStudyBatchSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid batch parameters" };
    }

    const {
      batchId,
      objective,
      tone,
      valueProposition,
      customInstruction,
      enableFollowUp,
      followUpDays,
    } = parsed.data;

    // Fetch batch
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

    if (!batchRecord) {
      return { success: false, error: "Marketing batch not found" };
    }

    // Strict Guardrail: Batch must be assigned to an active sales representative
    const assignedRepId = batchRecord.assignedToId || batchRecord.ownerId;
    if (!assignedRepId) {
      return {
        success: false,
        error:
          "Cannot study batch: This batch is not assigned to any sales representative. You must assign a team member to do the job before AI can study or email leads.",
      };
    }

    let assignedRepName = batchRecord.assignedToName || batchRecord.ownerName || "";
    let assignedRepEmail = batchRecord.assignedToEmail || "";

    if (!assignedRepName || !assignedRepEmail) {
      const u = mockUsersStore.find((user) => user.id === assignedRepId);
      if (u) {
        if (!assignedRepName) assignedRepName = u.name;
        if (!assignedRepEmail) assignedRepEmail = u.email;
      } else if (session.id === assignedRepId) {
        if (!assignedRepName) assignedRepName = session.name;
        if (!assignedRepEmail) assignedRepEmail = session.email;
      }
    }

    const leadIds: string[] = Array.isArray(batchRecord.leadIds)
      ? batchRecord.leadIds
      : [];

    if (leadIds.length === 0) {
      return { success: false, error: "The selected batch has no leads to study" };
    }

    // Resolve leads
    let memberLeads: any[] = [];
    try {
      memberLeads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          organizationId,
          deletedAt: null,
        },
      });
    } catch {
      memberLeads = mockLeadsStore.filter((l) => leadIds.includes(l.id));
    }

    if (memberLeads.length === 0 && mockLeadsStore.length > 0) {
      memberLeads = mockLeadsStore.filter((l) => leadIds.includes(l.id));
    }

    const leadsForStudy: BatchStudyLeadInput[] = memberLeads.map((l: any) => ({
      id: l.id,
      leadNumber: l.leadNumber,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email || l.supportEmail,
      companyName: l.companyName,
      jobTitle: l.jobTitle,
      customerLinkedin: l.customerLinkedin,
      companyLinkedin: l.companyLinkedin,
      website: l.website,
      description: l.description,
      industry: l.industry,
      phone: l.phone,
      rating: l.rating,
    }));

    const aiConfig = await getAiConfigAction();
    const configData = aiConfig.data;

    const config: BatchStudyConfig = {
      batchId,
      objective: objective as any,
      tone: tone as any,
      valueProposition: valueProposition || configData?.defaultCompanyPitch || configData?.companyMatrix?.elevatorPitch || undefined,
      customInstruction,
      repName: assignedRepName || session.name || "Sales Rep",
      repEmail: assignedRepEmail || session.email || "",
      organizationName: configData?.companyMatrix?.companyName || session.organizationName || "Roxx CRM",
      enableFollowUp,
      followUpDays,
      companyMatrix: configData?.companyMatrix,
      aiProvider: configData?.aiProvider || "builtin",
      apiKey: configData?.apiKey || null,
    };

    const studyResult = await studyMarketingBatch(leadsForStudy, config);

    return {
      success: true,
      data: studyResult,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to study marketing batch leads",
    };
  }
}

/**
 * 3. Schedule an AI Batch Campaign with staggered delivery and automated follow-up cadences
 */
export async function scheduleAiBatchCampaignAction(
  input: AiScheduleBatchInput
): Promise<{
  success: boolean;
  data?: {
    campaignId: string;
    totalScheduled: number;
    firstSendAt: string;
    followUpEnabled: boolean;
  };
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);

    const parsed = aiScheduleBatchSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid schedule parameters" };
    }

    const {
      batchId,
      campaignName,
      objective,
      tone,
      startDate,
      pacingMinutes,
      enableFollowUp,
      followUpDays,
      leads,
    } = parsed.data;

    let batchName = "Marketing Batch";
    const batch = mockMarketingBatchesStore.find((b) => b.id === batchId);
    if (batch) batchName = batch.name;

    const assignedRepId = batch?.assignedToId || batch?.ownerId || userId || session.id;
    const assignedRepName = batch?.assignedToName || batch?.ownerName || session.name || "Sales Rep";

    const campaignId = `aicamp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseStartTime = startDate === "now" ? Date.now() : new Date(startDate).getTime();

    const schedules: MockAiLeadSchedule[] = leads.map((leadItem, index) => {
      const scheduledTime = new Date(baseStartTime + index * pacingMinutes * 60 * 1000).toISOString();
      const followUpTime = enableFollowUp
        ? new Date(
            baseStartTime + index * pacingMinutes * 60 * 1000 + followUpDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;

      return {
        id: `aisched_${Date.now()}_${index}`,
        campaignId,
        leadId: leadItem.leadId,
        leadName: leadItem.leadName,
        leadEmail: leadItem.leadEmail,
        companyName: leadItem.companyName,
        jobTitle: leadItem.jobTitle || null,
        initialSubject: leadItem.initialSubject,
        initialBody: leadItem.initialBody,
        status: "SCHEDULED",
        scheduledAt: scheduledTime,
        followUpSubject: leadItem.followUpSubject || null,
        followUpBody: leadItem.followUpBody || null,
        followUpScheduledAt: followUpTime,
      };
    });

    const newCampaign: MockAiCampaign = {
      id: campaignId,
      organizationId,
      batchId,
      batchName,
      name: campaignName,
      creatorId: assignedRepId,
      creatorName: assignedRepName,
      objective,
      tone,
      status: "SCHEDULED",
      totalLeads: schedules.length,
      sentCount: 0,
      repliedCount: 0,
      followUpCount: 0,
      pacingMinutes,
      enableFollowUp,
      followUpDays,
      scheduledStartDate: new Date(baseStartTime).toISOString(),
      schedules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockAiCampaignsStore.unshift(newCampaign);

    // Sync into mockMarketingCampaignsStore as well so it appears in MarketingBatchDetailPage and MarketingPage
    const initialMarketingCampaign: MockMarketingCampaign = {
      id: campaignId,
      batchId,
      organizationId,
      senderId: assignedRepId,
      senderName: assignedRepName,
      senderEmail: batch?.assignedToEmail || session.email || "",
      subject: leads[0]?.initialSubject || campaignName,
      body: leads[0]?.initialBody || "",
      status: "SENDING",
      totalRecipients: leads.length,
      sentCount: 0,
      failedCount: 0,
      recipientLogs: leads.map((l) => ({
        leadId: l.leadId,
        leadName: l.leadName,
        email: l.leadEmail,
        companyName: l.companyName,
        status: "SKIPPED",
        sentAt: null,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentAt: null,
    };
    mockMarketingCampaignsStore.unshift(initialMarketingCampaign);

    // If scheduled for 'now', trigger queue processing immediately right inside this action!
    if (startDate === "now") {
      try {
        await processAiQueueInternal(organizationId, campaignId);
      } catch (err) {
        console.error("Error executing immediate queue send:", err);
      }
    }

    revalidatePath("/marketing");
    revalidatePath(`/marketing/${batchId}`);

    return {
      success: true,
      data: {
        campaignId,
        totalScheduled: schedules.length,
        firstSendAt: schedules[0]?.scheduledAt || new Date().toISOString(),
        followUpEnabled: enableFollowUp,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to schedule AI campaign",
    };
  }
}

/**
 * Internal worker for processing due scheduled AI emails
 */
export async function processAiQueueInternal(
  organizationId: string,
  targetCampaignId?: string
): Promise<{
  processedCount: number;
  sentInitialCount: number;
  sentFollowUpCount: number;
  repliesDetectedCount: number;
}> {
  const now = Date.now();
  let sentInitialCount = 0;
  let sentFollowUpCount = 0;
  let repliesDetectedCount = 0;

  // Fetch tenant's SMTP configuration
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

  let password = "";
  if (smtpConfig?.encryptedPassword) {
    try {
      password = decryptSecret(smtpConfig.encryptedPassword);
    } catch {
      password = "";
    }
  }

  const campaignsToProcess = mockAiCampaignsStore.filter((c) => {
    if (c.organizationId !== organizationId) return false;
    if (targetCampaignId && c.id !== targetCampaignId) return false;
    return c.status === "SCHEDULED" || c.status === "ACTIVE";
  });

  for (const campaign of campaignsToProcess) {
    campaign.status = "ACTIVE";
    const campaignInMarketing = mockMarketingCampaignsStore.find((c) => c.id === campaign.id);

    for (const item of campaign.schedules) {
      const scheduledTimeMs = new Date(item.scheduledAt).getTime();

      // 1. Initial email dispatch
      if (item.status === "SCHEDULED" && scheduledTimeMs <= now) {
        let sentSuccess = false;
        let errorMessage: string | null = null;

        if (smtpConfig && smtpConfig.host && smtpConfig.username && password) {
          const sendRes = await mailer.sendSmtpEmail(
            {
              host: smtpConfig.host,
              port: smtpConfig.port,
              secure: smtpConfig.secure,
              username: smtpConfig.username,
              password,
            },
            {
              to: item.leadEmail,
              fromName: campaign.creatorName || smtpConfig.fromName,
              fromEmail: smtpConfig.fromEmail || smtpConfig.username,
              subject: item.initialSubject,
              body: item.initialBody,
              isMarketing: true,
              unsubscribeEmail: smtpConfig.fromEmail || smtpConfig.username,
            }
          );

          if (sendRes.success) {
            sentSuccess = true;
          } else {
            errorMessage = sendRes.error || "SMTP send failed";
          }
        } else {
          // Simulated send if live SMTP not configured
          sentSuccess = true;
        }

        if (sentSuccess) {
          item.status = campaign.enableFollowUp ? "AWAITING_REPLY" : "SENT";
          item.sentAt = new Date().toISOString();
          campaign.sentCount += 1;
          sentInitialCount += 1;

          // Log to Lead Activity timeline in mock store & database
          mockActivitiesStore.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            organizationId,
            type: "EMAIL",
            subject: item.initialSubject,
            description: `[AI Outreach]: Delivered initial personalized email to ${item.leadEmail}.\n\n${item.initialBody}`,
            leadId: item.leadId,
            leadName: item.leadName,
            companyId: null,
            companyName: item.companyName || null,
            contactId: null,
            contactName: null,
            opportunityId: null,
            opportunityName: null,
            userId: campaign.creatorId || "system",
            userName: campaign.creatorName || "AI Campaign Assistant",
            activityAt: new Date().toISOString(),
            durationMinutes: null,
            outcome: "SENT",
            createdAt: new Date().toISOString(),
          });

          try {
            let dbUserId = campaign.creatorId || "system";
            const firstOrgUser = await prisma.user.findFirst({
              where: { organizationId },
              select: { id: true },
            });
            if (firstOrgUser) dbUserId = firstOrgUser.id;

            await prisma.activity.create({
              data: {
                organizationId,
                type: "EMAIL",
                subject: item.initialSubject,
                description: `[AI Outreach]: Delivered initial personalized email to ${item.leadEmail}.\n\n${item.initialBody}`,
                leadId: item.leadId,
                userId: dbUserId,
                activityAt: new Date(),
                outcome: "SENT",
              },
            });
          } catch {}

          if (campaignInMarketing) {
            campaignInMarketing.sentCount = campaign.sentCount;
            const log = campaignInMarketing.recipientLogs.find((l) => l.leadId === item.leadId);
            if (log) {
              log.status = "SENT";
              log.sentAt = item.sentAt;
            }
          }
        } else {
          item.status = "FAILED";
          item.errorMessage = errorMessage;
          if (campaignInMarketing) {
            campaignInMarketing.failedCount += 1;
            const log = campaignInMarketing.recipientLogs.find((l) => l.leadId === item.leadId);
            if (log) {
              log.status = "FAILED";
              log.error = errorMessage;
            }
          }
        }
      }

      // 2. Automated Follow-Up Check
      if (item.status === "AWAITING_REPLY" && campaign.enableFollowUp && item.followUpScheduledAt) {
        const followUpTimeMs = new Date(item.followUpScheduledAt).getTime();

        // Check if lead has replied in CRM
        const replyActivity = mockActivitiesStore.find(
          (a) => a.leadId === item.leadId && a.outcome === "REPLY_RECEIVED"
        );

        if (replyActivity) {
          item.status = "REPLIED";
          item.repliedAt = replyActivity.activityAt || new Date().toISOString();
          campaign.repliedCount += 1;
          repliesDetectedCount += 1;
          continue;
        }

        // If due and not replied, send Step 2 follow-up
        if (followUpTimeMs <= now && item.followUpSubject && item.followUpBody) {
          let sentFollowUp = false;
          if (smtpConfig && smtpConfig.host && smtpConfig.username && password) {
            const sendRes = await mailer.sendSmtpEmail(
              {
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                username: smtpConfig.username,
                password,
              },
              {
                to: item.leadEmail,
                fromName: campaign.creatorName || smtpConfig.fromName,
                fromEmail: smtpConfig.fromEmail || smtpConfig.username,
                subject: item.followUpSubject,
                body: item.followUpBody,
                isMarketing: true,
                unsubscribeEmail: smtpConfig.fromEmail || smtpConfig.username,
              }
            );
            if (sendRes.success) sentFollowUp = true;
          } else {
            sentFollowUp = true;
          }

          if (sentFollowUp) {
            item.status = "FOLLOW_UP_SENT";
            item.followUpSentAt = new Date().toISOString();
            campaign.followUpCount += 1;
            sentFollowUpCount += 1;

            mockActivitiesStore.push({
              id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              organizationId,
              type: "EMAIL",
              subject: item.followUpSubject,
              description: `[AI Cadence Follow-Up]: Dispatched automated Step 2 follow-up email to ${item.leadEmail}.\n\n${item.followUpBody}`,
              leadId: item.leadId,
              leadName: item.leadName,
              companyId: null,
              companyName: item.companyName || null,
              contactId: null,
              contactName: null,
              opportunityId: null,
              opportunityName: null,
              userId: campaign.creatorId || "system",
              userName: campaign.creatorName || "AI Campaign Assistant",
              activityAt: new Date().toISOString(),
              durationMinutes: null,
              outcome: "FOLLOW_UP_SENT",
              createdAt: new Date().toISOString(),
            });

            try {
              let dbUserId = campaign.creatorId || "system";
              const firstOrgUser = await prisma.user.findFirst({
                where: { organizationId },
                select: { id: true },
              });
              if (firstOrgUser) dbUserId = firstOrgUser.id;

              await prisma.activity.create({
                data: {
                  organizationId,
                  type: "EMAIL",
                  subject: item.followUpSubject,
                  description: `[AI Cadence Follow-Up]: Dispatched automated Step 2 follow-up email to ${item.leadEmail}.\n\n${item.followUpBody}`,
                  leadId: item.leadId,
                  userId: dbUserId,
                  activityAt: new Date(),
                  outcome: "FOLLOW_UP_SENT",
                },
              });
            } catch {}
          }
        }
      }
    }

    const allDone = campaign.schedules.every(
      (s) =>
        s.status === "SENT" ||
        s.status === "FOLLOW_UP_SENT" ||
        s.status === "REPLIED" ||
        s.status === "FAILED" ||
        s.status === "COMPLETED"
    );

    if (allDone) {
      campaign.status = "COMPLETED";
      if (campaignInMarketing) campaignInMarketing.status = "SENT";
    } else {
      if (campaignInMarketing) campaignInMarketing.status = "SENDING";
    }

    campaign.updatedAt = new Date().toISOString();
    if (campaignInMarketing) campaignInMarketing.updatedAt = new Date().toISOString();
  }

  revalidatePath("/marketing");
  revalidatePath("/leads");

  return {
    processedCount: sentInitialCount + sentFollowUpCount,
    sentInitialCount,
    sentFollowUpCount,
    repliesDetectedCount,
  };
}

/**
 * 4. Fetch all scheduled/active AI campaigns
 */
export async function getScheduledAiCampaignsAction(): Promise<{
  success: boolean;
  data?: MockAiCampaign[];
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const campaigns = mockAiCampaignsStore.filter(
      (c) => c.organizationId === organizationId
    );

    return { success: true, data: campaigns };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to load AI campaigns",
    };
  }
}

/**
 * 5. Process the scheduled queue (can be called by cron or on-demand trigger)
 * Dispatches due emails, verifies if leads have replied in CRM, and sends follow-ups.
 */
export async function processScheduledAiQueueAction(
  targetCampaignId?: string
): Promise<{
  success: boolean;
  data?: {
    processedCount: number;
    sentInitialCount: number;
    sentFollowUpCount: number;
    repliesDetectedCount: number;
  };
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);
    const data = await processAiQueueInternal(organizationId, targetCampaignId);
    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to process scheduled AI queue",
    };
  }
}

/**
 * 6. Get tenant AI configuration
 */
export async function getAiConfigAction(): Promise<{
  success: boolean;
  data?: MockAiConfig;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    let config: MockAiConfig | null = null;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: "ai_config",
          },
        },
      });
      if (setting?.value) {
        config = JSON.parse(setting.value);
      }
    } catch {
      config = mockAiConfigsStore[organizationId] || null;
    }

    if (!config) {
      config = mockAiConfigsStore[organizationId] || {
        organizationId,
        aiProvider: "builtin",
        apiKey: null,
        defaultCompanyPitch:
          "Helping growing teams streamline pipeline visibility, eliminate lost opportunities, and automate high-touch lead outreach.",
        defaultFollowUpDays: 3,
        defaultPacingMinutes: 2,
        updatedAt: new Date().toISOString(),
      };
    }

    // Ensure companyMatrix is resolved if saved under company_matrix setting
    if (!config.companyMatrix) {
      try {
        const matrixSetting = await prisma.systemSetting.findUnique({
          where: {
            organizationId_key: {
              organizationId,
              key: "company_matrix",
            },
          },
        });
        if (matrixSetting?.value) {
          config.companyMatrix = JSON.parse(matrixSetting.value);
        }
      } catch {
        // Fallback
      }
    }

    if (!config.companyMatrix && mockAiConfigsStore[organizationId]?.companyMatrix) {
      config.companyMatrix = mockAiConfigsStore[organizationId].companyMatrix;
    }

    return { success: true, data: config };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to retrieve AI configuration",
    };
  }
}

/**
 * 7. Save tenant AI configuration
 */
export async function saveAiConfigAction(
  input: AiConfigInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    const parsed = aiConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid AI configuration" };
    }

    const { aiProvider, apiKey, defaultCompanyPitch, defaultFollowUpDays, defaultPacingMinutes, companyMatrix } =
      parsed.data;

    let existingConfig: any = null;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: "ai_config",
          },
        },
      });
      if (setting?.value) {
        existingConfig = JSON.parse(setting.value);
      }
    } catch {
      existingConfig = mockAiConfigsStore[organizationId];
    }
    if (!existingConfig) {
      existingConfig = mockAiConfigsStore[organizationId];
    }

    const updatedConfig: MockAiConfig = {
      organizationId,
      aiProvider,
      apiKey: apiKey !== undefined ? (apiKey || null) : (existingConfig?.apiKey || null),
      companyMatrix: companyMatrix !== undefined ? (companyMatrix || null) : (existingConfig?.companyMatrix || null),
      defaultCompanyPitch: defaultCompanyPitch !== undefined ? (defaultCompanyPitch || null) : (existingConfig?.defaultCompanyPitch || null),
      defaultFollowUpDays: defaultFollowUpDays ?? existingConfig?.defaultFollowUpDays ?? 3,
      defaultPacingMinutes: defaultPacingMinutes ?? existingConfig?.defaultPacingMinutes ?? 2,
      updatedAt: new Date().toISOString(),
    };

    try {
      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: "ai_config",
          },
        },
        create: {
          organizationId,
          key: "ai_config",
          value: JSON.stringify(updatedConfig),
        },
        update: {
          value: JSON.stringify(updatedConfig),
        },
      });
    } catch {
      mockAiConfigsStore[organizationId] = updatedConfig;
    }

    mockAiConfigsStore[organizationId] = updatedConfig;
    revalidatePath("/settings");

    return {
      success: true,
      message: "AI & Intelligence settings updated successfully.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to save AI configuration",
    };
  }
}

/**
 * 8. Test AI provider connection and API key validity
 */
export async function testAiConnectionAction(input: {
  provider: "builtin" | "openai" | "gemini";
  apiKey?: string | null;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAuth();

    const { provider, apiKey } = input;

    if (provider === "builtin") {
      return {
        success: true,
        message: "Built-in Neural Heuristic Engine is operational and ready.",
      };
    }

    const key = (apiKey || "").trim();
    if (!key) {
      return {
        success: false,
        error: `Please enter an API key for ${provider === "openai" ? "OpenAI" : "Google Gemini"} before testing.`,
      };
    }

    if (provider === "openai") {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
          },
        });

        if (res.ok) {
          return {
            success: true,
            message: "Successfully connected to OpenAI! Model access verified.",
          };
        }

        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || res.statusText;

        if (res.status === 401) {
          return {
            success: false,
            error: "Authentication failed (401): Invalid OpenAI API key.",
          };
        } else if (res.status === 429) {
          return {
            success: false,
            error: `OpenAI Rate Limit / Quota Exceeded (429): ${errMsg}`,
          };
        } else {
          return {
            success: false,
            error: `OpenAI Error (${res.status}): ${errMsg}`,
          };
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Network failure connecting to OpenAI: ${err.message || "Unknown error"}`,
        };
      }
    }

    if (provider === "gemini") {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          {
            method: "GET",
          }
        );

        if (res.ok) {
          return {
            success: true,
            message: "Successfully connected to Google Gemini! Model access verified.",
          };
        }

        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || res.statusText;

        return {
          success: false,
          error: `Gemini API Error (${res.status}): ${errMsg}`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Network failure connecting to Google Gemini: ${err.message || "Unknown error"}`,
        };
      }
    }

    return {
      success: false,
      error: "Unknown AI provider selected.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to test AI connection",
    };
  }
}
