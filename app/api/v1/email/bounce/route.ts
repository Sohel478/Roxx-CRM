import { NextRequest, NextResponse } from "next/server";
import { recordEmailBounce } from "@/lib/email/tracking";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = body.campaignId || "";
    const leadId = body.leadId || "";
    const email = body.email || "";
    const reason = body.reason || "Permanent bounce / mailbox unavailable";

    if (!email && !leadId) {
      return NextResponse.json(
        { success: false, error: "email or leadId is required" },
        { status: 400 }
      );
    }

    await recordEmailBounce(campaignId, leadId, email, reason);

    return NextResponse.json({
      success: true,
      message: "Bounce recorded successfully and email suppressed from future campaigns.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Invalid payload" },
      { status: 400 }
    );
  }
}
