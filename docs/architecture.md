# CRM MVP Architecture

## Overview

The Custom CRM MVP is designed as a modular full-stack application utilizing Next.js (App Router), TypeScript, Prisma ORM, and Neon PostgreSQL. This avoids the deployment and maintenance overhead of distributed microservices while providing clean separation of business concerns.

```text
┌────────────────────────────────────────────────────────┐
│                   Next.js App Router                   │
│                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────┐  │
│  │   UI & Server Comps     │  │   Server Actions    │  │
│  │ (App shell, tables,     │  │ (Mutations, Zod,    │  │
│  │  kanban, forms)         │  │  audit logs)        │  │
│  └───────────┬─────────────┘  └──────────┬──────────┘  │
│              │                           │             │
│              ▼                           ▼             │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Business Logic & Auth/RBAC Verification       │  │
│  │  (Session resolver, tenant scoping, permissions) │  │
│  └───────────────────────────┬──────────────────────┘  │
│                              │                         │
│                              ▼                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   Prisma ORM                     │  │
│  └───────────────────────────┬──────────────────────┘  │
└──────────────────────────────┼─────────────────────────┘
                               │
                               ▼
            ┌────────────────────────────────────┐
            │       Neon PostgreSQL Database     │
            │  (Multi-tenant scoped by org_id)   │
            └────────────────────────────────────┘
```

## Modular Directory Organization

The codebase is organized into domain modules to maintain architectural clarity:

```text
app/
  (auth)/               # Auth screens (login, password reset)
  (dashboard)/          # Authenticated app shell
    dashboard/          # Sales and Manager metrics
    leads/              # Lead management and conversion
    companies/          # Company/account management
    contacts/           # Contact management
    opportunities/      # Deal pipeline & Kanban
    tasks/              # Follow-ups and reminders
    activities/         # Interaction logs
    reports/            # Reporting dashboards
    settings/           # Admin settings, users, roles, pipelines
  api/v1/               # Public and webhook REST Route Handlers (health, cron, export)

components/
  ui/                   # Base reusable components (Button, Modal, Input, Badge, Table)
  layout/               # Navigation, sidebar, header, user menu

features/               # Modular business logic, hooks, and domain components
  leads/
  companies/
  contacts/
  opportunities/
  tasks/
  activities/
  dashboard/

lib/
  auth/                 # Session resolution, password hashing, cookies
  db/                   # Prisma singleton client instance
  permissions/          # Role-based access control and permission checks
  validation/           # Shared Zod validation schemas
  audit/                # Structured audit logging service
  utils/                # Helpers (formatting, class merge)
```

## Multi-Tenancy Design
1. Every business model in the database has an `organization_id` foreign key.
2. Server Actions and Route Handlers resolve the current user's active session and organization ID via server-side session management.
3. Every Prisma query includes `where: { organization_id: session.organizationId, ... }`.
4. Client-provided tenant identifiers are strictly ignored to prevent tenant isolation violations.
