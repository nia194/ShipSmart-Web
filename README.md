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

**Stack:** React 19 · TypeScript 5.9 · Vite 5 · Tailwind + shadcn/ui · Radix UI · TanStack Query · React Router · Supabase JS

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

The Web app holds a Supabase session and attaches the JWT to its Java
API calls. The Python comparison endpoint (`/api/v1/compare`) is called
without auth — it returns ranking/insight data only.

---

## What this app does

| Page / feature | Calls | Notes |
|---|---|---|
| Auth (login, signup) | Supabase JS | JWT stored in Supabase client; attached to Java API calls as `Authorization: Bearer …`. |
| Quote comparison | Java `/api/v1/quotes` | Submit a shipment, get service quotes. Falls back to the `get-shipping-quotes` Supabase edge function when `VITE_USE_JAVA_QUOTES=false`. |
| Comparison insights | Python `/api/v1/compare` | Scored ranking, per-option insights, and scenario breakdowns for the compared services. |
| Saved options | Java `/api/v1/saved-options` | Authenticated CRUD. Falls back to a Supabase edge function when `VITE_USE_JAVA_SAVED_OPTIONS=false`. |
| Booking redirect | Java `/api/v1/bookings/redirect` | Hands off to carrier with tracking enabled (`VITE_USE_JAVA_BOOKING_REDIRECT`). |

---

## Architecture inside this app

```
src/
├── main.tsx                       React entry
├── App.tsx                        Router shell + top nav
├── pages/                         Route components (HomePage, AuthPage, SavedPage, NotFound)
├── components/
│   ├── auth/                      SaveSignInModal (sign-in prompt before saving)
│   ├── shipping/                  Core comparison UI + its API/types
│   │   ├── CompareSection.tsx     Results list + comparison view
│   │   ├── compare.api.ts         Python /api/v1/compare fetch helper
│   │   ├── compare.types.ts       Compare request/response + domain types (Shipment, CompareOption, …)
│   │   ├── CityInput.tsx, QuoteRow.tsx, Logo.tsx, BookmarkIcon.tsx, SharedUI.tsx
│   └── ui/                        shadcn/ui primitives in use (dialog, popover, toast, calendar, …)
├── contexts/
│   └── AuthContext.tsx            Supabase session + auth helpers
├── integrations/
│   └── supabase/                  Generated Supabase client + DB types
│       ├── client.ts
│       └── types.ts
├── lib/
│   ├── http.ts                    Shared fetch wrapper: mints X-Request-Id + W3C traceparent, attaches Supabase JWT, optional Idempotency-Key, parses RFC 7807 ProblemDetail
│   ├── shipping-data.ts           Static carrier/service reference data + helpers
│   └── utils.ts
├── config/
│   └── api.ts                     Base URLs + feature flags + Java endpoint helpers (javaApi)
├── hooks/                         TanStack Query / data hooks
│   ├── useShippingQuotes.ts       Java /quotes (or Supabase edge fn fallback)
│   ├── useSavedOptions.ts         Java /saved-options (or Supabase edge fn fallback)
│   ├── use-toast.ts               Radix toast state
│   └── use-mobile.tsx             Viewport breakpoint hook
└── styles/                        Global stylesheet (shipsmart.css)
```

Java API calls attach the Supabase access token automatically when the
user is signed in (Supabase HS256 JWT validated by Java's
`JwtAuthFilter`). The Python `/api/v1/compare` endpoint is called
unauthenticated.

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

- `src/config/api.ts` (`javaApi` helpers + base URLs) ↔ Java/Python
  route paths
- `src/hooks/useShippingQuotes.ts`, `useSavedOptions.ts` ↔ Java
  controller DTOs (and the Supabase edge function fallbacks) they call
- `src/components/shipping/compare.api.ts` and `compare.types.ts` ↔
  the Python `/api/v1/compare` request/response schema
- `compare.types.ts` also holds the canonical domain types (Shipment,
  CompareOption, OptionInsight, Scenario, etc.)

---

## Operational notes

- **Blank page in dev**: check the browser console — almost always a
  missing or wrong `VITE_SUPABASE_ANON_KEY`.
- **CORS errors hitting Java/Python**: each backend's
  `CORS_ALLOWED_ORIGINS` must include `http://localhost:5173` (or your
  deployed origin).
- **Comparison insights missing / `/api/v1/compare` errors**: confirm
  the Python service is running and `VITE_PYTHON_API_BASE_URL` points at
  it. Quotes still render from Java even if `/compare` fails — only the
  ranking/insight overlay is affected.
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
