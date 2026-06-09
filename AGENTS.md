# AGENTS.md — VenuePOS

Instructions for AI coding agents working in this repository.

## Project summary

**VenuePOS** is a multi-tenant web POS system for bars, clubs, and restaurants. Companies onboard via the web, create branches, manage staff/access, run POS terminals, kitchen displays, shifts, and optional Yoco card payments.

| Layer | Stack |
|-------|-------|
| Frontend | Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS 4, Vite 6 |
| Backend | Express 5 (ESM), raw SQL via `mysql2` |
| Database | MySQL 8 (`venuepos`) |
| Auth | JWT (Bearer token in `localStorage` as `venuepos_token`) |
| Payments | Yoco Checkout API (optional) |

Monorepo-style single package: frontend and backend live in one repo, started with separate npm scripts.

---

## Prerequisites

- **Node.js** 20+ and npm
- **Docker** (OrbStack, Docker Desktop, or compatible) for MySQL
- Ports **3001** (API) and **5173** (Vite dev) available

---

## First-time setup (run in order)

```bash
# 1. Install dependencies
npm install

# 2. Environment
cp .env.example .env
# Ensure DB_PASSWORD=venuepos matches docker-compose.yml default

# 3. Start MySQL (schema auto-applies on first container start)
npm run db:setup

# 4. Verify database (optional)
docker exec venuepos-mysql mysql -uroot -pvenuepos -e "USE venuepos; SHOW TABLES;"

# 5. Run app
npm run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health
- Onboarding: http://localhost:5173/signup

---

## Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `3001` | Express API port |
| `JWT_SECRET` | Yes (prod) | — | Change in production |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime |
| `DB_HOST` | No | `localhost` | |
| `DB_USER` | No | `root` | |
| `DB_PASSWORD` | Yes | `venuepos` | Must match Docker `MYSQL_ROOT_PASSWORD` |
| `DB_NAME` | No | `venuepos` | |
| `YOCO_*` | No | — | Per-company keys preferred via Settings UI |

Vite proxies `/api` → `http://localhost:3001` (see `vite.config.ts`). Frontend API client uses relative `/api` paths.

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite frontend only |
| `npm run server` | Express API only |
| `npm run dev:all` | Both in parallel |
| `npm run db:up` | Start MySQL container |
| `npm run db:down` | Stop MySQL container |
| `npm run db:setup` | Start MySQL + wait for init |
| `npm run build` | Production build (type-check + vite build) |
| `npm run lint` | ESLint with auto-fix |
| `npm run type-check` | `vue-tsc` |

---

## Repository layout

```
├── server.js              # Express entry point
├── db.js                  # MySQL connection pool (import this, not server.js)
├── middleware/auth.mjs    # JWT auth, role guards
├── lib/                   # Shared backend helpers (orderHelpers, yoco)
├── routes/                # API route modules (*.mjs)
├── database/
│   ├── schema.sql         # Full schema (used by Docker init)
│   └── migrate-yoco.sql   # One-off migration for older DBs
├── docker-compose.yml     # MySQL 8 service
├── src/
│   ├── main.ts            # Vue bootstrap + Pinia
│   ├── router/index.ts    # Routes + auth guards
│   ├── stores/auth.ts     # Pinia auth store
│   ├── api/
│   │   ├── client.ts      # Axios + JWT interceptor
│   │   └── venuepos.api.ts
│   ├── views/
│   │   ├── admin/         # Dashboard, branches, tables, etc.
│   │   ├── pos/           # POS terminal
│   │   ├── kitchen/       # KDS
│   │   └── Auth/          # Sign in / onboarding
│   └── components/
│       ├── layout/        # AdminLayout, sidebar, header
│       └── pos/           # Shift modals, receipt, Yoco modal
└── public/
```

### Do not use / legacy

- Old TailAdmin demo routes (`/bars/:bar`, `Ecommerce.vue`, etc.) are removed from the router but some unused files may remain under `src/components/bars/` and `src/views/Ecommerce.vue`. Do not wire them back without explicit request.
- No ORM — use parameterized SQL in route handlers.
- Do not import `db` from `server.js` (circular dependency). Use `db.js`.

---

## Architecture

```
Company (tenant)
  ├── Branches (bar | restaurant | club | lounge)
  │     ├── venue_tables, tabs
  │     ├── shifts (cash drawer)
  │     ├── orders → order_items → payments
  │     └── branch_stock
  ├── users (owner | admin | member)
  │     └── user_branch_access (manager, cashier, bartender, …)
  ├── employees (staff records, optional user link)
  └── products (+ warehouse_stock)
```

### Auth flow

1. `POST /api/auth/register` or `/login` → JWT
2. Token stored in `localStorage` key `venuepos_token`
3. Axios interceptor adds `Authorization: Bearer <token>`
4. Router guard calls `useAuthStore().init()` → `GET /api/auth/me`

