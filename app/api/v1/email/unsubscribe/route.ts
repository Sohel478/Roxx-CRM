import { NextRequest, NextResponse } from "next/server";
import { recordEmailUnsubscribe } from "@/lib/email/tracking";

/**
 * Handles RFC 8058 One-Click Unsubscribe requests (e.g. from Gmail / Yahoo List-Unsubscribe-Post)
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid") || "unsub";
  const lid = searchParams.get("lid") || "unsub";
  const email = searchParams.get("email") || "";

  if (email || (cid && lid)) {
    try {
      await recordEmailUnsubscribe(cid, lid, email);
    } catch (err) {
      console.warn("[/api/v1/email/unsubscribe POST] Unsubscribe warning:", err);
    }
  }

  return NextResponse.json({
    success: true,
    message: "You have been successfully unsubscribed from this mailing list.",
  });
}

/**
 * Handles browser click unsubscription requests and renders an informative confirmation screen
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid") || "unsub";
  const lid = searchParams.get("lid") || "unsub";
  const email = searchParams.get("email") || "";

  if (email || (cid && lid)) {
    try {
      await recordEmailUnsubscribe(cid, lid, email);
    } catch (err) {
      console.warn("[/api/v1/email/unsubscribe GET] Unsubscribe warning:", err);
    }
  }

  const safeEmail = email ? email.replace(/[<>"']/g, "") : "your email address";

  const confirmationHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Roxx CRM</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #ffffff;
      max-width: 480px;
      width: 90%;
      margin: 20px auto;
      padding: 40px 32px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .icon-badge {
      width: 56px;
      height: 56px;
      background-color: #ecfdf5;
      color: #059669;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
      margin: 0 0 24px;
    }
    .email-highlight {
      font-weight: 600;
      color: #334155;
    }
    .footer-text {
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <h1>You have been unsubscribed</h1>
    <p>
      We have removed <span class="email-highlight">${safeEmail}</span> from our marketing and outreach lists. You will not receive any further automated outreach messages.
    </p>
    <div class="footer-text">
      Roxx CRM Email Preference Center
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(confirmationHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
