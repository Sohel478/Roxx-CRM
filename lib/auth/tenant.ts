import { prisma } from "@/lib/db/prisma";
import { SessionUser } from "./session";

/**
 * Resolves the real database organizationId and userId for a given session.
 * Prevents foreign key constraint violations if the user's session cookie
 * was created with fallback/demo IDs before the live database was connected.
 */
export async function resolveTenantContext(session: SessionUser): Promise<{
  organizationId: string;
  userId: string | null;
}> {
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

    return {
      organizationId,
      userId: user ? user.id : null,
    };
  } catch (err) {
    console.error("[resolveTenantContext] Error resolving tenant context:", err);
    return {
      organizationId: session.organizationId,
      userId: session.id,
    };
  }
}
