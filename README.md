# Maritime Operations & Compliance System

> Full-stack platform for marine organizations to manage ship maintenance, safety drills, crew participation, and regulatory compliance.

**Live deployment:** `https://marinetime-operations-jo65k.ondigitalocean.app`

**GitHub:** `https://github.com/code3002/MarinetIme`

**Demo accounts:**

| Email | Password | Role |
|-------|----------|------|
| admin@maritime.test | Admin123! | ADMIN |
| crew@maritime.test | Crew123! | CREW |

---

## What's Built — Assessment Checklist

### Core Features

| Requirement | Status |
|---|---|
| Admin creates maintenance tasks for ships | ✅ Done |
| Admin assigns tasks to crew members | ✅ Done |
| Task status tracking: Pending / In Progress / Completed | ✅ Done |
| Crew views assigned tasks and updates status | ✅ Done |
| Crew adds notes and comments to tasks | ✅ Done |
| Admin schedules safety drills (Fire, Evacuation, Man Overboard, Medical) | ✅ Done |
| Admin assigns drills to ships | ✅ Done |
| Crew views upcoming drills and marks attendance | ✅ Done |
| Admin marks drills as completed | ✅ Done |
| Compliance dashboard — pending tasks, missed drills, completed vs pending | ✅ Done |
| Overdue maintenance highlighted | ✅ Done (red highlight + sidebar badge + risk banner) |
| Missed safety drills highlighted | ✅ Done |
| Maintenance compliance % calculation | ✅ Done |
| Drill participation % calculation | ✅ Done |
| Overall compliance score | ✅ Done |

### Bonus Features

| Requirement | Status |
|---|---|
| Role-based access control (ADMIN / CREW) | ✅ Done |
| Filters by ship and status | ✅ Done (maintenance + drills pages) |
| Overdue task notifications | ✅ Done (sidebar count, top banner, risk alert) |
| Bar chart — per-ship compliance breakdown | ✅ Done |
| Donut chart — maintenance completion rate | ✅ Done |
| Per-ship compliance summary table | ✅ Done |
| Docker setup | ✅ Done (Dockerfile at root) |
| Deployment | ✅ Done (DigitalOcean App Platform) |

---

## Architecture

```
maritime-operations/           ← monorepo root (npm workspaces)
├── apps/
│   ├── api/                   ← Node.js + Express REST API (TypeScript)
│   │   ├── src/
│   │   │   ├── modules/       ← feature modules (auth, ships, maintenance, drills, compliance)
│   │   │   ├── middleware/    ← auth + error handling
│   │   │   └── lib/           ← Prisma client, JWT helpers
│   │   └── prisma/
│   │       ├── schema.prisma  ← database schema
│   │       ├── migrations/    ← SQL migration history
│   │       └── seed.ts        ← demo data seeder
│   └── web/                   ← React 18 SPA (TypeScript + Vite)
│       └── src/
│           ├── main.tsx       ← all UI components (single-file architecture)
│           ├── styles.css     ← CSS design system
│           ├── api/client.ts  ← fetch wrapper with JWT
│           ├── components/ui/ ← Button, Card, Badge, Input primitives
│           └── types/         ← shared TypeScript types
├── packages/
│   └── shared/                ← shared constants and types (published to both apps)
├── Dockerfile                 ← single-service build for DigitalOcean
└── .do/app.yaml               ← DigitalOcean App Platform spec
```

### Architecture Decisions

**1. Monorepo with npm workspaces**
All packages live in one repo. `packages/shared` holds constants and types used by both the API and the frontend, eliminating duplication. npm workspaces hoist dependencies and allow cross-package imports without publishing.

**2. Express serves the React build as static files**
There is no separate frontend server. The Express API builds the React app (`apps/web/dist`) and serves it as static files. All routes not starting with `/api` fall through to `index.html`, enabling client-side routing. This means a single Docker container, a single DigitalOcean service, and a single URL — simpler to deploy, easier to reason about.

**3. Prisma ORM + Neon (serverless PostgreSQL)**
Prisma provides type-safe database access and a migration system. Neon's serverless PostgreSQL includes a built-in connection pooler, which handles the connection limit problem common with serverless/container deployments.

**4. JWT stateless authentication**
Tokens are signed with a secret and verified on every request. No session store needed. The middleware resolves the user and attaches it to the request object so all downstream handlers can use `req.user`.

**5. Zod for API input validation**
Every POST/PATCH endpoint validates its input with a Zod schema before touching the database. Validation errors are caught by the global error handler and returned as structured JSON, not stack traces.

