"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockInboxStore,
  mockImapStore,
  mockSmtpStore,
  mockLeadsStore,
  mockContactsStore,
  mockUsersStore,
  mockActivitiesStore,
  MockInboxEmail,
  MockImapConfig,
  MockSmtpConfig,
} from "@/lib/db/mock-store";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/encryption";
import { fetchImapInbox, decodeMimeHeader, cleanMimeBody } from "@/lib/email/imap-client";
import * as mailer from "@/lib/email/mailer";
import { logActivityAction } from "@/actions/activities";
import {
  InboxEmailItem,
  ReplyEmailInput,
  replyEmailSchema,
} from "@/lib/validations/email";

export interface GetInboxParams {
  filter?: "all" | "replies" | "unread" | "my_clients";
  search?: string;
  assignedTo?: string; // Optional: filter by sales rep ID/name or "my_clients"
}

export interface InboxAccountStatus {
  isConfigured: boolean;
  connectedEmail: string;
  provider: string;
  host: string;
  lastSyncedAt?: string;
  userRole?: string;
  isAdminOrManager?: boolean;
}

/**
 * Helper to resolve the active organization's connected email configuration,
 * seamlessly linking the inbound mailbox with the outbound email credentials.
 */
async function resolveOrganizationMailConfig(organizationId: string): Promise<{
  connectedEmail: string;
  smtpConfig: MockSmtpConfig | null;
  imapConfig: MockImapConfig | null;
}> {
  let smtpConfig: MockSmtpConfig | null = null;
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: "smtp_config",
        },
      },
    });
    if (setting?.value) smtpConfig = JSON.parse(setting.value);
  } catch {
    smtpConfig = mockSmtpStore[organizationId] || null;
  }
  if (!smtpConfig && mockSmtpStore[organizationId]) {
    smtpConfig = mockSmtpStore[organizationId];
  }

  let imapConfig: MockImapConfig | null = null;
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: "imap_config",
        },
      },
    });
    if (setting?.value) imapConfig = JSON.parse(setting.value);
  } catch {
    imapConfig = mockImapStore[organizationId] || null;
  }
  if (!imapConfig && mockImapStore[organizationId]) {
    imapConfig = mockImapStore[organizationId];
  }

  // If no separate IMAP exists, automatically derive it from the connected SMTP email
  if (!imapConfig && smtpConfig && smtpConfig.host && smtpConfig.username) {
    let derivedImapHost = "imap.gmail.com";
    if (smtpConfig.host.includes("gmail") || smtpConfig.host.includes("google")) {
      derivedImapHost = "imap.gmail.com";
    } else if (smtpConfig.host.includes("office365") || smtpConfig.host.includes("outlook")) {
      derivedImapHost = "outlook.office365.com";
    } else if (smtpConfig.host.includes("zoho")) {
      derivedImapHost = "imappro.zoho.com";
    } else if (smtpConfig.host.startsWith("smtp.")) {
      derivedImapHost = smtpConfig.host.replace(/^smtp\./, "imap.");
    } else {
      derivedImapHost = smtpConfig.host;
    }

    imapConfig = {
      organizationId,
      host: derivedImapHost,
      port: 993,
      secure: true,
      username: smtpConfig.username,
      encryptedPassword: smtpConfig.encryptedPassword,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockImapStore[organizationId] = imapConfig;
  }

  const connectedEmail =
    smtpConfig?.username || smtpConfig?.fromEmail || imapConfig?.username || "";

  return { connectedEmail, smtpConfig, imapConfig };
}

interface MatchedEntity {
  lead: {
    id: string;
    fullName: string;
    ownerId: string | null;
    ownerName: string | null;
  } | null;
  contact: {
    id: string;
    fullName: string;
    ownerId: string | null;
    ownerName: string | null;
  } | null;
}

/**
 * Searches Prisma database and mock stores for a Lead or Contact matching the email.
 */
