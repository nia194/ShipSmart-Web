# ShipSmart — Web Frontend (`web`)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deploy: Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)](https://render.com/)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue)](./LICENSE)

React SPA for the ShipSmart shipping comparison and management platform.
Talks to two backends directly: the Java transactional API
([ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator))
and the Python AI/orchestration API
([ShipSmart-API](https://github.com/nia194/ShipSmart-API)).

**Stack:** React 19 · TypeScript 5.9 · Vite 5 · Tailwind + shadcn/ui · Radix UI · TanStack Query · React Router · Supabase JS · Zod + react-hook-form

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [What this app does](#what-this-app-does)
- [Architecture inside this app](#architecture-inside-this-app)
- [Running locally](#running-locally)
- [Available scripts](#available-scripts)
- [Deployment (Render)](#deployment-render)
- [Cross-service contracts](#cross-service-contracts)
- [Operational notes](#operational-notes)
- [License](#license)

---

## The ShipSmart ecosystem

This frontend is one of five sibling repositories. Clone them as
siblings of this directory when working on the full system.

| Repo | Role | Stack |
|---|---|---|
| **[ShipSmart-Web](https://github.com/nia194/ShipSmart-Web)** *(this repo)* | React SPA — user-facing UI | React 19, Vite, TS |
| [ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator) | Java transactional API — **single writer** to Supabase Postgres; quotes, bookings, saved options, carrier integration | Spring Boot 3.4, Java 17 |
| [ShipSmart-API](https://github.com/nia194/ShipSmart-API) | Python AI/orchestration service — RAG, advisors, recommendations | FastAPI, Python 3.13 |
| [ShipSmart-MCP](https://github.com/nia194/ShipSmart-MCP) | MCP tool server — `validate_address`, `get_quote_preview` (provider-pluggable) | FastAPI + MCP |
| [ShipSmart-Infra](https://github.com/nia194/ShipSmart-Infra) | Supabase migrations + edge functions, deployment configs, docs | Supabase, Render blueprints |

```
                ┌───────────────────────────────────────────────────┐
                │              ShipSmart-Web (this repo)            │
                │                React SPA · Vite                   │
                └───────────────┬───────────────────────┬───────────┘
                                │                       │
                  Authorization: Bearer <Supabase JWT>  │
                                │                       │
                                ▼                       ▼
        ┌──────────────────────────────┐   ┌──────────────────────────────┐
        │     ShipSmart-Orchestrator   │   │         ShipSmart-API        │
        │        Java / Spring Boot    │◀──│         Python / FastAPI     │
        │  (sole writer to Postgres)   │   │      RAG · advisors · recs   │
        └──────────────┬───────────────┘   └──────────────┬───────────────┘
                       │                                  │
                       │                                  ▼
                       │                   ┌──────────────────────────────┐
                       │                   │        ShipSmart-MCP         │
                       │                   │   shipping tools (HTTP/MCP)  │
                       │                   └──────────────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   Supabase Postgres + Auth   │
        └──────────────────────────────┘
```

The Web app holds a Supabase session and sends the same JWT to both
backends. The Python service forwards that JWT to Java when it needs to
hydrate quotes for the recommendation endpoint.

---

## What this app does

| Page / feature | Calls | Notes |
|---|---|---|
| Auth (login, signup) | Supabase JS | JWT stored in Supabase client; forwarded to both APIs as `Authorization: Bearer …`. |
| Quote comparison | Java `/api/v1/quotes` | Submit a shipment, get service quotes. |
| Saved options | Java `/api/v1/saved-options` | Authenticated CRUD. |
| Booking redirect | Java `/api/v1/bookings/redirect` | Hands off to carrier with tracking enabled. |
| Shipping advisor | Python `/api/v1/advisor/shipping` | RAG + tool-grounded LLM advice. |
| Tracking advisor | Python `/api/v1/advisor/tracking` | RAG + LLM guidance, returns next steps. |
| Recommendations | Python `/api/v1/advisor/recommendation` | Scored ranking of services. Can pass `services[]` directly **or** just `context.shipment_request_id` to have Python hydrate from Java. |
| RAG q&a | Python `/api/v1/rag/query` | General shipping questions over the document knowledge base. |

---

## Architecture inside this app

```
src/
├── main.tsx                       React entry
├── App.tsx                        Router shell
├── pages/                         Route components (Home, Auth, Advisor, Saved, NotFound)
├── components/                    Shared UI (shadcn/ui based)
├── contexts/
│   └── AuthContext.tsx            Supabase session + auth helpers
├── integrations/
│   └── supabase/                  Generated Supabase client + DB types
│       ├── client.ts
│       └── types.ts
├── lib/
│   ├── http.ts                    Shared fetch wrapper: mints X-Request-Id + W3C traceparent, attaches Supabase JWT, optional Idempotency-Key, parses RFC 7807 ProblemDetail
│   ├── advisor-api.ts             Python fetch helpers (advisors, RAG, recommendations)
│   ├── ai-types.ts                Advisor/RAG response shapes
│   ├── shipping-data.ts           Static carrier/service reference data
│   └── utils.ts
├── config/
│   └── api.ts                     Base URLs + feature flags + endpoint helpers (javaApi/pythonApi)
├── hooks/                         TanStack Query wrappers
│   ├── useShippingQuotes.ts       Java /quotes (or Supabase edge fn fallback)
│   ├── useSavedOptions.ts         Java /saved-options (or Supabase edge fn fallback)
│   └── useRecommendation.ts       Python /advisor/recommendation
└── shared/types/                  Canonical domain types (Shipment, Quote, SavedOption, etc.)
```

API hooks attach the Supabase access token automatically when the user
is signed in. The same token is accepted by both backends (Supabase
HS256 JWT validated by Java's `JwtAuthFilter`, and forwarded by Python
to Java when the recommendation hydration path runs).

Each Java-backed feature has a `VITE_USE_JAVA_*` flag (see env vars
below). When the flag is `false`, the corresponding hook falls back to
the legacy Supabase edge function path.

---

## Running locally

### Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` will pick it up automatically)

### Install

```bash
pnpm install
```

### Configure

```bash
cp .env.example .env.local
```

Required env vars:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key — Settings → API in Supabase>
VITE_JAVA_API_BASE_URL=http://localhost:8080
VITE_PYTHON_API_BASE_URL=http://localhost:8000
VITE_APP_ENV=development

# Feature flags — set to "false" to fall back to Supabase edge functions.
VITE_USE_JAVA_QUOTES=true
VITE_USE_JAVA_SAVED_OPTIONS=true
VITE_USE_JAVA_BOOKING_REDIRECT=true
```

Without `VITE_SUPABASE_ANON_KEY` the Supabase client cannot initialize
and **all auth-gated pages will be broken** even though Vite happily
serves the bundle. This is the most common "site is up but nothing
works" failure.

### Run

```bash
pnpm dev
```

Frontend comes up on `http://localhost:5173`. Make sure both backends
are also running locally (`http://localhost:8080` and
`http://localhost:8000`) or set the `VITE_*_API_BASE_URL` env vars to
their deployed equivalents.

---

## Available scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server on port 5173 with HMR. |
| `pnpm build` | Production build into `dist/`. |
| `pnpm build:dev` | Build in development mode (sourcemaps, no minification). |
| `pnpm preview` | Serve the built `dist/` locally to smoke-test the production bundle. |
| `pnpm typecheck` | `tsc -b --noEmit` — catch type errors without emitting JS. |
| `pnpm lint` | ESLint across the repo. |
| `pnpm test` | Vitest one-shot run. |
| `pnpm test:watch` | Vitest in watch mode. |

---

## Deployment (Render)

This repo is deployed as a **Render Static Site** using the
[`render.yaml`](./render.yaml) Blueprint at the root. The build runs:

```bash
corepack enable && pnpm install && pnpm build
```

…and Render publishes `dist/`. A rewrite rule (`/*` → `/index.html`)
keeps client-side routing working on hard refresh.

Two env vars are marked `sync: false` and must be set manually in the
Render dashboard before the first deploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The Java and Python API base URLs default to the production Render
services (`shipsmart-api-java.onrender.com` and
`shipsmart-api-python.onrender.com`). Override them in the dashboard if
you point this frontend at a different environment.

PR previews are disabled — toggle `pullRequestPreviewsEnabled` in
`render.yaml` if you want them back.

---

## Cross-service contracts

When the Java or Python APIs change shape, update these files in
lockstep:

- `src/config/api.ts` (`javaApi` / `pythonApi` helpers) ↔ Java/Python
  route paths
- `src/hooks/useShippingQuotes.ts`, `useSavedOptions.ts`,
  `useRecommendation.ts` ↔ Java controller DTOs and Python advisor
  schemas they call
- `src/lib/advisor-api.ts` ↔ Python `app/schemas/advisor.py` and
  `app/api/routes/orchestration.py`
- `src/shared/types/` for canonical domain types (Shipment, Quote, SavedOption, etc.)

For the recommendation endpoint in particular: you can either send a
full `services[]` array or just `context.shipment_request_id` and let
the Python service fetch the quotes from Java internally. The frontend
should prefer the latter once a shipment exists, to avoid duplicating
quote state on the client.

---

## Operational notes

- **Blank page in dev**: check the browser console — almost always a
  missing or wrong `VITE_SUPABASE_ANON_KEY`.
- **CORS errors hitting Java/Python**: each backend's
  `CORS_ALLOWED_ORIGINS` must include `http://localhost:5173` (or your
  deployed origin).
- **HTTP 429 from `/advisor/*`**: the Python service rate-limits
  advisor endpoints per IP (default `10/minute`). Tune via
  `RATE_LIMIT_ADVISOR` on the Python side.
- **Echo / placeholder advisor responses**: the Python service has no
  LLM provider configured. Set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
  + the matching `LLM_PROVIDER_*` flag in `ShipSmart-API/.env`.
- **404 on hard refresh in production**: confirm the Render rewrite
  rule from `render.yaml` is in place — without it, deep links bypass
  the SPA shell.
- **Auth works locally, fails on Render**: re-check that
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the Render
  dashboard (they are `sync: false` and won't be picked up from the
  blueprint).

---

## License

See [LICENSE](./LICENSE) for the full text.
