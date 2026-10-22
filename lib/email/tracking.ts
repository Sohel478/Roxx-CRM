import {
  mockMarketingCampaignsStore,
  mockActivitiesStore,
  mockSuppressedEmailsStore,
  mockLeadsStore,
  mockDirectEmailsStore,
} from "@/lib/db/mock-store";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getAppBaseUrl, isValidHttpUrl, generateTrackingUrls } from "./tracking-urls";

export { getAppBaseUrl, isValidHttpUrl, generateTrackingUrls };

export function isEmailSuppressed(email: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return mockSuppressedEmailsStore.has(normalized);
}

export function suppressEmail(email: string): void {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
  mockSuppressedEmailsStore.add(normalized);
}

export interface TrackingOptions {
  campaignId: string;
  leadId: string;
  recipientEmail: string;
  baseUrl?: string;
  isMarketing?: boolean;
}



/**
 * Injects a 1x1 transparent open-tracking GIF and wraps hyperlinks with click-tracking redirects.
 * Adds an RFC-compliant unsubscribe footer if isMarketing is true.
 */
export function injectTrackingIntoHtml(
  html: string,
  options: TrackingOptions
): string {
  const baseUrl = (options.baseUrl || getAppBaseUrl()).replace(/\/$/, "");
  const { campaignId, leadId, recipientEmail, isMarketing } = options;

  const openTrackingUrl = `${baseUrl}/api/v1/email/track/open?cid=${encodeURIComponent(
    campaignId
  )}&lid=${encodeURIComponent(leadId)}`;

  const unsubscribeUrl = `${baseUrl}/api/v1/email/unsubscribe?cid=${encodeURIComponent(
    campaignId
  )}&lid=${encodeURIComponent(leadId)}&email=${encodeURIComponent(recipientEmail)}`;

  // Rewrite standard hyperlinks: <a href="https://..."> -> <a href="${baseUrl}/api/v1/email/track/click?cid=...&lid=...&url=...">
  let modifiedHtml = html.replace(
    /<a\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (match, prefix, originalHref, suffix) => {
      const cleanHref = originalHref.trim();

      // Skip mailto:, tel:, javascript:, or already tracked links
      if (
        cleanHref.startsWith("mailto:") ||
        cleanHref.startsWith("tel:") ||
        cleanHref.startsWith("#") ||
        cleanHref.includes("/api/v1/email/track/click") ||
        cleanHref.includes("/api/v1/email/unsubscribe")
      ) {
        return match;
      }

      // Only rewrite valid web links
      if (!cleanHref.startsWith("http://") && !cleanHref.startsWith("https://")) {
        return match;
      }

      const clickTrackingUrl = `${baseUrl}/api/v1/email/track/click?cid=${encodeURIComponent(
        campaignId
      )}&lid=${encodeURIComponent(leadId)}&url=${encodeURIComponent(cleanHref)}`;

      return `<a${prefix}href="${clickTrackingUrl}"${suffix}>`;
    }
  );

  // Append professional unsubscribe footer if marketing campaign
  if (isMarketing) {
    const footerHtml = `
<div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; line-height: 1.5; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  You received this message from Roxx CRM. If you prefer not to receive future updates, you can <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">unsubscribe here</a>.
</div>`;
    modifiedHtml += footerHtml;
  }

  // Inject 1x1 transparent tracking pixel at the very end
  const pixelHtml = `<img src="${openTrackingUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0;opacity:0;" />`;
  modifiedHtml += pixelHtml;

  return modifiedHtml;
}

/**
 * Records an email OPEN event for a campaign and lead.
 */
