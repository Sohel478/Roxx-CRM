import { NextRequest, NextResponse } from "next/server";
import { recordEmailOpen } from "@/lib/email/tracking";

// 1x1 transparent GIF binary in base64
const TRANSPARENT_1X1_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cid = searchParams.get("cid");
  const lid = searchParams.get("lid");

  if (cid && lid) {
    try {
      await recordEmailOpen(cid, lid);
    } catch (err) {
      console.warn("[/api/v1/email/track/open] Tracking open warning:", err);
    }
  }

  return new NextResponse(TRANSPARENT_1X1_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": TRANSPARENT_1X1_GIF.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
