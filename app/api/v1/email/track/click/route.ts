import { NextRequest, NextResponse } from "next/server";
import { isValidHttpUrl, recordEmailClick } from "@/lib/email/tracking";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  const lid = searchParams.get("lid");
  const targetUrl = searchParams.get("url");

  if (!cid || !lid || !targetUrl || !isValidHttpUrl(targetUrl)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    await recordEmailClick(cid, lid, targetUrl);
  } catch (err) {
    console.warn("[/api/v1/email/track/click] Tracking click warning:", err);
  }

  // Safe redirect to target destination
  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
