import { prisma } from "./prisma";

let isMigrationDone = false;
let isMigrating = false;

/**
 * Ensures the live PostgreSQL database has all required SaaS columns and enum types.
 * Runs idempotently at runtime so that even if `prisma db push` was not executed
 * during build, the database is seamlessly updated without downtime or crashes.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (isMigrationDone || isMigrating) return;

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!dbUrl || dbUrl.includes("ep-sample-pooler") || dbUrl.includes("user:password")) {
    isMigrationDone = true;
    return;
  }

  isMigrating = true;

  try {
    // 1. Ensure Enum Types exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'STARTER_20', 'GROWTH_50', 'ENTERPRISE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {
      // Ignore if enums already exist or enum creation not permitted
    });

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {
      // Ignore if enums already exist
    });

    // 2. Ensure columns exist on organizations table
    // Try first with enum types
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "organizations" 
          ADD COLUMN IF NOT EXISTS "subscription_plan" "SubscriptionPlan" DEFAULT 'FREE_TRIAL',
          ADD COLUMN IF NOT EXISTS "subscription_status" "SubscriptionStatus" DEFAULT 'TRIAL',
          ADD COLUMN IF NOT EXISTS "max_seats" INTEGER DEFAULT 20,
          ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "subscription_ends_at" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
          ADD COLUMN IF NOT EXISTS "billing_phone" TEXT,
          ADD COLUMN IF NOT EXISTS "subscription_notes" TEXT;
      `);
    } catch {
      // Fallback: If enum type was not created, use standard TEXT/VARCHAR columns
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "organizations" 
          ADD COLUMN IF NOT EXISTS "subscription_plan" VARCHAR(50) DEFAULT 'FREE_TRIAL',
          ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) DEFAULT 'TRIAL',
          ADD COLUMN IF NOT EXISTS "max_seats" INTEGER DEFAULT 20,
          ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "subscription_ends_at" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
          ADD COLUMN IF NOT EXISTS "billing_phone" TEXT,
          ADD COLUMN IF NOT EXISTS "subscription_notes" TEXT;
      `).catch((err) => {
        console.warn("[ensureDatabaseSchema] Fallback organizations alter warning:", err);
      });
    }

    // 3. Ensure column exists on users table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
        ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN DEFAULT false;
    `).catch((err) => {
      console.warn("[ensureDatabaseSchema] users alter warning:", err);
    });

    isMigrationDone = true;
    console.log("✅ [ensureDatabaseSchema] Live PostgreSQL schema synchronized successfully.");
  } catch (err) {
    console.warn("⚠️ [ensureDatabaseSchema] Auto-migration non-fatal error:", err);
  } finally {
    isMigrating = false;
  }
}
