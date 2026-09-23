# Development Guide

## Prerequisites
- Node.js 18+ (tested with Node 20 / 22)
- npm or pnpm
- Access to a Neon PostgreSQL instance or local PostgreSQL

## Getting Started

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   Populate `DATABASE_URL` and `DIRECT_URL` with your Neon connection credentials.

3. **Initialize Prisma Client & Migrations**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the CRM application.

## Available Scripts

- `npm run dev`: Starts the Next.js development server
- `npm run build`: Generates the production bundle
- `npm run start`: Runs the built production server
- `npm run lint`: Executes Next.js and ESLint code checks
- `npm run test`: Runs unit tests in watch mode
- `npm run test:run`: Runs unit tests once
- `npm run prisma:generate`: Generates the Prisma Client
- `npm run prisma:migrate`: Runs migrations in development mode
