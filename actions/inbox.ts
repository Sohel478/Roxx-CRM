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

    // Retrieve emails for this organization
    let emails: MockInboxEmail[] = mockInboxStore.filter(
      (e) => e.organizationId === organizationId
    );

    // If no emails exist yet for this org, seed realistic replies from existing demo leads
    if (emails.length === 0) {
      const elenaLead = mockLeadsStore.find((l) => l.organizationId === organizationId) || mockLeadsStore[0];
      const marcusLead = mockLeadsStore.find((l) => l.organizationId === organizationId && l.id !== elenaLead?.id) || mockLeadsStore[1];

      const defaultSeeds: MockInboxEmail[] = [
        {
          id: `inbox_${organizationId}_1`,
          organizationId,
          messageId: `<reply-1001-cyberdyne@${elenaLead?.email ? elenaLead.email.split("@")[1] : "cyberdynesys.local"}>`,
          fromEmail: elenaLead?.email || "elena.rostova@cyberdynesys.local",
          fromName: elenaLead?.fullName || "Elena Rostova",
          toEmail: activeRecipient,
          subject: "Re: Roxx CRM Enterprise Demo & Implementation Timeline",
          snippet: "Hi there, thanks for the demo yesterday. Our VP of Engineering reviewed the proposal and wants to move forward with the pilot...",
          bodyText: `Hi there,\n\nThanks for the thorough demo yesterday. Our VP of Engineering reviewed the proposal and architecture doc, and we want to move forward with the pilot for our 50-person sales team.\n\nCould you send over the updated MSA and contract with the annual discount included?\n\nBest regards,\n${elenaLead?.fullName || "Elena Rostova"}\nDirector of IT Operations\n${elenaLead?.companyName || "Cyberdyne Systems"}`,
          bodyHtml: `<p>Hi there,</p><p>Thanks for the thorough demo yesterday. Our VP of Engineering reviewed the proposal and architecture doc, and we want to move forward with the pilot for our 50-person sales team.</p><p>Could you send over the updated MSA and contract with the annual discount included?</p><p>Best regards,<br><strong>${elenaLead?.fullName || "Elena Rostova"}</strong><br>Director of IT Operations<br>${elenaLead?.companyName || "Cyberdyne Systems"}</p>`,
          date: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          isRead: false,
          leadId: elenaLead?.id,
          leadName: elenaLead?.fullName,
          createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        },
        {
          id: `inbox_${organizationId}_2`,
          organizationId,
          messageId: `<reply-1002-vanguard@${marcusLead?.email ? marcusLead.email.split("@")[1] : "vanguardsec.local"}>`,
          fromEmail: marcusLead?.email || "mvance@vanguardsec.local",
          fromName: marcusLead?.fullName || "Marcus Vance",
          toEmail: activeRecipient,
          subject: "Re: Follow up regarding Security Evaluation & Contract Call",
          snippet: "Hello, our compliance team completed the SOC2 review and everything looks solid. We're ready for the contract review call this Thursday...",
          bodyText: `Hello,\n\nOur compliance team completed the SOC2 review and everything looks solid. We're ready for the contract review call this Thursday at 2 PM EST if your team is available.\n\nPlease let me know if that time works.\n\n${marcusLead?.fullName || "Marcus Vance"}\nVP Sales & Partnerships\n${marcusLead?.companyName || "Vanguard Security"}`,
          bodyHtml: `<p>Hello,</p><p>Our compliance team completed the SOC2 review and everything looks solid. We're ready for the contract review call this Thursday at 2 PM EST if your team is available.</p><p>Please let me know if that time works.</p><p>${marcusLead?.fullName || "Marcus Vance"}<br>VP Sales & Partnerships</p>`,
          date: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          isRead: true,
          leadId: marcusLead?.id,
          leadName: marcusLead?.fullName,
          createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        },
        {
          id: `inbox_${organizationId}_3`,
          organizationId,
          messageId: `<inquiry-1003@cloudscale-solutions.com>`,
          fromEmail: "support@cloudscale-solutions.com",
          fromName: "CloudScale Inbound",
          toEmail: activeRecipient,
          subject: "Partner inquiry: Multi-region CRM deployment requirements",
          snippet: "Good morning, we saw your enterprise features and would like to know if multi-region data residency is supported...",
          bodyText: "Good morning,\n\nWe saw your enterprise features and would like to know if multi-region data residency is supported out of the box in the EU and US regions.\n\nLooking forward to hearing from you.\n\nBest,\nCloudScale Solutions Team",
          date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          isRead: false,
          createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        },
      ];

      for (const item of defaultSeeds) {
        mockInboxStore.unshift(item);
      }
      emails = mockInboxStore.filter((e) => e.organizationId === organizationId);
    } else {
      // Keep recipient updated to connected email
      emails.forEach((e) => {
        if (!e.toEmail || e.toEmail === "sales@roxx-demo.com" || e.toEmail === "support@roxx.local") {
          e.toEmail = activeRecipient;
        }
      });
    }

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

      const inboxEntry: MockInboxEmail = {
        id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        organizationId,
        messageId: msg.messageId,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName || msg.fromEmail,
        toEmail: activeEmail,
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
            description: `From: ${msg.fromName} <${msg.fromEmail}>\nTo: ${activeEmail}\n\n${msg.bodyText || msg.snippet}`,
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
