# Deployment Guide (Vercel + Neon)

## Architecture Overview
The application is deployed on Vercel as a full-stack Next.js project connecting to Neon PostgreSQL.

## Environment Variables on Vercel
Ensure the following variables are configured in the Vercel Project Settings:
- `DATABASE_URL`: Pooled connection string to Neon PostgreSQL (`?sslmode=require&pgbouncer=true`).
- `DIRECT_URL`: Direct unpooled connection string to Neon PostgreSQL for database migrations.
- `AUTH_SECRET`: Strong 32+ character random string for session tokens.
- `NEXT_PUBLIC_APP_URL`: Production domain URL (e.g. `https://crm.yourdomain.com`).

## Build Command & Database Migrations
In Vercel Build Settings:
- Build Command: `npx prisma generate && next build`
- In CI or during release pipelines, run `npx prisma migrate deploy` before deploying.
