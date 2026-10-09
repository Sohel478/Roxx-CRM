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
  mockMarketingCampaignsStore,
  mockAiCampaignsStore,
  mockInboxStore,
} from "@/lib/db/mock-store";
import {
  activitySchema,
  ActivityFormData,
  ActivityItem,
  ActivityType,
} from "@/lib/validations/activities";

/**
 * Fetch activities with chronological ordering and type metrics.
 * Aggregates database activities, mock activities, sent marketing campaigns,
 * AI outreach campaign schedules, and client inbox replies.
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

  const aggregatedActivities: ActivityItem[] = [];
  const seenFingerprints = new Set<string>();

  const addActivity = (item: ActivityItem) => {
    const normSub = (item.subject || "")
      .replace(/^\[(Batch Campaign|AI Outreach|AI Follow-Up|Client Reply|Batch:[^\]]+)\]\s*/i, "")
      .replace(/^re:\s*/i, "")
      .trim()
      .toLowerCase();
    const timeBucket = item.activityAt
      ? Math.floor(new Date(item.activityAt).getTime() / 60000)
      : 0;
    const fingerprint = `${item.type}|${item.leadId || ""}|${item.contactId || ""}|${normSub}|${timeBucket}`;

    if (item.id && seenFingerprints.has(item.id)) return;
    if (seenFingerprints.has(fingerprint)) return;

    if (item.id) seenFingerprints.add(item.id);
    seenFingerprints.add(fingerprint);
    aggregatedActivities.push(item);
  };

  // 1. Fetch from Prisma Activity table
  try {
    const where: any = {};
    if (params.type && params.type !== "ALL") where.type = params.type;
    if (params.leadId) {
      where.leadId = params.leadId;
    } else if (params.companyId) {
      where.companyId = params.companyId;
    } else if (params.contactId) {
      where.contactId = params.contactId;
    } else if (params.opportunityId) {
      where.opportunityId = params.opportunityId;
    } else {
      where.organizationId = { in: [organizationId, session.organizationId].filter(Boolean) };
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { activityAt: "desc" },
      take: params.limit || 200,
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    });

    activities.forEach((a) => {
      addActivity({
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
      });
    });
  } catch (err) {
    console.warn("[getActivitiesAction] Prisma findMany error:", err);
  }

  // 2. Fetch from mockActivitiesStore (restoring persistent fallback store if memory is empty)
  if (mockActivitiesStore.length === 0) {
    try {
      const setting = await prisma.systemSetting.findFirst({
        where: {
          key: "mock_activities",
          organizationId: { in: [organizationId, session.organizationId].filter(Boolean) },
        },
      });
      if (setting?.value) {
        const stored = JSON.parse(setting.value);
        if (Array.isArray(stored)) {
          mockActivitiesStore.push(...stored);
        }
      }
    } catch {}
  }

  mockActivitiesStore
    .filter((a) => {
      if (params.type && params.type !== "ALL" && a.type !== params.type) return false;
      if (params.leadId && a.leadId !== params.leadId) return false;
      if (params.companyId && a.companyId !== params.companyId) return false;
      if (params.contactId && a.contactId !== params.contactId) return false;
      if (params.opportunityId && a.opportunityId !== params.opportunityId) return false;
      return true;
    })
    .forEach((a) => addActivity({ ...a }));

  // 3. Omnichannel Email Aggregation: Marketing Campaigns, AI Outreach Campaigns, and Inbox Replies
  // Restore persistent AI campaigns if in-memory store was cleared
  if (mockAiCampaignsStore.length === 0) {
    try {
      const setting = await prisma.systemSetting.findFirst({
        where: {
          key: "ai_campaigns",
          organizationId: { in: [organizationId, session.organizationId].filter(Boolean) },
        },
      });
      if (setting?.value) {
        const stored = JSON.parse(setting.value);
        if (Array.isArray(stored)) {
          mockAiCampaignsStore.push(...stored);
        }
      }
    } catch {}
  }

  const targetLeadId = params.leadId;
  let leadEmails: string[] = [];
  let leadFullName = "";

  if (targetLeadId) {
    try {
      const dbLead = await prisma.lead.findUnique({
        where: { id: targetLeadId },
        select: { email: true, supportEmail: true, firstName: true, lastName: true },
      });
      if (dbLead) {
        if (dbLead.email) leadEmails.push(dbLead.email.toLowerCase().trim());
        if (dbLead.supportEmail) leadEmails.push(dbLead.supportEmail.toLowerCase().trim());
        leadFullName = `${dbLead.firstName} ${dbLead.lastName || ""}`.trim();
      }
    } catch {}

    if (leadEmails.length === 0) {
      const ml = mockLeadsStore.find((l) => l.id === targetLeadId);
      if (ml) {
        if (ml.email) leadEmails.push(ml.email.toLowerCase().trim());
        if (ml.supportEmail) leadEmails.push(ml.supportEmail.toLowerCase().trim());
        leadFullName = ml.fullName;
      }
    }
  }

  // 3a. Prisma Marketing Campaigns
  try {
    const dbCampaigns = await prisma.marketingCampaign.findMany({
      where: {
        organizationId: { in: [organizationId, session.organizationId].filter(Boolean) },
      },
      select: {
        id: true,
        subject: true,
        body: true,
        senderName: true,
        recipientLogs: true,
        sentAt: true,
        createdAt: true,
      },
    });

    for (const camp of dbCampaigns) {
      let logs: any[] = [];
      if (Array.isArray(camp.recipientLogs)) {
        logs = camp.recipientLogs;
      } else if (typeof camp.recipientLogs === "string") {
        try {
          logs = JSON.parse(camp.recipientLogs);
        } catch {}
      }

      if (targetLeadId) {
        const matchingLog = logs.find(
          (l) =>
            l.leadId === targetLeadId ||
            (l.email && leadEmails.includes(l.email.toLowerCase().trim())) ||
            (leadFullName && l.leadName && l.leadName.toLowerCase().trim() === leadFullName.toLowerCase())
        );

        if (matchingLog) {
          const sentDate = matchingLog.sentAt || camp.sentAt || camp.createdAt;
          const sentDateIso =
            sentDate instanceof Date ? sentDate.toISOString() : new Date(sentDate).toISOString();
          const isFailed = matchingLog.status === "FAILED";

          addActivity({
            id: `camp_act_${camp.id}_${targetLeadId}`,
            organizationId,
            type: "EMAIL",
            subject: isFailed ? `[Batch Campaign: Failed] ${camp.subject}` : `[Batch Campaign] ${camp.subject}`,
            description: `Delivered to: ${matchingLog.email || leadEmails[0] || "Lead"}\nSubject: ${camp.subject}\nStatus: ${matchingLog.status || "SENT"}\n\n${camp.body}`,
            leadId: targetLeadId,
            leadName: matchingLog.leadName || leadFullName,
            companyId: null,
            companyName: matchingLog.companyName || null,
            contactId: null,
            contactName: null,
            opportunityId: null,
            opportunityName: null,
            userId: "system",
            userName: camp.senderName || "Marketing Team",
            activityAt: sentDateIso,
            durationMinutes: null,
            outcome: matchingLog.status || "SENT",
            createdAt:
              camp.createdAt instanceof Date
                ? camp.createdAt.toISOString()
                : new Date(camp.createdAt).toISOString(),
          });
        }
      } else {
        // Global /activities view: Include all recipient touchpoints
        for (const log of logs) {
          const sentDate = log.sentAt || camp.sentAt || camp.createdAt;
          const sentDateIso =
            sentDate instanceof Date ? sentDate.toISOString() : new Date(sentDate).toISOString();
          const isFailed = log.status === "FAILED";

          addActivity({
            id: `camp_act_${camp.id}_${log.leadId || log.email || Math.random()}`,
            organizationId,
            type: "EMAIL",
            subject: isFailed ? `[Batch Campaign: Failed] ${camp.subject}` : `[Batch Campaign] ${camp.subject}`,
            description: `To: ${log.email || "Recipient"}\nSubject: ${camp.subject}\n\n${camp.body}`,
            leadId: log.leadId || null,
            leadName: log.leadName || null,
            companyId: null,
            companyName: log.companyName || null,
            contactId: null,
            contactName: null,
            opportunityId: null,
            opportunityName: null,
            userId: "system",
            userName: camp.senderName || "Marketing Team",
            activityAt: sentDateIso,
            durationMinutes: null,
            outcome: log.status || "SENT",
            createdAt:
              camp.createdAt instanceof Date
                ? camp.createdAt.toISOString()
                : new Date(camp.createdAt).toISOString(),
          });
        }
      }
    }
  } catch {}

  // 3b. mockMarketingCampaignsStore
  for (const camp of mockMarketingCampaignsStore) {
    if (camp.organizationId !== organizationId && camp.organizationId !== session.organizationId) {
      continue;
    }
    const logs = Array.isArray(camp.recipientLogs) ? camp.recipientLogs : [];

    if (targetLeadId) {
      const matchingLog = logs.find(
        (l) =>
          l.leadId === targetLeadId ||
          (l.email && leadEmails.includes(l.email.toLowerCase().trim())) ||
          (leadFullName && l.leadName && l.leadName.toLowerCase().trim() === leadFullName.toLowerCase())
      );

      if (matchingLog) {
        const isFailed = matchingLog.status === "FAILED";
        addActivity({
          id: `camp_mock_act_${camp.id}_${targetLeadId}`,
          organizationId,
          type: "EMAIL",
          subject: isFailed ? `[Batch Campaign: Failed] ${camp.subject}` : `[Batch Campaign] ${camp.subject}`,
          description: `Delivered to: ${matchingLog.email || leadEmails[0] || "Lead"}\nSubject: ${camp.subject}\nStatus: ${matchingLog.status || "SENT"}\n\n${camp.body}`,
          leadId: targetLeadId,
          leadName: matchingLog.leadName || leadFullName,
          companyId: null,
          companyName: matchingLog.companyName || null,
          contactId: null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: camp.senderId || "system",
          userName: camp.senderName || "Marketing Team",
          activityAt: matchingLog.sentAt || camp.sentAt || camp.createdAt,
          durationMinutes: null,
          outcome: matchingLog.status || "SENT",
          createdAt: camp.createdAt,
        });
      }
    } else {
      for (const log of logs) {
        addActivity({
          id: `camp_mock_act_${camp.id}_${log.leadId || log.email || Math.random()}`,
          organizationId,
          type: "EMAIL",
          subject: `[Batch Campaign] ${camp.subject}`,
          description: `To: ${log.email || "Recipient"}\n\n${camp.body}`,
          leadId: log.leadId || null,
          leadName: log.leadName || null,
          companyId: null,
          companyName: log.companyName || null,
          contactId: null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: camp.senderId || "system",
          userName: camp.senderName || "Marketing Team",
          activityAt: log.sentAt || camp.sentAt || camp.createdAt,
          durationMinutes: null,
          outcome: log.status || "SENT",
          createdAt: camp.createdAt,
        });
      }
    }
  }

  // 3c. mockAiCampaignsStore (AI Outreach Emails, Queued Schedules & Follow-Ups)
  for (const aiCamp of mockAiCampaignsStore) {
    if (
      aiCamp.organizationId !== organizationId &&
      aiCamp.organizationId !== session.organizationId
    ) {
      continue;
    }
    const schedules = Array.isArray(aiCamp.schedules) ? aiCamp.schedules : [];

    if (targetLeadId) {
      const s = schedules.find(
        (sched) =>
          sched.leadId === targetLeadId ||
          (sched.leadEmail && leadEmails.includes(sched.leadEmail.toLowerCase().trim())) ||
          (leadFullName && sched.leadName && sched.leadName.toLowerCase().trim() === leadFullName.toLowerCase())
      );

      if (s) {
        const isScheduled = s.status === "SCHEDULED";
        const isFailed = s.status === "FAILED";
        const subjectTag = isScheduled
          ? "[AI Outreach: Scheduled]"
          : isFailed
          ? "[AI Outreach: Delivery Issue]"
          : "[AI Outreach]";

        addActivity({
          id: `ai_init_act_${aiCamp.id}_${targetLeadId}`,
          organizationId,
          type: "EMAIL",
          subject: `${subjectTag} ${s.initialSubject}`,
          description: `Delivered to: ${s.leadEmail}\nSubject: ${s.initialSubject}\nStatus: ${s.status}${
            isScheduled ? ` (Scheduled for ${new Date(s.scheduledAt).toLocaleString()})` : ""
          }\n\n${s.initialBody}`,
          leadId: targetLeadId,
          leadName: s.leadName || leadFullName,
          companyId: null,
          companyName: s.companyName || null,
          contactId: null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: aiCamp.creatorId || "system",
          userName: aiCamp.creatorName || "AI Campaign Assistant",
          activityAt: s.sentAt || s.scheduledAt,
          durationMinutes: null,
          outcome: s.status,
          createdAt: aiCamp.createdAt,
        });

        if (s.followUpSentAt && s.followUpSubject) {
          addActivity({
            id: `ai_followup_act_${aiCamp.id}_${targetLeadId}`,
            organizationId,
            type: "EMAIL",
            subject: `[AI Follow-Up] ${s.followUpSubject}`,
            description: `Delivered Step 2 follow-up to: ${s.leadEmail}\nSubject: ${s.followUpSubject}\n\n${s.followUpBody}`,
            leadId: targetLeadId,
            leadName: s.leadName || leadFullName,
            companyId: null,
            companyName: s.companyName || null,
            contactId: null,
            contactName: null,
            opportunityId: null,
            opportunityName: null,
            userId: aiCamp.creatorId || "system",
            userName: aiCamp.creatorName || "AI Campaign Assistant",
            activityAt: s.followUpSentAt,
            durationMinutes: null,
            outcome: "FOLLOW_UP_SENT",
            createdAt: aiCamp.createdAt,
          });
        }
      }
    } else {
      // Global /activities view: Include all AI schedules across the organization
      for (const s of schedules) {
        const isScheduled = s.status === "SCHEDULED";
        const isFailed = s.status === "FAILED";
        const subjectTag = isScheduled
          ? "[AI Outreach: Scheduled]"
          : isFailed
          ? "[AI Outreach: Delivery Issue]"
          : "[AI Outreach]";

        addActivity({
          id: `ai_init_act_${aiCamp.id}_${s.leadId || s.leadEmail}`,
          organizationId,
          type: "EMAIL",
          subject: `${subjectTag} ${s.initialSubject}`,
          description: `Delivered to: ${s.leadEmail}\nSubject: ${s.initialSubject}\nStatus: ${s.status}\n\n${s.initialBody}`,
          leadId: s.leadId || null,
          leadName: s.leadName || null,
          companyId: null,
          companyName: s.companyName || null,
          contactId: null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: aiCamp.creatorId || "system",
          userName: aiCamp.creatorName || "AI Campaign Assistant",
          activityAt: s.sentAt || s.scheduledAt,
          durationMinutes: null,
          outcome: s.status,
          createdAt: aiCamp.createdAt,
        });

        if (s.followUpSentAt && s.followUpSubject) {
          addActivity({
            id: `ai_followup_act_${aiCamp.id}_${s.leadId || s.leadEmail}_followup`,
            organizationId,
            type: "EMAIL",
            subject: `[AI Follow-Up] ${s.followUpSubject}`,
            description: `Delivered Step 2 follow-up to: ${s.leadEmail}\nSubject: ${s.followUpSubject}\n\n${s.followUpBody}`,
            leadId: s.leadId || null,
            leadName: s.leadName || null,
            companyId: null,
            companyName: s.companyName || null,
            contactId: null,
            contactName: null,
            opportunityId: null,
            opportunityName: null,
            userId: aiCamp.creatorId || "system",
            userName: aiCamp.creatorName || "AI Campaign Assistant",
            activityAt: s.followUpSentAt,
            durationMinutes: null,
            outcome: "FOLLOW_UP_SENT",
            createdAt: aiCamp.createdAt,
          });
        }
      }
    }
  }

  // 3d. mockInboxStore (Client Inbound Replies & Direct Inbox Emails)
  for (const msg of mockInboxStore) {
    if (
      msg.organizationId !== organizationId &&
      msg.organizationId !== session.organizationId
    ) {
      continue;
    }

    if (targetLeadId) {
      const isLeadSender =
        msg.leadId === targetLeadId ||
        (msg.fromEmail && leadEmails.includes(msg.fromEmail.toLowerCase().trim()));

      if (isLeadSender) {
        addActivity({
          id: `inbox_reply_act_${msg.id}`,
          organizationId,
          type: "EMAIL",
          subject: `[Client Reply] ${msg.subject}`,
          description: `From: ${msg.fromName || msg.fromEmail} <${msg.fromEmail}>\nTo: ${msg.toEmail}\n\n${msg.bodyText || msg.snippet}`,
          leadId: targetLeadId,
          leadName: msg.leadName || leadFullName,
          companyId: null,
          companyName: null,
          contactId: null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: "system",
          userName: msg.fromName || msg.fromEmail,
          activityAt: msg.date,
          durationMinutes: null,
          outcome: "REPLY_RECEIVED",
          createdAt: msg.date,
        });
      }
    } else {
      // Global /activities view: Include inbox messages with lead/contact associations
      if (msg.leadId || msg.contactId || msg.leadName) {
        addActivity({
          id: `inbox_reply_act_${msg.id}`,
          organizationId,
          type: "EMAIL",
          subject: `[Client Reply] ${msg.subject}`,
          description: `From: ${msg.fromName || msg.fromEmail} <${msg.fromEmail}>\nTo: ${msg.toEmail}\n\n${msg.bodyText || msg.snippet}`,
          leadId: msg.leadId || null,
          leadName: msg.leadName || null,
          companyId: null,
          companyName: null,
          contactId: msg.contactId || null,
          contactName: null,
          opportunityId: null,
          opportunityName: null,
          userId: "system",
          userName: msg.fromName || msg.fromEmail,
          activityAt: msg.date,
          durationMinutes: null,
          outcome: "REPLY_RECEIVED",
          createdAt: msg.date,
        });
      }
    }
  }

  // Filter by requested type if specified
  let filtered = aggregatedActivities;
  if (params.type && params.type !== "ALL") {
    filtered = filtered.filter((a) => a.type === params.type);
  }

  // Sort descending by activity date
  filtered.sort(
    (a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
  );

  if (params.limit) {
    filtered = filtered.slice(0, params.limit);
  }

  const callsCount = aggregatedActivities.filter((a) => a.type === "CALL").length;
  const meetingsCount = aggregatedActivities.filter((a) => a.type === "MEETING").length;
  const emailsCount = aggregatedActivities.filter((a) => a.type === "EMAIL").length;
  const notesCount = aggregatedActivities.filter((a) => a.type === "NOTE").length;

  return {
    success: true,
    data: {
      items: filtered,
      summary: {
        total: aggregatedActivities.length,
        callsCount,
        meetingsCount,
        emailsCount,
        notesCount,
      },
    },
  };
}

