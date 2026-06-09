# VenuePOS

A professional, web-based point-of-sale system for **bars, clubs, and restaurants**. Manage multiple venues from one company account — onboard staff, run checkout terminals, track shifts, send orders to the kitchen, and accept card payments via Yoco.

Built with Vue 3 and Express, designed for operators who need a modern back office and a fast, touch-friendly POS without installing desktop software.

---

## Features

### Multi-tenant platform
- **Company onboarding** — register your business and owner account in one flow
- **Branches** — manage bars, restaurants, clubs, and lounges under one company
- **Team & access** — create users with company roles and per-branch permissions
- **Employee records** — staff codes and POS PINs for shift tracking

### Point of sale
- **Touch-friendly POS terminal** — category product grid, cart, multiple payment methods
- **Shift management** — open/close shifts with opening cash, sales tracking, and variance reconciliation
- **Table & tab management** — floor plan for dine-in, open bar tabs for walk-ins
- **Receipt printing** — print-ready receipt after every completed sale

### Operations
- **Kitchen Display System (KDS)** — live order queue with item-level status (pending → preparing → ready → served)
- **Product catalog** — centralized menu with optional "send to kitchen" flag per item
- **Dashboard** — revenue, orders, and branch performance at a glance

### Payments
- Cash, manual card, mobile money, and tab (pay later)
- **Yoco card payments** — secure popup checkout for South African venues (ZAR)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS 4, Vite |
| Backend | Express 5, JWT, bcrypt |
| Database | MySQL 8 |
| Payments | [Yoco](https://www.yoco.com/za/) Checkout API |
| Dev infra | Docker Compose (MySQL) |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [Docker](https://www.docker.com/) (OrbStack, Docker Desktop, or equivalent)
- npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd plaintive_bar_chains

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
JWT_SECRET=your-long-random-secret
DB_PASSWORD=venuepos
```

### Start the database

```bash
npm run db:setup
```

This starts MySQL in Docker and applies `database/schema.sql` automatically on first run.

Verify it's running:

```bash
docker compose ps
curl http://localhost:3001/api/health   # after starting the server
```

### Run the application

```bash
# Start API (port 3001) + frontend (port 5173) together
npm run dev:all
```

Or run them separately in two terminals:

```bash
npm run server   # API only
npm run dev      # Frontend only
```

Open **http://localhost:5173/signup** to create your first company account.

---

## First-time setup walkthrough

After signing up:

1. **Branches** — add your venues (`/admin/branches`)
2. **Floor plan** — configure tables and tabs (`/admin/tables`)
3. **Products** — build your menu; tick "Send to kitchen" for food items (`/admin/products`)
4. **Team** — add staff and grant system access (`/admin/employees`)
5. **Settings** — set currency, tax rate, receipt footer, and Yoco keys (`/admin/settings`)
6. **POS** — open a shift, then start selling (`/pos/:branchId` from the sidebar)
7. **Kitchen** — display active orders on a tablet (`/kitchen/:branchId`)

---

## Application routes

| Route | Description |
|-------|-------------|
| `/signup` | Company onboarding |
| `/signin` | Sign in |
| `/` | Company dashboard |
| `/admin/branches` | Manage branches |
| `/admin/tables` | Floor plan & open tabs |
| `/admin/products` | Product catalog |
| `/admin/employees` | Team & access control |
| `/admin/shifts` | Shift history & cash variance |
| `/admin/settings` | Company profile, tax, Yoco |
| `/pos/:branchId` | POS terminal |
| `/kitchen/:branchId` | Kitchen display |

---

## Yoco payment setup

VenuePOS uses [Yoco](https://www.yoco.com/za/) for card payments — ideal for South African venues.

1. Create a Yoco account and open [Yoco Portal → Integration](https://portal.yoco.com/online/settings/integration)
2. Copy your **public key** (`pk_test_…` or `pk_live_…`) and **secret key** (`sk_test_…` or `sk_live_…`)
3. In VenuePOS, go to **Settings → Yoco Payments** and paste both keys
4. Set your company **currency to ZAR** in Settings
5. At the POS, select **Card (Yoco)** — the Yoco payment popup will open for the customer

Use test keys during development; switch to live keys in production.

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `JWT_SECRET` | Secret for signing auth tokens | — |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `venuepos` |
| `DB_NAME` | Database name | `venuepos` |

Yoco keys can also be set globally in `.env`, but per-company configuration via the Settings UI is recommended for multi-tenant use.

---

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start frontend + API |
| `npm run dev` | Frontend dev server (Vite) |
| `npm run server` | API server (Express) |
| `npm run db:up` | Start MySQL container |
| `npm run db:down` | Stop MySQL container |
| `npm run db:setup` | Start MySQL and wait for init |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check |

---

## Project structure

```
├── server.js                 # Express API entry
├── db.js                     # MySQL connection pool
├── routes/                   # REST API handlers
├── middleware/               # JWT authentication
├── lib/                      # Shared backend utilities
├── database/
│   ├── schema.sql            # Full database schema
│   └── migrate-yoco.sql      # Migration helper
├── docker-compose.yml        # MySQL service
├── src/
│   ├── views/                # Page components
│   ├── components/           # Reusable UI
│   ├── stores/               # Pinia stores
│   ├── api/                  # HTTP client & API wrappers
│   └── router/               # Vue Router config
└── AGENTS.md                 # Setup guide for AI coding agents
```

---

## API overview

Base URL: `http://localhost:3001/api` (proxied as `/api` in dev)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Onboard new company |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Current user + branches |
| GET | `/companies/dashboard` | KPIs and branch stats |
| GET/POST | `/branches` | List / create branches |
| GET/POST | `/users/employees` | Staff management |
| GET | `/pos/:branchId/context` | POS session (shift, tables, tabs) |
| POST | `/pos/:branchId/orders` | Complete a sale |
| GET/POST | `/tables/:branchId` | Table management |
| POST | `/shifts/:branchId/open` | Open cash drawer shift |
| GET | `/kitchen/:branchId/orders` | Kitchen order queue |
| PUT | `/payments/config` | Configure Yoco keys |

All protected routes require `Authorization: Bearer <token>`.

---

## Database management

**Fresh install** — handled automatically by Docker on first start.

**Reset database** (destroys all data):

```bash
docker compose down -v
npm run db:setup
```

**Migrate existing database** (Stripe → Yoco columns):

```bash
docker exec -i venuepos-mysql mysql -uroot -pvenuepos venuepos < database/migrate-yoco.sql
```

---

## Development notes

- The frontend dev server proxies `/api` requests to Express on port **3001** (not 3000 — many other dev tools use 3000)
- Auth tokens are stored in `localStorage` under the key `venuepos_token`
- POS sales require an **open shift** before checkout (except tab/pay-later orders)
- See [AGENTS.md](./AGENTS.md) for detailed guidance when using AI coding agents in this repo

---

## Troubleshooting

**Database connection failed**
- Ensure Docker is running: `docker compose ps`
- Run `npm run db:setup` and wait ~15 seconds for MySQL to initialize

**Cannot complete sale — shift required**
- Open a shift from the POS terminal before processing sales

**Yoco payment doesn't appear**
- Configure Yoco keys in Settings
- Set company currency to `ZAR`

**Port already in use**
- Stop any existing process on 3001 or 5173, or change `PORT` in `.env`
- If registration returns **404**, another app may be bound to the API port — confirm `curl http://localhost:3001/api/health` returns VenuePOS JSON, not HTML from another project

---

## License

Private — all rights reserved.