async function findMatchingLeadOrContact(
  organizationId: string,
  rawEmail: string
): Promise<MatchedEntity> {
  if (!rawEmail) return { lead: null, contact: null };
  const normEmail = rawEmail.toLowerCase().trim();

  // 1. Try Prisma Lead
  try {
    const dbLead = await prisma.lead.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { email: { equals: normEmail, mode: "insensitive" } },
          { supportEmail: { equals: normEmail, mode: "insensitive" } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    if (dbLead) {
      return {
        lead: {
          id: dbLead.id,
          fullName: `${dbLead.firstName} ${dbLead.lastName || ""}`.trim(),
          ownerId: dbLead.ownerId,
          ownerName: dbLead.owner?.name || null,
        },
        contact: null,
      };
    }
  } catch {
    // Ignore and fallback
  }

  // 2. Try Mock Lead Store
  const mockLead = mockLeadsStore.find(
    (l) =>
      l.organizationId === organizationId &&
      (l.email?.toLowerCase().trim() === normEmail ||
        l.supportEmail?.toLowerCase().trim() === normEmail)
  );
  if (mockLead) {
    return {
      lead: {
        id: mockLead.id,
        fullName: mockLead.fullName,
        ownerId: mockLead.ownerId || null,
        ownerName: mockLead.ownerName || null,
      },
      contact: null,
    };
  }

  // 3. Try Prisma Contact
  try {
    const dbContact = await prisma.contact.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        email: { equals: normEmail, mode: "insensitive" },
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    if (dbContact) {
      return {
        lead: null,
        contact: {
          id: dbContact.id,
          fullName: `${dbContact.firstName} ${dbContact.lastName || ""}`.trim(),
          ownerId: dbContact.ownerId,
          ownerName: dbContact.owner?.name || null,
        },
      };
    }
  } catch {
    // Ignore and fallback
  }

  // 4. Try Mock Contact Store
  const mockContact = mockContactsStore.find(
    (c) =>
      c.organizationId === organizationId &&
      c.email?.toLowerCase().trim() === normEmail
  );
  if (mockContact) {
    return {
      lead: null,
      contact: {
        id: mockContact.id,
        fullName: mockContact.fullName,
        ownerId: mockContact.ownerId || null,
        ownerName: mockContact.ownerName || null,
      },
    };
  }

  return { lead: null, contact: null };
}

/**
 * Logs an incoming client reply activity to the Lead or Contact timeline.
 */
async function logInboundReplyActivity({
  organizationId,
  leadId,
  leadName,
  contactId,
  contactName,
  userId,
  cleanSubject,
  cleanFromName,
  fromEmail,
  activeEmail,
  cleanText,
  date,
}: {
  organizationId: string;
  leadId?: string | null;
  leadName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  userId: string;
  cleanSubject: string;
  cleanFromName: string;
  fromEmail: string;
  activeEmail: string;
  cleanText: string;
  date: string;
}) {
  const activityDate = date ? new Date(date) : new Date();
  const subjectDisplay = cleanSubject.startsWith("Re:")
    ? cleanSubject
    : `Re: ${cleanSubject}`;
  const desc = `From: ${cleanFromName} <${fromEmail}>\nTo: ${activeEmail}\n\n${cleanText}`;

  // 1. Try to record in Prisma database
  try {
    const existing = await prisma.activity.findFirst({
      where: {
        organizationId,
        type: "EMAIL",
        outcome: "REPLY_RECEIVED",
        leadId: leadId || undefined,
        contactId: contactId || undefined,
        activityAt: activityDate,
      },
    });

    if (!existing) {
      await prisma.activity.create({
        data: {
          organizationId,
          type: "EMAIL",
          subject: subjectDisplay,
          description: desc,
          leadId: leadId || null,
          contactId: contactId || null,
          userId,
          activityAt: activityDate,
          outcome: "REPLY_RECEIVED",
        },
      });
    }
  } catch {
    // Fallback to mock store
  }

  // 2. Also keep mockActivitiesStore in sync
  const existsInMock = mockActivitiesStore.some(
    (a) =>
      a.organizationId === organizationId &&
      a.type === "EMAIL" &&
      a.outcome === "REPLY_RECEIVED" &&
      ((leadId && a.leadId === leadId) || (contactId && a.contactId === contactId)) &&
      Math.abs(new Date(a.activityAt).getTime() - activityDate.getTime()) < 10000
  );

  if (!existsInMock) {
    mockActivitiesStore.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      organizationId,
      type: "EMAIL",
      subject: subjectDisplay,
      description: desc,
      leadId: leadId || null,
      leadName: leadName || null,
      companyId: null,
      companyName: null,
      contactId: contactId || null,
      contactName: contactName || null,
      opportunityId: null,
      opportunityName: null,
      userId,
      userName: cleanFromName,
      activityAt: activityDate.toISOString(),
      durationMinutes: null,
      outcome: "REPLY_RECEIVED",
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * Resolves owned lead IDs, contact IDs, and client emails for a specific sales user across DB and mock store.
 */
async function resolveClientOwnership(
  organizationId: string,
  userId: string,
  userName?: string
) {
  const ownedLeadIds = new Set<string>();
  const ownedContactIds = new Set<string>();
  const clientEmails = new Set<string>();
  const normName = userName?.toLowerCase().trim();

  // 1. Prisma Leads
  try {
    const dbLeads = await prisma.lead.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { createdById: userId },
          normName ? { owner: { name: { equals: userName, mode: "insensitive" } } } : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        email: true,
        supportEmail: true,
      },
    });
    dbLeads.forEach((l) => {
      ownedLeadIds.add(l.id);
      if (l.email) clientEmails.add(l.email.toLowerCase().trim());
      if (l.supportEmail) clientEmails.add(l.supportEmail.toLowerCase().trim());
    });
  } catch {
    // Ignore if prisma is unavailable
  }

  // 2. Prisma Contacts
  try {
    const dbContacts = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          normName ? { owner: { name: { equals: userName, mode: "insensitive" } } } : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        email: true,
      },
    });
    dbContacts.forEach((c) => {
      ownedContactIds.add(c.id);
      if (c.email) clientEmails.add(c.email.toLowerCase().trim());
    });
  } catch {
    // Ignore if prisma is unavailable
  }

  // 3. Mock Leads Store
  mockLeadsStore
    .filter((l) => {
      if (l.organizationId !== organizationId) return false;
      const ownerName = l.ownerName?.toLowerCase().trim();
      return (
        l.ownerId === userId ||
        l.createdById === userId ||
        (normName && ownerName === normName)
      );
    })
    .forEach((l) => {
      ownedLeadIds.add(l.id);
      if (l.email) clientEmails.add(l.email.toLowerCase().trim());
      if (l.supportEmail) clientEmails.add(l.supportEmail.toLowerCase().trim());
    });

  // 4. Mock Contacts Store
  mockContactsStore
    .filter((c) => {
      if (c.organizationId !== organizationId) return false;
      const ownerName = c.ownerName?.toLowerCase().trim();
      return (
        c.ownerId === userId ||
        (normName && ownerName === normName)
      );
    })
    .forEach((c) => {
      ownedContactIds.add(c.id);
      if (c.email) clientEmails.add(c.email.toLowerCase().trim());
    });

  return { ownedLeadIds, ownedContactIds, clientEmails };
}

