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
          ADD COLUMN IF NOT EXISTS "subscription_notes" TEXT,
          ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
          ADD COLUMN IF NOT EXISTS "website" TEXT,
          ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
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
          ADD COLUMN IF NOT EXISTS "subscription_notes" TEXT,
          ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
          ADD COLUMN IF NOT EXISTS "website" TEXT,
          ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
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

    // 4. Ensure SaaS Platform Tables exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "platform_users" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "password_hash" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "plans" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT UNIQUE NOT NULL,
        "description" TEXT,
        "price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "billing_interval" TEXT NOT NULL DEFAULT 'MONTHLY',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "is_public" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "plan_features" (
        "id" TEXT PRIMARY KEY,
        "plan_id" TEXT NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
        "feature_key" TEXT NOT NULL,
        "feature_value" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "plan_features_plan_id_feature_key_key" UNIQUE ("plan_id", "feature_key")
      );

      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "plan_id" TEXT NOT NULL REFERENCES "plans"("id"),
        "status" TEXT NOT NULL DEFAULT 'TRIAL',
        "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "end_date" TIMESTAMP(3),
        "trial_start_date" TIMESTAMP(3),
        "trial_end_date" TIMESTAMP(3),
        "renewal_date" TIMESTAMP(3),
        "cancelled_at" TIMESTAMP(3),
        "billing_interval" TEXT NOT NULL DEFAULT 'MONTHLY',
        "external_subscription_id" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "subscription_events" (
        "id" TEXT PRIMARY KEY,
        "subscription_id" TEXT NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "event_type" TEXT NOT NULL,
        "old_plan_id" TEXT,
        "new_plan_id" TEXT,
        "notes" TEXT,
        "created_by" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "payments" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "subscription_id" TEXT REFERENCES "subscriptions"("id") ON DELETE SET NULL,
        "amount" DECIMAL(10, 2) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        "provider" TEXT NOT NULL DEFAULT 'STRIPE',
        "external_payment_id" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "id" TEXT PRIMARY KEY,
        "key" TEXT UNIQUE NOT NULL,
        "value" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "usage_snapshots" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "users_count" INTEGER NOT NULL DEFAULT 0,
        "leads_count" INTEGER NOT NULL DEFAULT 0,
        "companies_count" INTEGER NOT NULL DEFAULT 0,
        "contacts_count" INTEGER NOT NULL DEFAULT 0,
        "opportunities_count" INTEGER NOT NULL DEFAULT 0,
        "storage_bytes" BIGINT NOT NULL DEFAULT 0,
        "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => {
      console.warn("[ensureDatabaseSchema] SaaS platform tables create warning:", err);
    });

    // 5. Strictly enforce SaaS Owner isolation on live DB:
    // Strip is_super_admin from any organization user (Admin, Manager, Sales).
    await prisma.$executeRawUnsafe(`
      UPDATE "users" SET "is_super_admin" = false WHERE LOWER("email") != 'sohel@techflux.in';
    `).catch(() => {});

    isMigrationDone = true;
    console.log("✅ [ensureDatabaseSchema] Live PostgreSQL schema synchronized successfully.");
  } catch (err) {
    console.warn("⚠️ [ensureDatabaseSchema] Auto-migration non-fatal error:", err);
  } finally {
    isMigrating = false;
  }
}
