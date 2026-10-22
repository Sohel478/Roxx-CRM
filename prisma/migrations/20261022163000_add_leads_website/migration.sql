-- AlterTable: Add website column to leads if not exists
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "website" TEXT;