/**
 * Returns the status of the mailbox connected to this organization
 */
export async function getInboxAccountStatusAction(): Promise<{
  success: boolean;
  data: InboxAccountStatus;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        data: { isConfigured: false, connectedEmail: "", provider: "", host: "" },
        error: "Authentication required",
      };
    }
    const { organizationId } = await resolveTenantContext(session);
    const { connectedEmail, smtpConfig, imapConfig } =
      await resolveOrganizationMailConfig(organizationId);

    const isConfigured = Boolean(
      (smtpConfig && smtpConfig.host && smtpConfig.username) ||
      (imapConfig && imapConfig.host && imapConfig.username)
    );

    const host = imapConfig?.host || smtpConfig?.host || "";
    let provider = "Custom Email Server";
    if (host.includes("gmail") || host.includes("google")) {
      provider = "Google Workspace / Gmail";
    } else if (host.includes("office365") || host.includes("outlook")) {
      provider = "Microsoft 365 / Outlook";
    } else if (host.includes("zoho")) {
      provider = "Zoho Mail";
    }

    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    return {
      success: true,
      data: {
        isConfigured,
        connectedEmail: connectedEmail || session.email || "infotflux@gmail.com",
        provider,
        host,
        lastSyncedAt: imapConfig?.lastSyncedAt || smtpConfig?.updatedAt,
        userRole: session.role || "SALES_USER",
        isAdminOrManager,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: { isConfigured: false, connectedEmail: "", provider: "", host: "", userRole: "SALES_USER", isAdminOrManager: false },
      error: (error as Error)?.message || "Failed to load account status.",
    };
  }
}