**6. Feature-module structure on the backend**
Each domain (auth, ships, maintenance, drills, compliance) has its own `routes.ts`. Business logic that spans multiple models (compliance calculation) lives in a `service.ts` file separate from the route handler.

---

## Database Schema

```
User
  id, name, email, passwordHash, role (ADMIN|CREW), shipId?

Ship
  id, name, imoNumber (unique), status

MaintenanceTask
  id, title, description, status (PENDING|IN_PROGRESS|COMPLETED)
  dueDate, completedAt?, shipId, assignedToId?

MaintenanceComment
  id, body, taskId, authorId, createdAt

SafetyDrill
  id, title, type, status (SCHEDULED|COMPLETED|MISSED)
  scheduledDate, completedAt?, shipId

DrillAttendance
  id, drillId, crewId, attended, submittedAt?
  unique(drillId, crewId)           ← prevents duplicate attendance records
```

**Key design choices:**
- `cuid()` primary keys — URL-safe, no sequential guessing
- `onDelete: Cascade` on task/drill children — deleting a ship cleans up all related records
- `DrillAttendance` is created automatically for all ship crew when a drill is scheduled — crew only needs to mark `attended: true`
- `completedAt` timestamp recorded separately from status for audit trail

---

## Compliance Calculation

```
Maintenance compliance  = completedTasks / totalTasks × 100
Drill participation     = attendedRecords / totalAttendanceRecords × 100
Overall compliance      = (maintenanceCompliance + drillParticipation) / 2
```

**Overdue logic:**
- A maintenance task is **overdue** when `status != COMPLETED` and `dueDate < now()`
- A drill is **missed** when `status != COMPLETED` and `scheduledDate < now()`
- Both are calculated at query time — no scheduled job needed, always reflects current state

**Edge cases handled:**
- Zero tasks → compliance defaults to 100% (no tasks = nothing to fail)
- Zero attendance records → falls back to total drills count to avoid division by zero
- Compliance calculated per-ship and fleet-wide independently

---

## API Reference

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login, returns JWT + user |
| POST | `/api/auth/register` | Public | Register new user |
| GET | `/api/auth/me` | Any | Current authenticated user |
| GET | `/api/auth/crew` | Any | List all crew members (for assignment) |
| GET | `/api/ships` | Any | List all ships |
| POST | `/api/ships` | ADMIN | Create a ship |
| PATCH | `/api/ships/:id` | ADMIN | Update ship details |
| GET | `/api/maintenance` | Any | List tasks (crew: own assigned only) |
| POST | `/api/maintenance` | ADMIN | Create maintenance task |
| PATCH | `/api/maintenance/:id` | Any | Update task status/details |
| GET | `/api/maintenance/:id/comments` | Any | Get task comments |
| POST | `/api/maintenance/:id/comments` | Any | Add comment to task |
| GET | `/api/drills` | Any | List drills (crew: own ship only) |
| POST | `/api/drills` | ADMIN | Schedule a drill |
| PATCH | `/api/drills/:id` | ADMIN | Update drill details |
| POST | `/api/drills/:id/attendance` | CREW | Mark attendance |
| POST | `/api/drills/:id/complete` | ADMIN | Mark drill completed |
| GET | `/api/compliance/summary` | Any | Compliance for a ship or fleet |
| GET | `/api/compliance/dashboard` | Any | Fleet + per-ship breakdown |
| GET | `/health` | Public | Health check |

---

## Local Setup

### Prerequisites

