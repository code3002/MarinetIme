# Maritime Operations & Compliance System

A full-stack platform for marine organizations to manage ship maintenance, safety drills, and regulatory compliance.

## Architecture

```
├── apps/
│   ├── api/          # Node.js + Express + Prisma (TypeScript)
│   └── web/          # React + Vite (TypeScript)
├── packages/
│   └── shared/       # Shared TypeScript types
├── railway.json      # Backend deployment config (Railway)
└── vercel.json       # Frontend deployment config (Vercel)
```

**Stack:** React 18 · Express 4 · Prisma · PostgreSQL (Neon) · JWT · Recharts · Zod · Vitest

## Features

- **Ship Maintenance** — Create tasks, assign to crew, track status (Pending / In Progress / Completed), add comments
- **Safety Drills** — Schedule drills by type (Fire, Evacuation, Man Overboard), track crew attendance
- **Compliance Dashboard** — Real-time compliance %, overdue alerts, per-ship bar chart
- **Role-based access** — ADMIN (full control) and CREW (view + update own tasks/drills)
- **Filters** — By ship, status, date range

## Local Setup

### Prerequisites

- Node.js 22+
- A PostgreSQL database (free tier on [Neon](https://neon.tech) works great)

### 1. Clone and install

```bash
git clone <repo-url>
cd maritime-operations
npm install
```

### 2. Configure environment

```bash
# Backend
cp .env.example apps/api/.env
# Edit apps/api/.env — fill in DATABASE_URL and JWT_SECRET

# Frontend
cp .env.example apps/web/.env
# Edit apps/web/.env — VITE_API_URL=http://localhost:4000/api
```

### 3. Set up the database

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 4. Run locally

```bash
npm run dev   # API on :4000, web on :5173
```

**Demo accounts:**

| Email | Password | Role |
|-------|----------|------|
| admin@maritime.test | Admin123! | ADMIN |
| crew@maritime.test | Crew123! | CREW |

## Deployment

### Backend → Railway

1. Create a new Railway project, connect this GitHub repo
2. Railway reads `railway.json` automatically — no extra config needed
3. Set these env vars in the Railway dashboard:
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — a long random string
   - `CLIENT_URL` — your Vercel frontend URL (e.g. `https://maritime-ops.vercel.app`)
4. After first deploy, run in Railway shell:
   ```bash
   npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
   npx tsx apps/api/prisma/seed.ts
   ```

### Frontend → Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. Vercel reads `vercel.json` automatically — no framework preset needed
3. Set this env var in the Vercel dashboard:
   - `VITE_API_URL` — Railway API URL + `/api` (e.g. `https://maritime-api.up.railway.app/api`)
4. Deploy — SPA routing is handled via the `rewrites` rule in `vercel.json`

## Compliance Calculation

```
Maintenance compliance = completed tasks / total tasks × 100
Drill participation    = attended records / total attendance records × 100
Overall compliance     = average of the two
```

Tasks/drills past their due date that are not completed are flagged as overdue / missed.

## API Reference

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | Any | Current user |
| GET | `/api/ships` | Any | List ships |
| GET | `/api/maintenance` | Any | List tasks (crew: own only) |
| POST | `/api/maintenance` | ADMIN | Create task |
| PATCH | `/api/maintenance/:id` | Any | Update status/details |
| POST | `/api/maintenance/:id/comments` | Any | Add comment |
| GET | `/api/drills` | Any | List drills |
| POST | `/api/drills` | ADMIN | Schedule drill |
| POST | `/api/drills/:id/attendance` | CREW | Mark attendance |
| POST | `/api/drills/:id/complete` | ADMIN | Mark drill completed |
| GET | `/api/compliance/dashboard` | Any | Fleet + per-ship compliance |
| GET | `/health` | — | Health check |

## Scripts

```bash
npm run dev              # start API + web in watch mode
npm run build            # build all packages
npm run test             # run Vitest integration tests
npm run lint             # TypeScript type-check all packages
npm run prisma:migrate   # run DB migrations
npm run seed             # seed demo data
```
