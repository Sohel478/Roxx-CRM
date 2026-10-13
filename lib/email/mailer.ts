import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { injectTrackingIntoHtml, getAppBaseUrl } from "./tracking";

export interface SmtpConnectionOptions {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  clientDomain?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  isMarketing?: boolean;
  unsubscribeEmail?: string;
  tracking?: {
    campaignId: string;
    leadId: string;
    trackingBaseUrl?: string;
  };
}

export interface SendSmtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isBounce?: boolean;
  bounceReason?: string;
}

/**
 * Creates a configured Nodemailer Transporter.
 * Avoids sending forged EHLO greetings (e.g. claiming to be 'gmail.com' to Google SMTP)
 * which trigger HELO_DYNAMIC_IPADDR and spoofing penalties.
 */
export function createTransporter(options: SmtpConnectionOptions) {
  const isGoogle =
    options.host.toLowerCase().includes("google") ||
    options.host.toLowerCase().includes("gmail");

  let fqdn = options.clientDomain;
  if (!fqdn && !isGoogle && options.username.includes("@")) {
    const uDomain = options.username.split("@")[1].trim().toLowerCase();
    if (uDomain !== "gmail.com" && uDomain !== "googlemail.com" && uDomain.includes(".")) {
      fqdn = uDomain;
    }
  }

  const transportConfig: SMTPTransport.Options = {
    host: options.host,
    port: options.port,
    secure: options.secure, // true for 465, false for 587 or STARTTLS
    auth: {
      user: options.username,
      pass: options.password || "",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  };

  // Only assign explicit client FQDN if it is a custom domain and not Google
  if (fqdn && !isGoogle) {
    transportConfig.name = fqdn;
  }

  return nodemailer.createTransport(transportConfig);
}

/**
 * Verifies that the SMTP credentials and server handshake are valid.
 */
export async function verifySmtp(
  options: SmtpConnectionOptions
): Promise<{ success: boolean; error?: string }> {
  if (
    options.host === "localhost" ||
    options.host === "127.0.0.1" ||
    options.host === "mock" ||
    options.host.endsWith(".local")
  ) {
    return { success: true };
  }

  try {
    const transporter = createTransporter(options);
    await transporter.verify();
    return { success: true };
  } catch (error: unknown) {
    const err = error as { response?: string; message?: string };
    const errorMessage =
      err?.response || err?.message || "Failed to establish SMTP connection.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Dispatches an email via the tenant's own SMTP connection with RFC-compliant headers
 * formatted as a direct, high-reputation personal/business email to guarantee
 * placement in the recipient's Primary Inbox rather than Spam or Promotions tabs.
 */
export async function sendSmtpEmail(
  connection: SmtpConnectionOptions,
  mail: SendMailOptions
): Promise<SendSmtpResult> {
  if (
    connection.host === "localhost" ||
    connection.host === "127.0.0.1" ||
    connection.host === "mock" ||
    connection.host.endsWith(".local")
  ) {
    return {
      success: true,
      messageId: `<mock-sent-${Date.now()}@roxx-crm.com>`,
    };
  }

  try {
    const senderEmail = (mail.fromEmail || connection.username).trim().toLowerCase();
    const fromAddress = mail.fromName
      ? `"${mail.fromName.trim()}" <${senderEmail}>`
      : senderEmail;

    const transporter = createTransporter(connection);

    const cleanBodyText = mail.body.trim();

    // Natural human HTML formatting: direct paragraph elements in dir="ltr"
    // matches human compose windows in Gmail/Apple Mail rather than marketing templates
    const paragraphsHtml = cleanBodyText
      .split(/\n\n+/)
      .map((p) => `<div style="margin-bottom: 12px;">${p.replace(/\n/g, "<br/>")}</div>`)
      .join("");

    let naturalHtml = `<div dir="ltr" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222;">
${paragraphsHtml}
</div>`;

    if (mail.tracking) {
      naturalHtml = injectTrackingIntoHtml(naturalHtml, {
        campaignId: mail.tracking.campaignId,
        leadId: mail.tracking.leadId,
        recipientEmail: mail.to,
        baseUrl: mail.tracking.trackingBaseUrl,
        isMarketing: mail.isMarketing,
      });
    }

    // Only set replyTo if explicitly provided and distinct from From address
    // (Redundant replyTo equal to from triggers SpamAssassin REPLYTO_SAME_AS_FROM)
    const hasCustomReplyTo =
      mail.replyTo &&
      mail.replyTo.trim().toLowerCase() !== senderEmail;

    const headers: Record<string, string> = {
      // Intentionally omit "X-Mailer" to match native human mail clients
      ...(mail.inReplyTo ? { "In-Reply-To": mail.inReplyTo } : {}),
      ...(mail.references ? { References: mail.references } : {}),
    };

    // Google & Yahoo 2024 Bulk Sender compliance:
    // If sending a bulk marketing campaign, attach RFC 8058 One-Click Unsubscribe headers
    if (mail.isMarketing) {
      const unsubEmail = mail.unsubscribeEmail || senderEmail;
      const baseUrl = (mail.tracking?.trackingBaseUrl || getAppBaseUrl()).replace(/\/$/, "");
      const cid = mail.tracking?.campaignId || "unsub";
      const lid = mail.tracking?.leadId || "unsub";
      const httpUnsubUrl = `${baseUrl}/api/v1/email/unsubscribe?cid=${encodeURIComponent(
        cid
      )}&lid=${encodeURIComponent(lid)}&email=${encodeURIComponent(mail.to)}`;

      headers["List-Unsubscribe"] = `<${httpUnsubUrl}>, <mailto:${unsubEmail}?subject=unsubscribe>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      headers["Precedence"] = "bulk";
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: mail.to,
      subject: mail.subject,
      text: cleanBodyText,
      html: naturalHtml,
      ...(hasCustomReplyTo ? { replyTo: mail.replyTo } : {}),
      date: new Date(),
      envelope: {
        from: senderEmail,
        to: mail.to,
      },
      headers,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    console.error("Nodemailer send error:", error);
    const err = error as {
      responseCode?: number;
      response?: string;
      message?: string;
      code?: string;
    };
    const errorMessage =
      err?.response || err?.message || "Failed to send email via SMTP.";
    const responseCode = err?.responseCode || 0;

    const isBounce =
      (responseCode >= 500 && responseCode < 600) ||
      /550|551|552|553|554|mailbox unavailable|user not found|recipient address rejected|no such user|invalid recipient|domain not found|unrouteable address|does not exist/i.test(
        errorMessage
      );

    return {
      success: false,
      error: errorMessage,
      isBounce,
      bounceReason: isBounce ? errorMessage : undefined,
    };
  }
}