/**
 * Fetch list of incoming emails with optional filtering and search.
 */
export async function getInboxEmailsAction(params?: GetInboxParams): Promise<{
  success: boolean;
  data: InboxEmailItem[];
  unreadCount: number;
  connectedEmail: string;
  userRole?: string;
  isAdminOrManager?: boolean;
  salesReps?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        data: [],
        unreadCount: 0,
        connectedEmail: "",
        error: "Authentication required",
      };
    }
    const { organizationId } = await resolveTenantContext(session);
    const { connectedEmail } = await resolveOrganizationMailConfig(organizationId);

    const activeRecipient = connectedEmail || session.email || "infotflux@gmail.com";

    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    // Active sales reps list for Admin/Manager filtering
    const salesReps: Array<{ id: string; name: string }> = [];
    if (isAdminOrManager) {
      mockUsersStore
        .filter((u) => u.organizationId === organizationId && u.isActive)
        .forEach((u) => salesReps.push({ id: u.id, name: u.name }));
    }

    const isDemoEmail = (e: MockInboxEmail) => {
      const subject = (e.subject || "").toLowerCase();
      const fromName = (e.fromName || "").toLowerCase();
      const fromEmail = (e.fromEmail || "").toLowerCase();
      const messageId = (e.messageId || "").toLowerCase();
      const id = e.id || "";

      return (
        id === "inbox_msg_1" ||
        id === "inbox_msg_2" ||
        id === "inbox_msg_3" ||
        id.startsWith("inbox_demo_") ||
        id.startsWith("demo_msg_") ||
        fromName.includes("elena rostova") ||
        fromName.includes("marcus vance") ||
        fromName.includes("cloudscale") ||
        fromEmail.includes("cyberdynesys") ||
        fromEmail.includes("vanguardsec") ||
        fromEmail.includes("cloudscale") ||
        fromEmail.includes("roxx-demo") ||
        messageId.includes("cyberdyne") ||
        messageId.includes("vanguard") ||
        messageId.includes("cloudscale") ||
        subject.includes("enterprise demo & implementation timeline") ||
        subject.includes("security evaluation") ||
        subject.includes("partner inquiry: multi-region")
      );
    };

    // Purge any lingering legacy demo emails from memory
    for (let i = mockInboxStore.length - 1; i >= 0; i--) {
      if (isDemoEmail(mockInboxStore[i])) {
        mockInboxStore.splice(i, 1);
      }
    }

    // Deduplicate any repeated sync imports in mockInboxStore.
    // If multiple entries have the same sender, subject, and approximate timestamp (<15s),
    // preserve only one, keeping isRead = true if ANY instance was marked read.
    const dedupedOrgEmails: MockInboxEmail[] = [];
    const seenFingerprints = new Map<string, MockInboxEmail>();

    for (const item of mockInboxStore) {
      if (item.organizationId !== organizationId) {
        dedupedOrgEmails.push(item);
        continue;
      }
      if (isDemoEmail(item)) continue;

      const normSub = (item.subject || "").trim().toLowerCase().replace(/^re:\s*/i, "");
      const timeBucket = Math.floor(new Date(item.date).getTime() / 15000);
      const key = `${item.fromEmail.toLowerCase().trim()}|${normSub}|${timeBucket}`;

      const existing = seenFingerprints.get(key);
      if (!existing) {
        seenFingerprints.set(key, item);
        dedupedOrgEmails.push(item);
      } else {
        if (item.isRead) {
          existing.isRead = true;
        }
        if (!existing.leadId && item.leadId) {
          existing.leadId = item.leadId;
          existing.leadName = item.leadName;
          existing.assignedToName = item.assignedToName;
        }
      }
    }

    mockInboxStore.length = 0;
    mockInboxStore.push(...dedupedOrgEmails);

    // Retrieve emails for this organization - strictly keeping genuine inbox emails
    let emails: MockInboxEmail[] = mockInboxStore.filter(
      (e) => e.organizationId === organizationId && !isDemoEmail(e)
    );

    // Sanitize subjects, sender names, and body text, and link with Leads/Contacts in Postgres & mock store
    for (const e of emails) {
      if (!e.toEmail || e.toEmail === "sales@roxx-demo.com" || e.toEmail === "support@roxx.local") {
        e.toEmail = activeRecipient;
      }
      if (e.subject) {
        e.subject = decodeMimeHeader(e.subject);
      }
      if (e.fromName) {
        e.fromName = decodeMimeHeader(e.fromName);
      }
      if (e.bodyText) {
        const { cleanText } = cleanMimeBody(e.bodyText);
        e.bodyText = cleanText || e.bodyText;
        e.snippet =
          cleanText
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120) || e.snippet;
      }

      // Link to Lead or Contact from Postgres or mock store
      const matched = await findMatchingLeadOrContact(organizationId, e.fromEmail);
      if (matched.lead) {
        e.leadId = matched.lead.id;
        e.leadName = matched.lead.fullName;
        e.assignedToName = matched.lead.ownerName || null;

        // Ensure this client reply is logged on the Lead Interaction Timeline
        await logInboundReplyActivity({
          organizationId,
          leadId: matched.lead.id,
          leadName: matched.lead.fullName,
          userId: matched.lead.ownerId || session.id,
          cleanSubject: e.subject,
          cleanFromName: e.fromName || e.fromEmail,
          fromEmail: e.fromEmail,
          activeEmail: activeRecipient,
          cleanText: e.bodyText || e.snippet,
          date: e.date,
        });
      } else if (matched.contact) {
        e.contactId = matched.contact.id;
        e.assignedToName = matched.contact.ownerName || null;

        await logInboundReplyActivity({
          organizationId,
          contactId: matched.contact.id,
          contactName: matched.contact.fullName,
          userId: matched.contact.ownerId || session.id,
          cleanSubject: e.subject,
          cleanFromName: e.fromName || e.fromEmail,
          fromEmail: e.fromEmail,
          activeEmail: activeRecipient,
          cleanText: e.bodyText || e.snippet,
          date: e.date,
        });
      }
    }

    // Scoping Rule:
    // Admin and Manager can see ALL emails.
    // Sales Reps can see ONLY their own assigned client emails.
    if (!isAdminOrManager) {
      const { ownedLeadIds, ownedContactIds, clientEmails } = await resolveClientOwnership(
        organizationId,
        session.id,
        session.name
      );
      const userEmailNorm = session.email?.toLowerCase().trim();

      emails = emails.filter((e) => {
        if (e.leadId && ownedLeadIds.has(e.leadId)) return true;
        if (e.contactId && ownedContactIds.has(e.contactId)) return true;
        const sender = e.fromEmail?.toLowerCase().trim();
        if (sender && clientEmails.has(sender)) return true;
        const recipient = e.toEmail?.toLowerCase().trim();
        if (userEmailNorm && recipient === userEmailNorm) return true;

        // Hide emails that do not belong to this sales rep's clients
        return false;
      });
    } else {
      // Optional Admin / Manager filtering
      if (params?.assignedTo && params.assignedTo !== "all") {
        if (params.assignedTo === "my_clients") {
          const { ownedLeadIds, ownedContactIds, clientEmails } = await resolveClientOwnership(
            organizationId,
            session.id,
            session.name
          );
          emails = emails.filter((e) => {
            if (e.leadId && ownedLeadIds.has(e.leadId)) return true;
            if (e.contactId && ownedContactIds.has(e.contactId)) return true;
            const sender = e.fromEmail?.toLowerCase().trim();
            if (sender && clientEmails.has(sender)) return true;
            return false;
          });
        } else {
          const targetRep = mockUsersStore.find(
            (u) => u.id === params.assignedTo || u.name === params.assignedTo
          );
          const { ownedLeadIds, ownedContactIds, clientEmails } = await resolveClientOwnership(
            organizationId,
            params.assignedTo,
            targetRep?.name
          );
          emails = emails.filter((e) => {
            if (e.leadId && ownedLeadIds.has(e.leadId)) return true;
            if (e.contactId && ownedContactIds.has(e.contactId)) return true;
            const sender = e.fromEmail?.toLowerCase().trim();
            if (sender && clientEmails.has(sender)) return true;
            return false;
          });
        }
      } else if (params?.filter === "my_clients") {
        const { ownedLeadIds, ownedContactIds, clientEmails } = await resolveClientOwnership(
          organizationId,
          session.id,
          session.name
        );
        emails = emails.filter((e) => {
          if (e.leadId && ownedLeadIds.has(e.leadId)) return true;
          if (e.contactId && ownedContactIds.has(e.contactId)) return true;
          const sender = e.fromEmail?.toLowerCase().trim();
          if (sender && clientEmails.has(sender)) return true;
          return false;
        });
      }
    }

    const unreadCount = emails.filter((e) => !e.isRead).length;

    // Apply filter
    const filter = params?.filter || "all";
    if (filter === "replies") {
      emails = emails.filter((e) => Boolean(e.leadId || e.contactId || e.inReplyTo));
    } else if (filter === "unread") {
      emails = emails.filter((e) => !e.isRead);
    }

    // Apply search query
    const search = params?.search?.trim().toLowerCase();
    if (search) {
      emails = emails.filter(
        (e) =>
          e.fromEmail.toLowerCase().includes(search) ||
          e.fromName.toLowerCase().includes(search) ||
          e.subject.toLowerCase().includes(search) ||
          e.snippet.toLowerCase().includes(search) ||
          (e.leadName && e.leadName.toLowerCase().includes(search)) ||
          (e.assignedToName && e.assignedToName.toLowerCase().includes(search))
      );
    }

    // Sort newest first
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: emails,
      unreadCount,
      connectedEmail: activeRecipient,
      userRole: session.role || "SALES_USER",
      isAdminOrManager,
      salesReps,
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: [],
      unreadCount: 0,
      connectedEmail: "",
      error: (error as Error)?.message || "Failed to load inbox emails.",
    };
  }
}