export async function recordEmailOpen(
  campaignId: string,
  leadId: string
): Promise<{ success: boolean; isFirstOpen: boolean }> {
  const now = new Date().toISOString();
  let isFirstOpen = false;

  // 1. Update mock store
  const camp = mockMarketingCampaignsStore.find((c) => c.id === campaignId);
  if (camp) {
    const log = camp.recipientLogs.find((l) => l.leadId === leadId);
    if (log) {
      if (!log.openedAt) {
        isFirstOpen = true;
        log.openedAt = now;
      }
      log.openCount = (log.openCount || 0) + 1;

      // Status promotion: If not clicked or unsubscribed, promote to OPENED
      if (log.status === "SENT" || log.status === "DELIVERED") {
        log.status = "OPENED";
      }
    }

    // Recalculate campaign aggregate open count
    camp.openedCount = camp.recipientLogs.filter(
      (l) => l.openedAt != null || l.status === "OPENED" || l.status === "CLICKED"
    ).length;
    camp.updatedAt = now;
  }

  // 1b. Update direct email store if applicable
  const directDispatch = mockDirectEmailsStore
    .slice()
    .reverse()
    .find((d) => (campaignId && d.id === campaignId) || d.leadId === leadId);
  if (directDispatch) {
    if (!directDispatch.openedAt) {
      isFirstOpen = true;
      directDispatch.openedAt = now;
    }
    directDispatch.openCount = (directDispatch.openCount || 0) + 1;
    if (directDispatch.status === "SENT" || directDispatch.status === "DELIVERED") {
      directDispatch.status = "OPENED";
    }
  }

  // 1c. If campaignId references an activity (act_xxx), promote its outcome
  if (campaignId && campaignId.startsWith("act_")) {
    const rawActId = campaignId.replace(/^act_/, "");
    const matchingAct = mockActivitiesStore.find((a) => a.id === rawActId || a.id === campaignId);
    if (matchingAct) {
      matchingAct.outcome = "OPENED";
    }
    try {
      await prisma.activity.update({
        where: { id: rawActId },
        data: { outcome: "OPENED" },
      });
    } catch {}
  }

  // 2. Record activity in Lead Timeline (idempotent: only record if no duplicate open in last 5 minutes)
  try {
    const hasRecentOpen = mockActivitiesStore.some(
      (a) =>
        a.leadId === leadId &&
        a.type === "EMAIL" &&
        a.outcome === "OPENED" &&
        Date.now() - new Date(a.activityAt).getTime() < 5 * 60 * 1000
    );
    if (!hasRecentOpen) {
      const subjectTitle = camp?.subject ? ` (${camp.subject.slice(0, 40)})` : "";
      mockActivitiesStore.push({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: camp?.organizationId || "org_default",
        type: "EMAIL",
        subject: `Email Opened${subjectTitle}`,
        description: `Recipient opened email on ${new Date().toLocaleString()}`,
        leadId,
        leadName: null,
        companyId: null,
        companyName: null,
        contactId: null,
        contactName: null,
        opportunityId: null,
        opportunityName: null,
        userId: camp?.senderId || "system",
        userName: camp?.senderName || "System",
        activityAt: now,
        durationMinutes: null,
        outcome: "OPENED",
        createdAt: now,
      });
    }
  } catch (err) {
    console.warn("[recordEmailOpen] Activity log warning:", err);
  }

  // 3. Update Prisma database if available
  try {
    const dbCamp = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (dbCamp && Array.isArray(dbCamp.recipientLogs)) {
      const logs = [...(dbCamp.recipientLogs as Array<Record<string, unknown>>)];
      const logIdx = logs.findIndex((l) => l.leadId === leadId);
      if (logIdx !== -1) {
        const item = { ...logs[logIdx] };
        if (!item.openedAt) item.openedAt = now;
        item.openCount = ((item.openCount as number) || 0) + 1;
        if (item.status === "SENT" || item.status === "DELIVERED") {
          item.status = "OPENED";
        }
        logs[logIdx] = item;

        await prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            recipientLogs: logs as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
      }
    }
  } catch {
    // Non-blocking in mock/offline test environments
  }

  return { success: true, isFirstOpen };
}

/**
 * Records an email CLICK event for a campaign, lead, and destination URL.
 */
