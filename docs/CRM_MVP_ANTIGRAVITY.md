# Custom CRM MVP — Vercel + Neon + Antigravity Master Specification

**Version:** 2.0  
**Architecture:** Next.js + Vercel + Neon PostgreSQL + Prisma  
**Purpose:** Technical architecture and execution specification for building the Custom CRM MVP with Antigravity.

---

## 1. Executive Summary

Build a lightweight, scalable Custom CRM MVP focused on the complete sales lifecycle:

```text
Lead → Assignment → Contact → Follow-up → Qualification → Conversion → Company + Contact → Opportunity → Pipeline → Won / Lost → Reporting
```

The MVP prioritizes operational simplicity, security, maintainability, and low infrastructure cost.

### Stack
- **Hosting:** Vercel
- **Frontend:** Next.js (App Router) + React + TypeScript
- **Backend:** Next.js Server Actions + Route Handlers
- **Database:** Neon PostgreSQL
- **ORM:** Prisma
- **Authentication:** Custom secure session / Auth.js / Better Auth
- **Validation:** Zod
- **UI:** Tailwind CSS + reusable component system (shadcn/ui compatible)
- **Charts:** Recharts
- **Cron:** Vercel Cron
- **Files:** Vercel Blob / S3
- **Monitoring:** Vercel + Sentry

---

## 2. Multi-Tenant Architecture & Data Isolation

Organization-level isolation from day one:
- Every business table contains `organization_id`.
- The server derives `organization_id` strictly from the authenticated session.
- Client-supplied `organization_id` is never trusted.

---

## 3. Core Modules

1. **Authentication & RBAC:** Organization context, session management, roles (Admin, Manager, Sales User, Read Only), granular permissions.
2. **Dashboard:** Role-based views (Sales vs Manager), core metrics (leads, follow-ups, pipeline value, won/lost), pipeline stage distribution.
3. **Leads:** List with search, filtering, pagination, creation, edit, detail, assignment, status workflow, notes, activities, timeline.
4. **Lead Conversion:** Transactional conversion of qualified lead into Company, Contact, and optional Opportunity.
5. **Companies:** Account management, industry, contacts, opportunities, activities, timeline.
6. **Contacts:** People management linked to companies, multiple contacts per company.
7. **Opportunities & Pipeline:** Deal tracking, Kanban board with drag-and-drop stage movement, expected value, probability, close date, won/lost status with loss reasons.
8. **Activities & Tasks:** Calls, emails, meetings, follow-ups, due dates, overdue tracking, completion recording.
9. **Timeline & Audit:** Unified chronological interaction timeline and tamper-evident audit logs for critical business mutations.
10. **Reports:** Lead performance, pipeline conversion, salesperson metrics, activity tracking.
11. **Import / Export:** CSV import with column mapping, validation, preview, and results summary.
