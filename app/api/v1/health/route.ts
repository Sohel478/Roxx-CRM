import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

let cachedDbResult: {
  status: string;
  latencyMs: number | null;
  checkedAt: number;
} | null = null;

const DB_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  const startTime = Date.now();
  let dbStatus = "connected";
  let dbLatencyMs: number | null = null;

  const url = new URL(request.url);
  const forceDbCheck =
    url.searchParams.get("checkDb") === "1" ||
    url.searchParams.get("deep") === "true";

  const now = Date.now();
  const isCacheValid =
    cachedDbResult && now - cachedDbResult.checkedAt < DB_HEALTH_CACHE_TTL_MS;

  if (forceDbCheck || !isCacheValid) {
    try {
      const dbStart = Date.now();
      // Verify database connectivity
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = "connected";
      cachedDbResult = {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        checkedAt: now,
      };
    } catch {
      dbStatus = "disconnected";
      cachedDbResult = {
        status: dbStatus,
        latencyMs: null,
        checkedAt: now,
      };
    }
  } else {
    dbStatus = cachedDbResult!.status;
    dbLatencyMs = cachedDbResult!.latencyMs;
  }

  const isHealthy = dbStatus === "connected" || !process.env.DATABASE_URL;

  return NextResponse.json(
    {
      success: isHealthy,
      data: {
        status: isHealthy ? "healthy" : "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: "0.1.0",
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        responseTimeMs: Date.now() - startTime,
      },
      message: isHealthy ? "CRM API is operational" : "CRM API is experiencing degraded connectivity",
    },
    { status: isHealthy ? 200 : 503 }
  );
}