- Node.js 22+
- PostgreSQL database — [Neon](https://neon.tech) free tier recommended

### 1. Clone and install

```bash
git clone https://github.com/code3002/MarinetIme.git
cd MarinetIme
npm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
# Open apps/api/.env and fill in:
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=any-long-random-string
#   PORT=4000
#   CLIENT_URL=http://localhost:5173
```

The frontend needs no `.env` for local development — it defaults to `/api` which proxies to the Express server.

### 3. Set up the database

```bash
npm run prisma:generate   # generate Prisma client
npm run prisma:migrate    # run migrations
npm run seed              # seed demo ships, users, tasks, drills
```

### 4. Start development servers

```bash
npm run dev   # API on :4000, React dev server on :5173
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment (DigitalOcean App Platform)

The app deploys as a **single service** — Express serves both the API and the built React SPA.

### Steps

1. Push to GitHub
2. DigitalOcean App Platform → **New App** → connect `code3002/MarinetIme` → branch `main`
3. DO detects the `Dockerfile` automatically
4. Set environment variables in the DO dashboard:
   - `DATABASE_URL` ← Neon connection string (encrypted)
   - `JWT_SECRET` ← any long random string (encrypted)
   - `PORT` = `8080`
   - `NODE_ENV` = `production`
5. Deploy
6. After first deploy, open the **Console** tab and run:
   ```bash
   npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
   npx tsx apps/api/prisma/seed.ts
   ```

### How the Dockerfile works

```dockerfile
FROM node:22-slim
RUN apt-get install -y openssl   # required by Prisma query engine
WORKDIR /app
# install deps with --ignore-scripts (skips postinstall prisma generate)
# build: shared → web (React) → prisma generate → api (TypeScript)
# start: node apps/api/dist/src/server.js
```

Build order matters: `packages/shared` must compile before `apps/web` (imports it), and `apps/web` must build before `apps/api` compiles (API serves web's dist as static files).

---

## Scripts

```bash
npm run dev              # start API + web in watch mode
npm run build            # build all packages in correct order
npm run test             # run Vitest integration tests
npm run lint             # TypeScript type-check all packages
npm run prisma:generate  # regenerate Prisma client after schema changes
npm run prisma:migrate   # create and run a new migration
npm run seed             # seed demo data
```

---

## Business Flow

```
ADMIN
  │
  ├─ Ships → create ships with IMO numbers
  │
  ├─ Maintenance
  │    ├─ Create task (title, description, due date, ship, assign crew)
  │    ├─ Update task status at any time
  │    └─ View all tasks with overdue highlighting
  │
  ├─ Drills
  │    ├─ Schedule drill (type, date, ship)
  │    │   └─ System auto-creates attendance records for all ship crew
  │    ├─ Mark drill completed
  │    └─ View attendance count per drill
  │
  └─ Dashboard
       ├─ Fleet-wide compliance score
       ├─ Overdue count + missed drills count
       ├─ Bar chart: per-ship maintenance vs drill vs overall %
       ├─ Donut chart: maintenance completion rate
       └─ Per-ship compliance table

CREW
  │
  ├─ Maintenance
  │    ├─ View only tasks assigned to them
  │    ├─ Update status (Pending → In Progress → Completed)
  │    └─ Add notes/comments to tasks
  │
  ├─ Drills
  │    ├─ View drills for their ship
  │    └─ Mark attendance
  │
  └─ Crew Dashboard
       ├─ Summary stats (tasks, overdue, upcoming drills, attended)
       ├─ Overdue alert banner
       └─ All tasks + drills in one view
```

---

## Evaluation Criteria — How This Project Addresses Each

### Technical

**API design** — RESTful, resource-oriented routes (`/ships`, `/maintenance`, `/drills`, `/compliance`). Each module has its own router file. Role enforcement via middleware. Consistent JSON error responses with HTTP status codes. Zod schema validation on all inputs.

**DB schema** — Normalized PostgreSQL schema with proper foreign keys, cascade deletes, and a unique constraint on `DrillAttendance(drillId, crewId)`. Enums for status fields. `completedAt` timestamp for audit. CUID primary keys.

**Code structure** — Monorepo with clear boundaries: `packages/shared` (types), `apps/api` (backend), `apps/web` (frontend). Backend uses feature-module pattern. Business logic (compliance calculation) separated into `service.ts`. Frontend is a single-file component tree with clear component hierarchy.

### Logic

**Compliance calculation** — Calculated real-time from DB counts. Maintenance: `completed / total × 100`. Drills: `attended / total_attendance_records × 100`. Overall: average of both. Handles zero-division edge cases. Computed per-ship and fleet-wide.

**Handling overdue/missed** — Overdue is a derived state (`status != COMPLETED && dueDate < now()`), not stored. This means it's always accurate and requires no background jobs. Surfaced in: task row highlight, sidebar badge count, dashboard risk banner, compliance table.

### Frontend

**UI clarity** — Navy sidebar with teal accent. Status badges with distinct colors (blue = pending, amber = in progress, green = completed, red = missed/overdue). Danger state (red background) on overdue rows. Empty states and loading spinner. Responsive layout (collapses to single column on mobile).

**Data visualization** — Grouped bar chart (per-ship, three metrics), donut/pie chart (maintenance completion with center label), compliance pills in summary table, stat cards with color-coded values.

### System Thinking

**Scalability** — Stateless JWT auth (horizontally scalable). Prisma connection pooling via Neon. Compliance queries use `count()` aggregations not full row scans. Filters on maintenance/drills push predicates to the DB, not in-memory.

**Clean separation of concerns** — Transport layer (Express routes) → business logic (service functions) → data layer (Prisma). Frontend API client isolated in `api/client.ts`. Shared types in `packages/shared` prevent drift between frontend and backend contracts. UI primitives in `components/ui/` are unstyled/logic-free building blocks.
