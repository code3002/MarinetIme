# Maritime Operations & Compliance System

Full-stack TypeScript monorepo for managing ship maintenance, safety drills, crew participation, and compliance risk.

## Stack

- Frontend: React, TypeScript, Vite, Recharts
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL on Neon
- ORM: Prisma
- Auth: JWT with role-based access control
- UI: shadcn-style local component primitives
- Tests: Vitest and Supertest integration tests

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env
   ```

3. Add your Neon connection string to `apps/api/.env`:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
   JWT_SECRET="replace-with-a-long-random-secret"
   PORT=4000
   CLIENT_URL="http://localhost:5173"
   ```

4. Add the frontend API URL to `apps/web/.env`:

   ```env
   VITE_API_URL="http://localhost:4000/api"
   ```

5. Generate Prisma client and migrate:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

## Seed Users

- Admin: `admin@maritime.test` / `Admin123!`
- Crew: `crew@maritime.test` / `Crew123!`

## Main Features

- Admins create ships, maintenance tasks, and safety drills.
- Crew can view assigned maintenance, update task status, and mark drill attendance.
- Compliance dashboard calculates maintenance completion, drill participation, overdue maintenance, and missed drills.
- Role-based API access protects admin workflows from crew users.

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Test Coverage

The API tests validate the assessment-critical workflows:

- Admin can create maintenance tasks and assigned crew can complete them.
- Crew cannot access admin-only creation flows.
- Admin can schedule drills and crew can mark attendance.
- Compliance summary highlights overdue maintenance and missed drills.

Run them with:

```bash
npm run test
```

The tests create isolated records and clean them up after each run.
