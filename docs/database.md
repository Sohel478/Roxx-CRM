# Database Architecture & Guidelines

## Database Engine
- **Database Engine:** PostgreSQL (hosted on Neon Serverless)
- **Data Access Layer:** Prisma ORM

## Connection Handling on Neon
Neon provides two distinct connection strings:
1. `DATABASE_URL`: Connection string routed through Neon's connection pooler (PgBouncer). Used by Next.js serverless functions and runtime queries to prevent database connection exhaustion.
2. `DIRECT_URL`: Direct unpooled connection string. Used by Prisma CLI for running migrations and schema alterations.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## Multi-Tenant Isolation
All business entities must reference `organization_id`:
- `Organization`
- `User`
- `Role` / `Permission`
- `Lead`
- `Company`
- `Contact`
- `Opportunity`
- `Activity`
- `Task`
- `Note`
- `Notification`
- `AuditLog`

### Indexing Strategy
Every table must include indexes on foreign keys and commonly filtered fields:
- `organization_id`
- Composite index on `[organization_id, status]`
- Composite index on `[organization_id, owner_id]`
- Composite index on `[organization_id, created_at]`

## Migration Policy
1. In development: `npx prisma migrate dev --name <migration_name>`
2. In production / preview: `npx prisma migrate deploy`
3. Never run `prisma db push` in production environments.
