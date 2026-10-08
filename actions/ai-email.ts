"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockLeadsStore,
  mockActivitiesStore,
  mockMarketingBatchesStore,
  mockSmtpStore,
  mockAiCampaignsStore,
  mockAiConfigsStore,
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
      repName: session.name || "Sales Representative",
      repEmail: session.email || "",
      organizationName: session.organizationName || "Roxx CRM",
      pastActivitiesSummary,
    };

    const brief = buildLeadResearchBrief(context);
    const suggestion = await generatePersonalizedLeadEmail(context, {
      objective: objective as any,
      tone: tone as any,
      customInstruction,
      valueProposition: valueProposition || configData?.defaultCompanyPitch || undefined,
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

    const config: BatchStudyConfig = {
      batchId,
      objective: objective as any,
      tone: tone as any,
      valueProposition,
      customInstruction,
      repName: session.name || "Sales Rep",
      repEmail: session.email || "",
      organizationName: session.organizationName || "Roxx CRM",
      enableFollowUp,
      followUpDays,
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
      creatorId: userId || session.id,
      creatorName: session.name || "Sales Rep",
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

    // If scheduled for 'now', trigger queue processing immediately
    if (startDate === "now" || baseStartTime <= Date.now() + 60000) {
      setTimeout(() => {
        processScheduledAiQueueAction(campaignId).catch((err) =>
          console.error("Immediate queue run error:", err)
        );
      }, 100);
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

      for (const item of campaign.schedules) {
        const scheduledTimeMs = new Date(item.scheduledAt).getTime();

        // 1. Initial email dispatch
        if (item.status === "SCHEDULED" && scheduledTimeMs <= now) {
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
              item.status = campaign.enableFollowUp ? "AWAITING_REPLY" : "SENT";
              item.sentAt = new Date().toISOString();
              campaign.sentCount += 1;
              sentInitialCount += 1;

              // Log to Lead Activity timeline
              await logActivityAction({
                type: "EMAIL",
                subject: item.initialSubject,
                description: `[AI Outreach]: Delivered initial personalized email to ${item.leadEmail}.\n\n${item.initialBody}`,
                leadId: item.leadId,
                activityAt: new Date().toISOString(),
              }).catch(() => {});
            } else {
              item.status = "FAILED";
              item.errorMessage = sendRes.error || "SMTP send failed";
            }
          } else {
            // Mock send if no live SMTP
            item.status = campaign.enableFollowUp ? "AWAITING_REPLY" : "SENT";
            item.sentAt = new Date().toISOString();
            campaign.sentCount += 1;
            sentInitialCount += 1;
          }
        }

        // 2. Automated Follow-Up Check
        if (item.status === "AWAITING_REPLY" && campaign.enableFollowUp && item.followUpScheduledAt) {
          const followUpTimeMs = new Date(item.followUpScheduledAt).getTime();

          // Check if lead has replied (search CRM activities or inbox)
          const replyActivity = mockActivitiesStore.find(
            (a) => a.leadId === item.leadId && a.outcome === "REPLY_RECEIVED"
          );

          if (replyActivity) {
            // Client replied! Automatically stop the sequence
            item.status = "REPLIED";
            item.repliedAt = replyActivity.activityAt || new Date().toISOString();
            campaign.repliedCount += 1;
            repliesDetectedCount += 1;
            continue;
          }

          // If no reply and due date reached -> send Step 2 follow-up
          if (followUpTimeMs <= now && item.followUpSubject && item.followUpBody) {
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

              if (sendRes.success) {
                item.status = "FOLLOW_UP_SENT";
                item.followUpSentAt = new Date().toISOString();
                campaign.followUpCount += 1;
                sentFollowUpCount += 1;

                // Log follow-up to timeline
                await logActivityAction({
                  type: "EMAIL",
                  subject: item.followUpSubject,
                  description: `[AI Cadence Follow-Up]: Dispatched automated Step 2 follow-up email to ${item.leadEmail}.\n\n${item.followUpBody}`,
                  leadId: item.leadId,
                  activityAt: new Date().toISOString(),
                }).catch(() => {});
              }
            } else {
              item.status = "FOLLOW_UP_SENT";
              item.followUpSentAt = new Date().toISOString();
              campaign.followUpCount += 1;
              sentFollowUpCount += 1;
            }
          }
        }
      }

      // Check if campaign is completed
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
      }

      campaign.updatedAt = new Date().toISOString();
    }

    revalidatePath("/marketing");

    return {
      success: true,
      data: {
        processedCount: sentInitialCount + sentFollowUpCount,
        sentInitialCount,
        sentFollowUpCount,
        repliesDetectedCount,
      },
    };
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

    const { aiProvider, apiKey, defaultCompanyPitch, defaultFollowUpDays, defaultPacingMinutes } =
      parsed.data;

    const updatedConfig: MockAiConfig = {
      organizationId,
      aiProvider,
      apiKey: apiKey || null,
      defaultCompanyPitch: defaultCompanyPitch || null,
      defaultFollowUpDays,
      defaultPacingMinutes,
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