/**
 * Triggers IMAP synchronization to fetch recent emails, match them against Leads/Contacts,
 * and automatically log touchpoint activities on the CRM timeline.
 */
export async function syncInboxAction(): Promise<{
  success: boolean;
  count: number;
  syncedReplies: number;
  connectedEmail?: string;
  message?: string;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, count: 0, syncedReplies: 0, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);
    const { connectedEmail, smtpConfig, imapConfig } =
      await resolveOrganizationMailConfig(organizationId);

    const activeEmail = connectedEmail || session.email || "infotflux@gmail.com";

    let fetchedMessages: Array<{
      messageId: string;
      fromEmail: string;
      fromName: string;
      toEmail: string;
      subject: string;
      snippet: string;
      bodyText: string;
      bodyHtml?: string;
      date: string;
      inReplyTo?: string;
    }> = [];

    // Attempt live IMAP synchronization if credentials exist
    if (imapConfig && imapConfig.host && imapConfig.username && imapConfig.encryptedPassword) {
      const password = decryptSecret(imapConfig.encryptedPassword);
      if (password) {
        try {
          const fetchRes = await fetchImapInbox(
            {
              host: imapConfig.host,
              port: imapConfig.port || 993,
              secure: imapConfig.secure ?? true,
              username: imapConfig.username,
              password,
            },
            25
          );

          if (fetchRes.success && fetchRes.messages.length > 0) {
            fetchedMessages = fetchRes.messages;
          }
        } catch (fetchErr) {
          console.warn("IMAP live fetch fallback:", fetchErr);
        }
      }
    }

    let newCount = 0;
    let matchedReplies = 0;

    for (const msg of fetchedMessages) {
      const cleanSubject = decodeMimeHeader(msg.subject);
      const cleanFromName = decodeMimeHeader(msg.fromName || msg.fromEmail);
      const normSubject = cleanSubject.toLowerCase().trim();
      const normSender = msg.fromEmail.toLowerCase().trim();

      // Avoid duplicate imports and preserve read state
      const existing = mockInboxStore.find((e) => {
        if (e.organizationId !== organizationId) return false;
        if (e.messageId && msg.messageId && e.messageId === msg.messageId) return true;
        const sameSender = e.fromEmail.toLowerCase().trim() === normSender;
        const sameSubject = e.subject.toLowerCase().trim() === normSubject;
        if (sameSender && sameSubject) {
          const t1 = new Date(e.date).getTime();
          const t2 = new Date(msg.date).getTime();
          if (!isNaN(t1) && !isNaN(t2) && Math.abs(t1 - t2) < 60000) {
            return true;
          }
        }
        return false;
      });

      if (existing) {
        // Message already exists! Strictly preserve isRead state - NEVER mark unread again on sync!
        if (!existing.leadId && !existing.contactId) {
          const { lead: mLead, contact: mContact } = await findMatchingLeadOrContact(
            organizationId,
            msg.fromEmail
          );
          if (mLead) {
            existing.leadId = mLead.id;
            existing.leadName = mLead.fullName;
            existing.assignedToName = mLead.ownerName || undefined;
          } else if (mContact) {
            existing.contactId = mContact.id;
            existing.assignedToName = mContact.ownerName || undefined;
          }
        }
        continue;
      }

      // Match sender against Leads and Contacts (Prisma DB first, then mock)
      const { lead: matchedLead, contact: matchedContact } = await findMatchingLeadOrContact(
        organizationId,
        msg.fromEmail
      );

      const { cleanText, cleanHtml } = cleanMimeBody(msg.bodyText || msg.snippet);
      const cleanSnippet = cleanText
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      const inboxEntry: MockInboxEmail = {
        id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        organizationId,
        messageId: msg.messageId,
        fromEmail: msg.fromEmail,
        fromName: cleanFromName,
        toEmail: activeEmail,
        subject: cleanSubject,
        snippet: cleanSnippet || "(No preview available)",
        bodyText: cleanText || cleanSnippet,
        bodyHtml: cleanHtml,
        date: msg.date,
        isRead: false,
        leadId: matchedLead?.id,
        leadName: matchedLead?.fullName,
        contactId: matchedContact?.id,
        assignedToName: matchedLead?.ownerName || matchedContact?.ownerName,
        inReplyTo: msg.inReplyTo,
        createdAt: new Date().toISOString(),
      };

      mockInboxStore.unshift(inboxEntry);
      newCount++;

      // Log incoming email reply to the activity timeline (Prisma DB + mock store)
      if (matchedLead || matchedContact) {
        matchedReplies++;
        try {
          await logInboundReplyActivity({
            organizationId,
            leadId: matchedLead?.id,
            leadName: matchedLead?.fullName,
            contactId: matchedContact?.id,
            contactName: matchedContact?.fullName,
            userId: matchedLead?.ownerId || matchedContact?.ownerId || session.id,
            cleanSubject,
            cleanFromName,
            fromEmail: msg.fromEmail,
            activeEmail,
            cleanText: cleanText || cleanSnippet,
            date: msg.date,
          });
        } catch (actErr) {
          console.warn("Failed to log activity for inbound email:", actErr);
        }
      }
    }

    // Update lastSyncedAt
    if (imapConfig) {
      imapConfig.lastSyncedAt = new Date().toISOString();
      mockImapStore[organizationId] = imapConfig;
    }

    try {
      revalidatePath("/inbox");
      revalidatePath("/leads");
    } catch {
      // Ignore during tests
    }

    return {
      success: true,
      count: newCount,
      syncedReplies: matchedReplies,
      connectedEmail: activeEmail,
      message:
        newCount > 0
          ? `Synced ${newCount} incoming message(s) for ${activeEmail} (${matchedReplies} matched to existing Leads/Contacts).`
          : `Synchronized with ${activeEmail}. All client replies are up to date.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      count: 0,
      syncedReplies: 0,
      error: (error as Error)?.message || "Failed to sync incoming mail.",
    };
  }
}

/**
 * Toggle or mark an email as read/unread
 */
export async function markEmailAsReadAction(
  emailId: string,
  isRead: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);

    const email = mockInboxStore.find(
      (e) => e.id === emailId && e.organizationId === organizationId
    );
    if (!email) {
      return { success: false, error: "Email not found" };
    }

    email.isRead = isRead;

    try {
      revalidatePath("/inbox");
    } catch {
      // Ignore during testing
    }

    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || "Failed to update email status.",
    };
  }
}

/**
 * Reply directly to a client email from within the CRM Inbox
 */
export async function replyToClientAction(
  rawInput: ReplyEmailInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);

    const parsed = replyEmailSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid reply parameters.",
      };
    }

    const { emailId, to, subject, body, leadId, inReplyTo } = parsed.data;

    // Load active SMTP configuration
    let config = mockSmtpStore[organizationId];
    if (!config) {
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
          config = JSON.parse(setting.value);
        }
      } catch {
        // ignore
      }
    }

    if (!config || !config.host || !config.username || !config.encryptedPassword) {
      return {
        success: false,
        error: "SMTP is not configured. Please configure outbound email in Settings > Email to send replies.",
      };
    }

    const password = decryptSecret(config.encryptedPassword);
    if (!password) {
      return {
        success: false,
        error: "Unable to decrypt SMTP credentials. Please re-enter your password in Settings > Email.",
      };
    }

    // Send email via SMTP with RFC In-Reply-To header
    const sendRes = await mailer.sendSmtpEmail(
      {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
        password,
      },
      {
        to,
        fromName: config.fromName || session.name,
        fromEmail: config.fromEmail || config.username,
        subject,
        body,
        inReplyTo,
        references: inReplyTo,
      }
    );

    if (!sendRes.success) {
      return {
        success: false,
        error: sendRes.error || "Failed to dispatch email reply via SMTP.",
      };
    }

    // Mark original email as read
    const originalEmail = mockInboxStore.find(
      (e) => e.id === emailId && e.organizationId === organizationId
    );
    if (originalEmail) {
      originalEmail.isRead = true;
    }

    // Record reply activity on timeline
    try {
      await logActivityAction({
        type: "EMAIL",
        subject: subject.trim(),
        description: `Reply to ${to}:\n\n${body.trim()}`,
        activityAt: new Date().toISOString(),
        outcome: "REPLIED",
        leadId: leadId || originalEmail?.leadId,
        contactId: originalEmail?.contactId,
      });
    } catch {
      // Direct store fallback if permission check redirects
      const leadMatch = leadId ? mockLeadsStore.find((l) => l.id === leadId) : null;
      mockActivitiesStore.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        organizationId,
        type: "EMAIL",
        subject: subject.trim(),
        description: `Reply to ${to}:\n\n${body.trim()}`,
        leadId: leadId || originalEmail?.leadId || null,
        leadName: leadMatch?.fullName || originalEmail?.leadName || null,
        companyId: null,
        companyName: null,
        contactId: originalEmail?.contactId || null,
        contactName: null,
        opportunityId: null,
        opportunityName: null,
        userId: session.id,
        userName: session.name,
        activityAt: new Date().toISOString(),
        durationMinutes: null,
        outcome: "REPLIED",
        createdAt: new Date().toISOString(),
      });
    }

    try {
      revalidatePath("/inbox");
      if (leadId) revalidatePath(`/leads/${leadId}`);
    } catch {
      // Ignore during testing
    }

    return {
      success: true,
      message: `Reply successfully delivered to ${to} from ${config.username}.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || "Failed to send reply.",
    };
  }
}

