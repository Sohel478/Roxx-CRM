import { prisma } from "@/lib/db/prisma";
import { SessionUser } from "./session";

interface CachedTenantContext {
  organizationId: string;
  userId: string | null;
  expiresAt: number;
}

// In-memory cache to prevent repeated database queries on every user action
const tenantCache = new Map<string, CachedTenantContext>();

/**
 * Resolves the real database organizationId and userId for a given session.
 * Prevents foreign key constraint violations if the user's session cookie
 * was created with fallback/demo IDs before the live database was connected.
 */
export async function resolveTenantContext(session: SessionUser): Promise<{
  organizationId: string;
  userId: string | null;
}> {
  const cacheKey = `${session.organizationId}:${session.id}`;
  const now = Date.now();
  const cached = tenantCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      organizationId: cached.organizationId,
      userId: cached.userId,
    };
  }

  try {
    const isMock =
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes("ep-sample-pooler");

    if (isMock) {
      return {
        organizationId: session.organizationId,
        userId: session.id,
      };
    }

    // 1. Resolve Organization
    let org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { id: true },
    });

    if (!org) {
      // Find the primary organization in the database
      org = await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (!org) {
        // Create the organization if none exists
        org = await prisma.organization.create({
          data: {
            name: session.organizationName || "Demo Company",
            slug: "demo-company",
          },
          select: { id: true },
        });
      }
    }

    const organizationId = org ? org.id : session.organizationId;

    // 2. Resolve User
    let user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: session.email },
            { organizationId },
          ],
        },
        select: { id: true },
      });
    }

    const resolved = {
      organizationId,
      userId: user ? user.id : null,
    };

    tenantCache.set(cacheKey, {
      ...resolved,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes TTL
    });

    return resolved;
  } catch (err) {
    console.error("[resolveTenantContext] Error resolving tenant context:", err);
    return {
      organizationId: session.organizationId,
      userId: session.id,
    };
  }
}