export async function recordEmailClick(
  campaignId: string,
  leadId: string,
  targetUrl: string
): Promise<{ success: boolean; isFirstClick: boolean }> {
  const now = new Date().toISOString();
  let isFirstClick = false;

  // 1. Update mock store
  const camp = mockMarketingCampaignsStore.find((c) => c.id === campaignId);
  if (camp) {
    const log = camp.recipientLogs.find((l) => l.leadId === leadId);
    if (log) {
      if (!log.clickedAt) {
        isFirstClick = true;
        log.clickedAt = now;
      }
      log.clickCount = (log.clickCount || 0) + 1;
      log.lastClickedUrl = targetUrl;

      // Clicking also implies the email was opened
      if (!log.openedAt) {
        log.openedAt = now;
        log.openCount = (log.openCount || 0) + 1;
      }

      // Promote status to CLICKED (highest positive engagement tier)
      if (log.status !== "UNSUBSCRIBED") {
        log.status = "CLICKED";
      }
    }

    camp.clickedCount = camp.recipientLogs.filter(
      (l) => l.clickedAt != null || l.status === "CLICKED"
    ).length;
    camp.openedCount = camp.recipientLogs.filter(
      (l) => l.openedAt != null || l.status === "OPENED" || l.status === "CLICKED"
    ).length;
    camp.updatedAt = now;
  }

  // 1b. Update direct email store if applicable
  const directDispatch = mockDirectEmailsStore
    .slice()
    .reverse()
    .find((d) => (campaignId && d.id === campaignId) || d.leadId === leadId);
  if (directDispatch) {
    if (!directDispatch.clickedAt) {
      isFirstClick = true;
      directDispatch.clickedAt = now;
    }
    directDispatch.clickCount = (directDispatch.clickCount || 0) + 1;
    directDispatch.lastClickedUrl = targetUrl;
    if (!directDispatch.openedAt) {
      directDispatch.openedAt = now;
      directDispatch.openCount = (directDispatch.openCount || 0) + 1;
    }
    if (directDispatch.status !== "UNSUBSCRIBED") {
      directDispatch.status = "CLICKED";
    }
  }

  // 1c. If campaignId references an activity (act_xxx), promote its outcome to CLICKED
  if (campaignId && campaignId.startsWith("act_")) {
    const rawActId = campaignId.replace(/^act_/, "");
    const matchingAct = mockActivitiesStore.find((a) => a.id === rawActId || a.id === campaignId);
    if (matchingAct) {
      matchingAct.outcome = "CLICKED";
    }
    try {
      await prisma.activity.update({
        where: { id: rawActId },
        data: { outcome: "CLICKED" },
      });
    } catch {}
  }

  // 2. Record activity in Lead Timeline (idempotent: prevent duplicate click activities within 5 minutes)
  try {
    const hasRecentClick = mockActivitiesStore.some(
      (a) =>
        a.leadId === leadId &&
        a.type === "EMAIL" &&
        a.outcome === "CLICKED" &&
        a.description?.includes(targetUrl) &&
        Date.now() - new Date(a.activityAt).getTime() < 5 * 60 * 1000
    );
    if (!hasRecentClick) {
      mockActivitiesStore.push({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: camp?.organizationId || "org_default",
        type: "EMAIL",
        subject: `Email Link Clicked`,
        description: `Recipient clicked link: ${targetUrl}`,
        leadId,
        leadName: null,
        companyId: null,
        companyName: null,
        contactId: null,
        contactName: null,
        opportunityId: null,
        opportunityName: null,
        userId: camp?.senderId || "system",
        userName: camp?.senderName || "System",
        activityAt: now,
        durationMinutes: null,
        outcome: "CLICKED",
        createdAt: now,
      });
    }
  } catch (err) {
    console.warn("[recordEmailClick] Activity log warning:", err);
  }

  // 3. Update Prisma database
  try {
    const dbCamp = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (dbCamp && Array.isArray(dbCamp.recipientLogs)) {
      const logs = [...(dbCamp.recipientLogs as Array<Record<string, unknown>>)];
      const logIdx = logs.findIndex((l) => l.leadId === leadId);
      if (logIdx !== -1) {
        const item = { ...logs[logIdx] };
        if (!item.clickedAt) item.clickedAt = now;
        item.clickCount = ((item.clickCount as number) || 0) + 1;
        item.lastClickedUrl = targetUrl;
        if (!item.openedAt) item.openedAt = now;
        if (item.status !== "UNSUBSCRIBED") item.status = "CLICKED";
        logs[logIdx] = item;

        await prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            recipientLogs: logs as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
      }
    }
  } catch {
    // Non-blocking
  }

  return { success: true, isFirstClick };
}