### Roles

- **Company:** `owner`, `admin`, `member`
- **Branch:** `manager`, `supervisor`, `cashier`, `bartender`, `server`, `kitchen`, `host`

---

## API map

All routes prefixed with `/api`. Auth required unless noted.

| Prefix | Module | Key endpoints |
|--------|--------|---------------|
| `/auth` | auth.routes.mjs | `POST /register`, `/login`, `GET /me` |
| `/companies` | companies.routes.mjs | `GET /current`, `/dashboard` |
| `/branches` | branches.routes.mjs | CRUD branches |
| `/users` | users.routes.mjs | Users, employees, branch access |
| `/pos` | pos.routes.mjs | Products, orders, receipts, POS context |
| `/tables` | tables.routes.mjs | Tables + tabs |
| `/shifts` | shifts.routes.mjs | Open/close shift, history |
| `/kitchen` | kitchen.routes.mjs | KDS order queue, status updates |
| `/payments` | payments.routes.mjs | Yoco config, charge, webhook |

Health check (no auth): `GET /api/health`

---

## Database

- **Fresh install:** `database/schema.sql` runs automatically via Docker volume mount on first `docker compose up`.
- **Existing DB with old Stripe columns:** run `database/migrate-yoco.sql` once.
- **Reset database:** `docker compose down -v && npm run db:setup` (destroys data).

Core tables: `companies`, `branches`, `users`, `user_branch_access`, `employees`, `venue_tables`, `tabs`, `products`, `branch_stock`, `orders`, `order_items`, `payments`, `shifts`, `expenses`, `audit_log`.

---

## Coding conventions

### Backend

- ESM only (`.mjs` for routes/middleware, `.js` for entry/db)
- Use `authenticate` middleware on protected routes
- Use `requireCompanyRole('owner', 'admin')` for admin-only actions
- Transactions: `conn = await db.getConnection()`, `beginTransaction`, `commit`/`rollback`, `release`
- Never commit secrets; Yoco keys stored per-company in DB

### Frontend

- TypeScript in new Vue files (`<script setup lang="ts">`)
- API calls via `src/api/venuepos.api.ts`, not raw axios scattered in components
- Auth state via `useAuthStore()` only
- Admin pages wrap content in `AdminLayout`
- POS/Kitchen use full-screen custom layouts (no sidebar)
- Match existing Tailwind + brand color tokens in `src/assets/main.css`

### Scope

- Minimize diffs; don't refactor unrelated TailAdmin leftovers
- Don't add tests unless requested
- Don't create git commits unless the user asks

---

## Common agent tasks

### Add a new admin page

1. Create view in `src/views/admin/`
2. Register route in `src/router/index.ts` with `requiresAuth: true`
3. Add sidebar link in `src/components/layout/AppSidebar.vue`
4. Add API methods in `src/api/venuepos.api.ts` if needed

### Add a new API endpoint

1. Add handler in appropriate `routes/*.routes.mjs`
2. Mount is already done in `server.js` — don't duplicate
3. Use `db.js` for queries
4. Expose via `venuepos.api.ts` for frontend consumption

### POS checkout changes

- Entry: `src/views/pos/Terminal.vue`
- Order creation: `POST /api/pos/:branchId/orders` in `routes/pos.routes.mjs`
- Requires open shift unless `payLater: true` (tab orders)
- Yoco: frontend gets token from popup → sends `yocoToken` on order create → backend calls `lib/yoco.mjs`

### Yoco payments

- SDK loaded from CDN in `YocoPaymentModal.vue` (`https://js.yoco.com/sdk/v1/yoco-sdk-web.js`)
- Company keys configured in Settings or `companies.yoco_public_key` / `yoco_secret_key`
- Charge API: `POST https://online.yoco.com/v1/charges/`

---

## Verification checklist

After making changes, agents should:

```bash
# API starts and connects to DB
npm run server
curl http://localhost:3001/api/health

# Frontend compiles (may have pre-existing errors in unused legacy files)
npm run type-check

# Lint changed files
npm run lint
```

Manual smoke test: signup → add branch → add product → open POS → open shift → complete cash sale.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Database connection failed` | Run `npm run db:setup`; ensure Docker is running |
| `ECONNREFUSED :3306` | `docker compose ps` — wait for MySQL healthy |
| 401 on all API calls | Token expired; sign in again |
| `Open a shift before processing sales` | Open shift in POS before checkout |
| Yoco popup fails | Check public key in Settings; currency should be `ZAR` |
| Port 3001 in use | Kill existing `node server.js` process |
| Registration 404 | Another app on port 3000/3001 — VenuePOS uses **3001**; restart `npm run dev:all` and verify health endpoint |

---

## Related docs

- [README.md](./README.md) — user-facing project overview
- [.env.example](./.env.example) — environment template
