export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function generateTrackingUrls(
  campaignOrDispatchId: string,
  leadId: string,
  recipientEmail?: string,
  customBaseUrl?: string
): {
  openTrackingUrl: string;
  clickTrackingSampleUrl: string;
  unsubscribeUrl: string;
  baseUrl: string;
} {
  const baseUrl = (customBaseUrl || getAppBaseUrl()).replace(/\/$/, "");
  const cid = encodeURIComponent(campaignOrDispatchId || "direct");
  const lid = encodeURIComponent(leadId || "lead");
  const emailParam = recipientEmail ? `&email=${encodeURIComponent(recipientEmail)}` : "";

  return {
    baseUrl,
    openTrackingUrl: `${baseUrl}/api/v1/email/track/open?cid=${cid}&lid=${lid}`,
    clickTrackingSampleUrl: `${baseUrl}/api/v1/email/track/click?cid=${cid}&lid=${lid}&url=${encodeURIComponent(
      "https://roxx-crm.com"
    )}`,
    unsubscribeUrl: `${baseUrl}/api/v1/email/unsubscribe?cid=${cid}&lid=${lid}${emailParam}`,
  };
}
