# Roxx CRM - Custom CRM MVP

A modern, multi-tenant sales CRM built with Next.js, Prisma, Neon PostgreSQL, and Tailwind CSS.

## Features
- **Multi-Tenant by Design**: Organization-level isolation from day one.
- **Sales Lifecycle Pipeline**: Lead → Contact/Company → Opportunity → Won/Lost.
- **Role-Based Access Control (RBAC)**: Admin, Manager, Sales User, and Read Only roles.
- **Activities & Tasks**: Track calls, meetings, follow-ups, and interaction timelines.
- **Lightweight Monolith**: Server Actions & Route Handlers without complex microservice overhead.

## Documentation
- [Master Specification](docs/CRM_MVP_ANTIGRAVITY.md)
- [Architecture Guide](docs/architecture.md)
- [Database Guidelines](docs/database.md)
- [Development Setup](docs/development.md)
- [Deployment Instructions](docs/deployment.md)

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [Neon PostgreSQL](https://neon.tech/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

## Getting Started
```bash
npm install
cp .env.example .env.local
npx prisma generate
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.