/**
 * Records an email BOUNCE (Failed Delivery) event and suppresses the recipient email address.
 */
export async function recordEmailBounce(
  campaignId: string,
  leadId: string,
  email: string,
  reason: string
): Promise<{ success: boolean }> {
  const now = new Date().toISOString();

  // 1. Suppress email address
  if (email) {
    suppressEmail(email);
  }

  // 2. Update mock store
  const camp = mockMarketingCampaignsStore.find((c) => c.id === campaignId);
  if (camp) {
    const log = camp.recipientLogs.find(
      (l) => l.leadId === leadId || (email && l.email.toLowerCase() === email.toLowerCase())
    );
    if (log) {
      log.status = "BOUNCED";
      log.bouncedAt = now;
      log.bounceReason = reason;
      log.error = reason;
    }
    camp.bouncedCount = camp.recipientLogs.filter((l) => l.status === "BOUNCED").length;
    camp.updatedAt = now;
  }

  // 2b. Update direct email store if applicable
  const matchingDirectForBounce = mockDirectEmailsStore.filter(
    (d) =>
      (campaignId && d.id === campaignId) ||
      d.leadId === leadId ||
      (email && d.recipientEmail.toLowerCase() === email.toLowerCase())
  );
  for (const d of matchingDirectForBounce) {
    d.status = "BOUNCED";
    d.bouncedAt = now;
    d.bounceReason = reason;
  }

  // 2c. If campaignId references an activity (act_xxx), promote its outcome to BOUNCED
  if (campaignId && campaignId.startsWith("act_")) {
    const rawActId = campaignId.replace(/^act_/, "");
    const matchingAct = mockActivitiesStore.find((a) => a.id === rawActId || a.id === campaignId);
    if (matchingAct) {
      matchingAct.outcome = "BOUNCED";
    }
    try {
      await prisma.activity.update({
        where: { id: rawActId },
        data: { outcome: "BOUNCED" },
      });
    } catch {}
  }

  // 3. Record activity in Lead Timeline
  try {
    mockActivitiesStore.push({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizationId: camp?.organizationId || "org_default",
      type: "EMAIL",
      subject: `Email Delivery Bounced (Failed)`,
      description: `Delivery failed for ${email}: ${reason}`,
      leadId,
      leadName: null,
      companyId: null,
      companyName: null,
      contactId: null,
      contactName: null,
      opportunityId: null,
      opportunityName: null,
      userId: camp?.senderId || "system",
      userName: camp?.senderName || "System",
      activityAt: now,
      durationMinutes: null,
      outcome: "BOUNCED",
      createdAt: now,
    });
  } catch (err) {
    console.warn("[recordEmailBounce] Activity log warning:", err);
  }

  return { success: true };
}

/**
 * Records an UNSUBSCRIBE event, suppresses the recipient email address, and updates lead status.
 */
