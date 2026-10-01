import nodemailer from "nodemailer";

export interface SmtpConnectionOptions {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  inReplyTo?: string;
  references?: string;
}

/**
 * Creates a configured Nodemailer Transporter
 */
export function createTransporter(options: SmtpConnectionOptions) {
  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure, // true for 465, false for 587 or other STARTTLS ports
    auth: {
      user: options.username,
      pass: options.password || "",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false, // Allows self-signed certificates in dev/on-prem environments
    },
  });
}

/**
 * Verifies that the SMTP credentials and server handshake are valid.
 */
export async function verifySmtp(
  options: SmtpConnectionOptions
): Promise<{ success: boolean; error?: string }> {
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
 * to maximize inbox deliverability and prevent spam classification.
 */
export async function sendSmtpEmail(
  connection: SmtpConnectionOptions,
  mail: SendMailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporter(connection);

    const senderEmail = mail.fromEmail || connection.username;
    const fromAddress = mail.fromName
      ? `"${mail.fromName}" <${senderEmail}>`
      : senderEmail;

    // Extract domain for RFC-compliant Message-ID alignment
    let domain = "roxx-crm.com";
    if (senderEmail.includes("@")) {
      domain = senderEmail.split("@")[1].trim().toLowerCase();
    }

    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${domain}>`;

    // Convert plain text newlines into formatted, responsive HTML5 document
    const paragraphsHtml = mail.body
      .split("\n\n")
      .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mail.subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; background-color: #ffffff; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${paragraphsHtml}
  </div>
</body>
</html>`.trim();

    const info = await transporter.sendMail({
      from: fromAddress,
      to: mail.to,
      subject: mail.subject,
      text: mail.body,
      html: fullHtml,
      replyTo: senderEmail,
      messageId,
      date: new Date(),
      headers: {
        "X-Mailer": "Roxx CRM Mailer (Enterprise Communication)",
        ...(mail.inReplyTo ? { "In-Reply-To": mail.inReplyTo } : {}),
        ...(mail.references ? { "References": mail.references } : {}),
      },
    });

    return {
      success: true,
      messageId: info.messageId || messageId,
    };
  } catch (error: unknown) {
    console.error("Nodemailer send error:", error);
    const err = error as { response?: string; message?: string };
    const errorMessage =
      err?.response || err?.message || "Failed to send email via SMTP.";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
