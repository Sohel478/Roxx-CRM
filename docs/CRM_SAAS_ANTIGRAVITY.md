# Custom CRM SaaS MVP — Antigravity Execution Specification

**Version:** 1.0  
**Date:** 27 September 2026  
**Architecture:** Next.js + Vercel + Neon PostgreSQL + Prisma  
**Product:** Multi-Tenant CRM SaaS  

## 1. SaaS Model

The product has three primary areas:

1. Public Landing Page
2. Super Admin Portal
3. Organization CRM Portal

Core flow:

```text
Visitor
  ↓
Landing Page
  ↓
View Demo
  ↓
Demo Organization
  ↓
Signup / Start Trial
  ↓
Create Organization
  ↓
Organization Admin
  ↓
CRM Usage according to Subscription
```

Each customer is an **Organization/Tenant**. Organization data must be completely isolated from other organizations.

---

## 2. Technology

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js Server Actions + Route Handlers |
| Database | Neon PostgreSQL |
| ORM | Prisma |
| Authentication | Native Signed Session (HMAC-SHA256 Web Crypto) / Auth.js |
| Validation | Zod |
| Hosting | Vercel |
| Scheduled Jobs | Vercel Cron |
| File Storage | Vercel Blob initially |
| Source Control | GitHub |
| Monitoring | Vercel + Sentry |

For MVP, do not introduce EC2, NestJS, Kubernetes, Redis or microservices unless a concrete requirement requires them.

---

## 3. High-Level Architecture

```text
                    INTERNET
                       │
                       ▼
              ┌──────────────────┐
              │ Public Landing   │
              │     Next.js      │
              └────────┬─────────┘
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
           Demo      Signup     Login
             │         │         │
             └─────────┼─────────┘
                       ▼
              ┌──────────────────┐
              │   Next.js App    │
              │                  │
              │ Super Admin      │
              │ Organization CRM │
              └────────┬─────────┘
                       │
                       ▼
                  ┌─────────┐
                  │ Prisma  │
                  └────┬────┘
                       ▼
                ┌─────────────┐
                │    Neon     │
                │ PostgreSQL  │
                └─────────────┘
```

---

## 4. User Types

### Super Admin
Platform owner. Can:
- view all organizations
- manage customers
- manage plans
- manage subscriptions
- view subscription dates
- view payment status
- extend trials
- change plans
- suspend/activate organizations
- view usage
- view organization users
- view platform audit logs
- manage platform settings

### Organization Admin
Customer administrator. Can:
- manage organization
- manage users
- manage roles
- manage CRM settings
- view subscription
- view usage
- manage all permitted CRM data

### Organization Manager
Can:
- manage team CRM data
- assign leads
- manage opportunities
- view team reports
- manage follow-ups

### Sales User
Can:
- manage assigned leads
- create leads
- create contacts
- create activities
- create follow-ups
- manage permitted opportunities

### Read Only
Can view permitted records but cannot modify CRM data.

### Demo User
Temporary user for the demo organization. Must not access Super Admin or other organizations.

---

## 5. Multi-Tenant Model

Organization is the tenant.

```text
Organization
 ├── Users
 ├── Leads
 ├── Companies
 ├── Contacts
 ├── Opportunities
 ├── Activities
 ├── Tasks
 ├── Notes
 ├── Notifications
 └── Audit Logs
```

Every tenant-owned table must contain:
```text
organization_id
```

The server must derive `organization_id` from the authenticated membership/session. Never trust organization ID supplied by the browser.

---

## 6. Platform vs Organization Data

### Platform-level
```text
platform_users
plans
plan_features
subscriptions
subscription_events
payments
platform_settings
organizations
```

### Organization-level
```text
organization_members
leads
companies
contacts
opportunities
activities
tasks
notes
attachments
notifications
audit_logs
pipelines
pipeline_stages
settings
```

---

## 7. Public Landing Page

Routes:
```text
/
/features
/pricing
/demo
/contact
/login
/signup
/terms
/privacy
```

Sections:
- Header
- Hero
- CRM Features
- How It Works
- Dashboard Preview
- Pipeline Preview
- Pricing
- Demo CTA
- FAQ
- Contact
- Footer

Primary CTAs:
- View Live Demo
- Start Free Trial
- Login

---

## 8. Demo Account

Use a dedicated demo organization:
- `organizations.is_demo = true`
- Demo Organization
- Demo Admin
- Demo Sales User

Populate with realistic CRM data. Demo restrictions:
- No Super Admin access
- No access to other organizations
- Cannot change subscription
- Cannot change platform settings
- Cannot delete demo organization

---

## 9. Signup Flow

```text
Landing Page → Start Free Trial → Signup → Create User → Create Organization →
Create Membership → Assign Org Admin → Create Trial Subscription →
Create Default Pipeline & Stages → Create Lead Sources & Statuses → Create Settings → Dashboard
```
Use database transaction.

---

## 10. Subscription Plans & Features

Example plans:
- Free / Demo
- Starter
- Professional
- Business
- Enterprise

Capabilities and limits:
- `users_limit`
- `leads_limit`
- `companies_limit`
- `contacts_limit`
- `opportunities_limit`
- `pipelines_limit`
- `advanced_reports`
- `export`
- `api_access`
- `ai_features`

---

## 11. Subscription Engine (`SubscriptionService`)

Functions:
- `getCurrentSubscription(organizationId)`
- `isActive(organizationId)`
- `isTrial(organizationId)`
- `isExpired(organizationId)`
- `hasFeature(organizationId, featureKey)`
- `getLimit(organizationId, resourceKey)`
- `checkLimit(organizationId, resourceKey)`
- `getUsage(organizationId)`

Never hardcode plan names throughout the code.

---

## 12. Super Admin Routes

```text
/super-admin
/super-admin/dashboard
/super-admin/organizations
/super-admin/organizations/:id
/super-admin/plans
/super-admin/subscriptions
/super-admin/payments
/super-admin/usage
/super-admin/audit-logs
/super-admin/settings
```

---

## 13. Payment Architecture

Abstract `PaymentProvider`:
- `createCheckout()`
- `verifyWebhook()`
- `getSubscription()`
- `cancelSubscription()`
- Providers: Stripe, Razorpay, Mock.
- Webhook signature verification, idempotency, subscription updates, audit logs.