export async function recordEmailUnsubscribe(
  campaignId: string,
  leadId: string,
  email: string
): Promise<{ success: boolean }> {
  const now = new Date().toISOString();

  // 1. Suppress email address from all future outreach
  if (email) {
    suppressEmail(email);
  }

  // 2. Update mock store
  const camp = mockMarketingCampaignsStore.find((c) => c.id === campaignId);
  if (camp) {
    const log = camp.recipientLogs.find(
      (l) => l.leadId === leadId || (email && l.email.toLowerCase() === email.toLowerCase())
    );
    if (log) {
      log.status = "UNSUBSCRIBED";
      log.unsubscribedAt = now;
    }
    camp.unsubscribedCount = camp.recipientLogs.filter(
      (l) => l.status === "UNSUBSCRIBED"
    ).length;
    camp.updatedAt = now;
  }

  // 2b. Update direct email store if applicable
  const matchingDirectForUnsub = mockDirectEmailsStore.filter(
    (d) =>
      (campaignId && d.id === campaignId) ||
      d.leadId === leadId ||
      (email && d.recipientEmail.toLowerCase() === email.toLowerCase())
  );
  for (const d of matchingDirectForUnsub) {
    d.status = "UNSUBSCRIBED";
    d.unsubscribedAt = now;
  }

  // 3. Mark lead in CRM as Unsubscribed if matching lead exists
  const lead = mockLeadsStore.find(
    (l) => l.id === leadId || (email && (l.email === email || l.supportEmail === email))
  );
  if (lead) {
    lead.status = "Unsubscribed";
    lead.updatedAt = now;
  }

  // 4. Record activity in Lead Timeline
  try {
    mockActivitiesStore.push({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizationId: camp?.organizationId || "org_default",
      type: "EMAIL",
      subject: `Lead Unsubscribed from Email Outreach`,
      description: `Email ${email} was unsubscribed and added to suppression list.`,
      leadId: lead?.id || leadId,
      leadName: lead?.fullName || null,
      companyId: null,
      companyName: lead?.companyName || null,
      contactId: null,
      contactName: null,
      opportunityId: null,
      opportunityName: null,
      userId: camp?.senderId || "system",
      userName: camp?.senderName || "System",
      activityAt: now,
      durationMinutes: null,
      outcome: "UNSUBSCRIBED",
      createdAt: now,
    });
  } catch (err) {
    console.warn("[recordEmailUnsubscribe] Activity log warning:", err);
  }

  return { success: true };
}

/**
 * Computes aggregate marketing campaign KPIs.
 */
export function calculateCampaignKpis(recipientLogs: {
  status: string;
  openedAt?: string | null;
  clickedAt?: string | null;
  bouncedAt?: string | null;
  unsubscribedAt?: string | null;
}[]) {
  const total = recipientLogs.length;
  if (total === 0) {
    return {
      total: 0,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      unsubscribedCount: 0,
      openRate: 0,
      clickThroughRate: 0,
      bounceRate: 0,
      unsubscribeRate: 0,
    };
  }

  const sentCount = recipientLogs.filter((l) => l.status !== "SKIPPED").length;
  const openedCount = recipientLogs.filter(
    (l) => l.openedAt != null || l.status === "OPENED" || l.status === "CLICKED"
  ).length;
  const clickedCount = recipientLogs.filter(
    (l) => l.clickedAt != null || l.status === "CLICKED"
  ).length;
  const bouncedCount = recipientLogs.filter(
    (l) => l.bouncedAt != null || l.status === "BOUNCED"
  ).length;
  const unsubscribedCount = recipientLogs.filter(
    (l) => l.unsubscribedAt != null || l.status === "UNSUBSCRIBED"
  ).length;

  const validDenominator = sentCount > 0 ? sentCount : total;

  return {
    total,
    sentCount,
    openedCount,
    clickedCount,
    bouncedCount,
    unsubscribedCount,
    openRate: Math.round((openedCount / validDenominator) * 1000) / 10,
    clickThroughRate: Math.round((clickedCount / validDenominator) * 1000) / 10,
    bounceRate: Math.round((bouncedCount / validDenominator) * 1000) / 10,
    unsubscribeRate: Math.round((unsubscribedCount / validDenominator) * 1000) / 10,
  };
}
