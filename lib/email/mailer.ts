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
 * Dispatches an email via the tenant's own SMTP connection.
 */
export async function sendSmtpEmail(
  connection: SmtpConnectionOptions,
  mail: SendMailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporter(connection);

    const fromAddress = mail.fromName
      ? `"${mail.fromName}" <${mail.fromEmail || connection.username}>`
      : mail.fromEmail || connection.username;

    // Convert plain text newlines into formatted HTML paragraphs
    const formattedHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
        ${mail.body
          .split("\n\n")
          .map((p) => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
          .join("")}
      </div>
    `.trim();

    const info = await transporter.sendMail({
      from: fromAddress,
      to: mail.to,
      subject: mail.subject,
      text: mail.body,
      html: formattedHtml,
    });

    return {
      success: true,
      messageId: info.messageId,
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
