#!/usr/bin/env node
const { execSync } = require("child_process");

// Detect database connection URL from standard or Vercel Storage integration variables
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.roxxcrm_POSTGRES_PRISMA_URL ||
  process.env.roxxcrm_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

const directUrl =
  process.env.DIRECT_URL ||
  process.env.roxxcrm_DATABASE_URL_UNPOOLED ||
  process.env.roxxcrm_POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL_NON_POOLING ||
  dbUrl;

const customEnv = {
  ...process.env,
};

if (dbUrl) {
  customEnv.DATABASE_URL = dbUrl;
}
if (directUrl) {
  customEnv.DIRECT_URL = directUrl;
}

console.log("➡️ Running prisma generate...");
execSync("npx prisma generate", { stdio: "inherit", env: customEnv });

// If a real database connection is available (not a dummy placeholder), push schema & seed
const isRealDatabase =
  dbUrl &&
  !dbUrl.includes("ep-sample-pooler") &&
  !dbUrl.includes("user:password");

if (isRealDatabase) {
  try {
    console.log("➡️ Live database detected. Synchronizing Prisma schema (prisma db push)...");
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: customEnv,
    });
    console.log("✅ Schema synchronized with live PostgreSQL database!");

    console.log("➡️ Running initial seed...");
    execSync("npx tsx prisma/seed.ts", {
      stdio: "inherit",
      env: customEnv,
    });
    console.log("✅ Database seeded successfully!");
  } catch (err) {
    console.warn("⚠️ Database push/seed warning (non-fatal):", err.message);
  }
} else {
  console.log("ℹ️ No live database URL found or using local placeholder. Skipping remote db push.");
}

console.log("➡️ Building Next.js application...");
execSync("npx next build", { stdio: "inherit", env: customEnv });