/**
 * Permanently deletes an email from the inbox.
 */
export async function deleteInboxEmailAction(emailId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);

    const index = mockInboxStore.findIndex(
      (e) => e.id === emailId && e.organizationId === organizationId
    );
    if (index !== -1) {
      mockInboxStore.splice(index, 1);
    }

    try {
      revalidatePath("/inbox");
    } catch {
      // Ignore during test executions
    }

    return {
      success: true,
      message: "Email deleted from inbox.",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || "Failed to delete email.",
    };
  }
}

/**
 * Explicitly purges all demo and sample emails, keeping only genuine incoming mailbox emails.
 */
export async function clearDemoEmailsAction(): Promise<{
  success: boolean;
  purgedCount: number;
  message?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, purgedCount: 0 };
    }
    const { organizationId } = await resolveTenantContext(session);

    const demoEmailIds = new Set(["inbox_msg_1", "inbox_msg_2", "inbox_msg_3"]);
    const demoDomains = ["cyberdynesys.local", "vanguardsec.local", "cloudscale-solutions.com", "roxx-demo.com"];

    let purgedCount = 0;
    for (let i = mockInboxStore.length - 1; i >= 0; i--) {
      const item = mockInboxStore[i];
      if (
        item.organizationId === organizationId &&
        (demoEmailIds.has(item.id) ||
          demoDomains.some(
            (d) => item.fromEmail?.toLowerCase().includes(d) || item.messageId?.toLowerCase().includes(d)
          ))
      ) {
        mockInboxStore.splice(i, 1);
        purgedCount++;
      }
    }

    try {
      revalidatePath("/inbox");
    } catch {
      // Ignore during tests
    }

    return {
      success: true,
      purgedCount,
      message: `Cleaned ${purgedCount} demo emails. Only genuine inbox emails remain.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      purgedCount: 0,
    };
  }
}

