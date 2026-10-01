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
} from "@/lib/db/mock-store";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/encryption";
import { fetchImapInbox } from "@/lib/email/imap-client";
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

/**
 * Fetch list of incoming emails with optional filtering and search.
 */
export async function getInboxEmailsAction(params?: GetInboxParams): Promise<{
  success: boolean;
  data: InboxEmailItem[];
  unreadCount: number;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, data: [], unreadCount: 0, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);

    // Retrieve emails for this organization
    let emails: MockInboxEmail[] = mockInboxStore.filter(
      (e) => e.organizationId === organizationId
    );

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
    };
  } catch (error: unknown) {
    return {
      success: false,
      data: [],
      unreadCount: 0,
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
  message?: string;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, count: 0, syncedReplies: 0, error: "Authentication required" };
    }
    const { organizationId } = await resolveTenantContext(session);

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
      if (setting?.value) {
        imapConfig = JSON.parse(setting.value);
      }
    } catch {
      imapConfig = mockImapStore[organizationId] || null;
    }

    if (!imapConfig && mockImapStore[organizationId]) {
      imapConfig = mockImapStore[organizationId];
    }

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

    if (imapConfig && imapConfig.host && imapConfig.username && imapConfig.encryptedPassword) {
      const password = decryptSecret(imapConfig.encryptedPassword);
      if (password) {
        const fetchRes = await fetchImapInbox(
          {
            host: imapConfig.host,
            port: imapConfig.port,
            secure: imapConfig.secure,
            username: imapConfig.username,
            password,
          },
          25
        );

        if (fetchRes.success && fetchRes.messages.length > 0) {
          fetchedMessages = fetchRes.messages;
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

      const inboxEntry: MockInboxEmail = {
        id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        organizationId,
        messageId: msg.messageId,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName || msg.fromEmail,
        toEmail: msg.toEmail,
        subject: msg.subject,
        snippet: msg.snippet,
        bodyText: msg.bodyText,
        bodyHtml: msg.bodyHtml,
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
            subject: `Client Reply: ${msg.subject}`,
            description: `From: ${msg.fromName} <${msg.fromEmail}>\n\n${msg.bodyText || msg.snippet}`,
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
      message:
        newCount > 0
          ? `Synced ${newCount} message(s) from server (${matchedReplies} matched to existing Leads/Contacts).`
          : "Inbox is up to date. No new incoming messages.",
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
      message: `Reply successfully delivered to ${to}.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error)?.message || "Failed to send reply.",
    };
  }
}