export async function logActivityAction(raw: ActivityFormData) {
  try {
    const session = await requirePermission("activity:create");

    const cleanRaw = {
      ...raw,
      subject: (raw.subject || "Email Touchpoint").trim().slice(0, 250),
    };

    const validated = activitySchema.safeParse(cleanRaw);
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

      let finalUserId = userId || session.id;
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: finalUserId },
          select: { id: true },
        });
        if (!userExists) {
          const firstUser = await prisma.user.findFirst({
            where: { organizationId },
            select: { id: true },
          });
          if (firstUser) finalUserId = firstUser.id;
        }
      } catch {}

      // Validate relational foreign keys to prevent drop
      let validLeadId: string | null = null;
      if (data.leadId) {
        try {
          const dbLead = await prisma.lead.findUnique({
            where: { id: data.leadId },
            select: { id: true },
          });
          if (dbLead) validLeadId = dbLead.id;
        } catch {}
      }

      let validCompanyId: string | null = null;
      if (data.companyId) {
        try {
          const dbComp = await prisma.company.findUnique({
            where: { id: data.companyId },
            select: { id: true },
          });
          if (dbComp) validCompanyId = dbComp.id;
        } catch {}
      }

      let validContactId: string | null = null;
      if (data.contactId) {
        try {
          const dbCont = await prisma.contact.findUnique({
            where: { id: data.contactId },
            select: { id: true },
          });
          if (dbCont) validContactId = dbCont.id;
        } catch {}
      }

      let validOpportunityId: string | null = null;
      if (data.opportunityId) {
        try {
          const dbOpp = await prisma.opportunity.findUnique({
            where: { id: data.opportunityId },
            select: { id: true },
          });
          if (dbOpp) validOpportunityId = dbOpp.id;
        } catch {}
      }

      const activity = await prisma.activity.create({
        data: {
          organizationId,
          type: data.type,
          subject: data.subject,
          description: data.description || null,
          leadId: validLeadId,
          companyId: validCompanyId,
          contactId: validContactId,
          opportunityId: validOpportunityId,
          userId: finalUserId,
          activityAt: activityDate,
          durationMinutes: data.durationMinutes || null,
          outcome: data.outcome || null,
        },
      });

      // Also sync mock store
      const mockEntry: ActivityItem = {
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
      };
      mockActivitiesStore.unshift(mockEntry);

      revalidatePath("/activities");
      revalidatePath("/tasks");
      if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
      if (data.opportunityId) revalidatePath(`/opportunities/${data.opportunityId}`);
      return { success: true, data: { id: activity.id } };
    } catch {
      // In-memory fallback
      const fallbackEntry: ActivityItem = {
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
      };
      mockActivitiesStore.unshift(fallbackEntry);

      try {
        const { organizationId } = await resolveTenantContext(session);
        await prisma.systemSetting.upsert({
          where: {
            organizationId_key: {
              organizationId,
              key: "mock_activities",
            },
          },
          create: {
            organizationId,
            key: "mock_activities",
            value: JSON.stringify(mockActivitiesStore.slice(0, 150)),
          },
          update: {
            value: JSON.stringify(mockActivitiesStore.slice(0, 150)),
          },
        });
      } catch {}

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
