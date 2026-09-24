import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Automatically detect Vercel Storage prefixed environment variables (e.g. roxxcrm_DATABASE_URL)
const resolvedDbUrl =
  process.env.DATABASE_URL ||
  process.env.roxxcrm_POSTGRES_PRISMA_URL ||
  process.env.roxxcrm_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (resolvedDbUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedDbUrl;
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL =
    process.env.roxxcrm_DATABASE_URL_UNPOOLED ||
    process.env.roxxcrm_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL_NON_POOLING ||
    resolvedDbUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedDbUrl
      ? {
          datasources: {
            db: {
              url: resolvedDbUrl,
            },
          },
        }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

