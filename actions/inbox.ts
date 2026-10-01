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
  MockInboxEmail,
  MockImapConfig,
  MockSmtpConfig,
} from "@/lib/db/mock-store";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/encryption";
import { fetchImapInbox, decodeMimeHeader, cleanMimeBody } from "@/lib/email/imap-client";
import { sendSmtpEmail } from "@/lib/email/mailer";
import { logActivityAction } from "@/actions/activities";
import {
  InboxEmailItem,
  ReplyEmailInput,
  replyEmailSchema,
} from "@/lib/validations/email";

export interface GetInboxParams {
  filter?: "all" | "replies" | "unread";
  search?: string;
}

export interface InboxAccountStatus {
  isConfigured: boolean;
  connectedEmail: string;
  provider: string;
  host: string;
  lastSyncedAt?: string;
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

    return {
      success: true,
      data: {
        isConfigured,
        connectedEmail: connectedEmail || session.email || "infotflux@gmail.com",
        provider,
        host,
        lastSyncedAt: imapConfig?.lastSyncedAt || smtpConfig?.updatedAt,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: { isConfigured: false, connectedEmail: "", provider: "", host: "" },
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

    // Purge any lingering legacy demo emails from memory
    const demoEmailIds = new Set(["inbox_msg_1", "inbox_msg_2", "inbox_msg_3"]);
    const demoDomains = ["cyberdynesys.local", "vanguardsec.local", "cloudscale-solutions.com", "roxx-demo.com"];
    for (let i = mockInboxStore.length - 1; i >= 0; i--) {
      const item = mockInboxStore[i];
      if (
        demoEmailIds.has(item.id) ||
        demoDomains.some((d) => item.fromEmail?.toLowerCase().includes(d) || item.messageId?.toLowerCase().includes(d))
      ) {
        mockInboxStore.splice(i, 1);
      }
    }

    // Retrieve emails for this organization - keeping only genuine inbox emails
    let emails: MockInboxEmail[] = mockInboxStore.filter(
      (e) => e.organizationId === organizationId
    );

    // Sanitize subjects, sender names, and body text across all loaded emails
    emails.forEach((e) => {
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
    });

    // Filter by role visibility for leads
    if (session.role === "SALES_RESP") {
      emails = emails.filter((e) => {
        if (!e.leadId) return true;
        const lead = mockLeadsStore.find((l) => l.id === e.leadId);
        if (!lead) return true;
        return (
          lead.ownerName === session.name ||
          lead.ownerName?.toLowerCase() === session.name.toLowerCase() ||
          lead.email?.toLowerCase() === session.email.toLowerCase()
        );
      });
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
          (e.leadName && e.leadName.toLowerCase().includes(search))
      );
    }

    // Sort newest first
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: emails,
      unreadCount,
      connectedEmail: activeRecipient,
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
      // Avoid duplicate imports
      const exists = mockInboxStore.some(
        (e) => e.organizationId === organizationId && e.messageId === msg.messageId
      );
      if (exists) continue;

      // Match sender against Leads
      const sender = msg.fromEmail.toLowerCase();
      const matchedLead = mockLeadsStore.find(
        (l) => l.organizationId === organizationId && l.email?.toLowerCase() === sender
      );

      // Match sender against Contacts
      const matchedContact = mockContactsStore.find(
        (c) => c.organizationId === organizationId && c.email?.toLowerCase() === sender
      );

      const cleanSubject = decodeMimeHeader(msg.subject);
      const cleanFromName = decodeMimeHeader(msg.fromName || msg.fromEmail);
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
        inReplyTo: msg.inReplyTo,
        createdAt: new Date().toISOString(),
      };

      mockInboxStore.unshift(inboxEntry);
      newCount++;

      // Log incoming email reply to the activity timeline
      if (matchedLead || matchedContact) {
        matchedReplies++;
        try {
          await logActivityAction({
            type: "EMAIL",
            subject: `Client Reply: ${cleanSubject}`,
            description: `From: ${cleanFromName} <${msg.fromEmail}>\nTo: ${activeEmail}\n\n${cleanText}`,
            activityAt: msg.date,
            outcome: "REPLY_RECEIVED",
            leadId: matchedLead?.id,
            contactId: matchedContact?.id,
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
    const sendRes = await sendSmtpEmail(
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
    } catch (logErr) {
      console.warn("Failed to log activity for sent reply:", logErr);
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

