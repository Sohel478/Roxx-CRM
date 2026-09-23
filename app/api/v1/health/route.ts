import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs: number | null = null;

  try {
    const dbStart = Date.now();
    // Simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
    // In local development or during builds before DB credentials are provided,
    // we record the error rather than throwing an unhandled exception.
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
