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
- [Hybrid Form ⇄ Chat Sync](#hybrid-form--chat-sync)
- [License](#license)

---

## The ShipSmart ecosystem

This frontend is one of six sibling repositories. Clone them as
siblings of this directory when working on the full system.

| Repo | Role | Stack |
|---|---|---|
| **[ShipSmart-Web](https://github.com/nia194/ShipSmart-Web)** *(this repo)* | React SPA — user-facing UI | React 19, Vite, TS |
| [ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator) | Java transactional API — **single writer** to Supabase Postgres; quotes, bookings, saved options, carrier integration | Spring Boot 3.4, Java 17 |
| [ShipSmart-API](https://github.com/nia194/ShipSmart-API) | Python AI/orchestration service — RAG, advisors, recommendations, compliance (UC2), multi-agent workflow (UC3/UC4) | FastAPI, Python 3.13 |
| [ShipSmart-MCP](https://github.com/nia194/ShipSmart-MCP) | MCP tool server — `validate_address`, `get_quote_preview` (provider-pluggable) | FastAPI + MCP |
| [ShipSmart-Infra](https://github.com/nia194/ShipSmart-Infra) | Supabase migrations + edge functions, deployment configs, docs | Supabase, Render blueprints |
| [ShipSmart-Test](https://github.com/nia194/ShipSmart-Test) | Cross-repo integration harness — contract + live e2e suites, cross-service Postman collection | Python 3.13, pytest |

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
| Shipment advisor | Python `/api/v1/advisor/{shipping,tracking}` | Shipment-scoped Q&A panel (`src/components/advisor/`) with provenance badges + source citations. Read-only hydrates context from Java `GET /api/v1/shipments/{id}`. Degrades gracefully — advisor errors never affect quotes/bookings. |
| Saved options | Java `/api/v1/saved-options` | Authenticated CRUD. Falls back to a Supabase edge function when `VITE_USE_JAVA_SAVED_OPTIONS=false`. |
| Booking redirect | Java `/api/v1/bookings/redirect` | Hands off to carrier with tracking enabled (`VITE_USE_JAVA_BOOKING_REDIRECT`). |
| Multi-agent workflow (UC3/UC4) | Python `/api/v1/workflow/{process,{id},{id}/review}` | Optional showcase page (`src/components/workflow/`, `src/pages/WorkflowPage.tsx`): run a shipment through the multi-agent workflow, and when it suspends on an unverified high-risk area, clear/block it as a human reviewer. Gated behind `VITE_USE_WORKFLOW` (route + nav hidden when off). |
| Shipping concierge (form ⇄ chat) | Python `/api/v1/concierge/chat` | A chat panel (`src/components/advisor/ConciergePanel.tsx`) sharing one `ShipmentDraft` store (`src/state/`) with the form: chat fills the form fields and the form's values stop the chat re-asking, with a confirm on conflicts. Gated behind `VITE_USE_CONCIERGE` (hidden when off). |

---

## Architecture inside this app

```
src/
├── main.tsx                       React entry
├── App.tsx                        Router shell + top nav
├── pages/                         Route components (HomePage, AuthPage, SavedPage, WorkflowPage, NotFound)
├── components/
│   ├── auth/                      SaveSignInModal (sign-in prompt before saving)
│   ├── workflow/                  Workflow UI (UC3/UC4): WorkflowForm, WorkflowResult, ReviewPanel — gated on VITE_USE_WORKFLOW
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
│   ├── advisor-api.ts             Typed client for the Python advisor endpoints (via http)
│   ├── workflow-api.ts            Typed client for the Python /workflow endpoints (UC3/UC4, via http)
│   ├── shipping-data.ts           Static carrier/service reference data + helpers
│   └── utils.ts
├── config/
│   └── api.ts                     Base URLs + feature flags + Java endpoint helpers (javaApi)
├── hooks/                         TanStack Query / data hooks
│   ├── useShippingQuotes.ts       Java /quotes (or Supabase edge fn fallback)
│   ├── useSavedOptions.ts         Java /saved-options (or Supabase edge fn fallback)
│   └── use-toast.ts               Radix toast state
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

# Feature flags — set to "false" to fall back to Supabase edge functions.
VITE_USE_JAVA_QUOTES=true
VITE_USE_JAVA_SAVED_OPTIONS=true
VITE_USE_JAVA_BOOKING_REDIRECT=true

# Multi-agent workflow page (UC3/UC4) — off by default (route + nav hidden).
VITE_USE_WORKFLOW=false

# Conversational Concierge chat on the home page — ON by default; set "false" to hide it.
VITE_USE_CONCIERGE=true

# Shipping scope (mirrors the API's SHIPPING_SCOPE). worldwide (default) = cross-border
# allowed; domestic = deliveries within VITE_DOMESTIC_COUNTRY only (the form hides the
# country fields and the result hides duties).
VITE_SHIPPING_SCOPE=worldwide
VITE_DOMESTIC_COUNTRY=US
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
| `pnpm test` | Vitest one-shot run (63 tests across 14 files, jsdom). |
| `pnpm test:e2e` | Playwright browser smoke (`e2e-web/`) against a live dev server — the real web-flow. |
| `pnpm test:watch` | Vitest in watch mode. |

### Tests

Vitest + `@testing-library/react` (jsdom), under `src/`:

| File | Focus |
| --- | --- |
| `lib/advisor-api.test.ts` | The advisor error taxonomy → friendly copy, `shipmentToContext` mapping, input cap. |
| `lib/http.test.ts` | The shared fetch wrapper: correlation headers, bearer JWT, idempotency key, RFC-7807 `HttpError`, 204. |
| `hooks/useShippingQuotes.test.ts` / `hooks/useSavedOptions.test.ts` | The Java-vs-Supabase backend toggle and signed-in/out state. |
| `components/shipping/CompareSection.test.tsx` | Loading state + comparison grid render from a fixture. |
| `lib/workflow-api.test.ts` | Workflow error taxonomy → friendly copy, advisory `verdictLabel` mapping, input cap. |
| `components/workflow/WorkflowPage.test.tsx` | Submit → suspended (`awaiting_review`) result + review panel → clear → completed. |
| `state/shipmentDraft.test.ts` | The shared-draft merge rules (conflict/provenance) + the concierge adapters (diff-only back-channel). |
| `components/advisor/ConciergePanel.test.tsx` | Chat → reply, the back-channel patch fills the form, and the chat-vs-form conflict confirm. |
| `components/advisor/FloatingShipmentAdvisor.test.tsx` | The floating advisor launcher: open/close, shipment-context wiring, and panel switching. |
| `components/workflow/WorkflowForm.test.tsx` | Workflow request form validation + submit payload shape. |
| `state/useShipmentDraftFormSync.test.tsx` | The form ⇄ draft binding hook: form edits write through, chat patches reflect back without clobbering. |

The TS response interfaces in `src/lib/advisor-api.ts`, `src/lib/workflow-api.ts`, and `src/components/shipping/compare.types.ts` are also asserted against the backend schemas from `ShipSmart-Test/contract/`.

### Continuous integration

`.github/workflows/ci.yml` gates every push / PR with the same scripts, in order:
**eslint** (`pnpm lint`) → **type-check** (`pnpm typecheck`) → **Vitest** (`pnpm test`) →
**production build** (`pnpm build`). It runs on Node 20 with a dummy Supabase env, so the
build and tests pass without any real secrets.

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
- `src/lib/workflow-api.ts` ↔ the Python `/api/v1/workflow/*` schemas
  (`WorkflowResponse`, `ComplianceSummary`, HS/duty/carrier/doc domain
  types) — asserted by `ShipSmart-Test/contract/`
- `src/lib/concierge-api.ts` + `src/state/shipmentDraft.ts` ↔ the Python
  `/api/v1/concierge/chat` schema + slot superset (the shared shipment context the
  form and the chat both populate) — asserted by `ShipSmart-Test/contract/`

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

## Hybrid Form ⇄ Chat Sync

The shipment **form** and a conversational **concierge chat** are two views over **one
shared shipment draft**: type "Atlanta → Seattle, 12 lb" in the chat and the route /
weight fields fill in; fill the form and the chat already knows and won't re-ask. Gated by
`VITE_USE_CONCIERGE` (**on by default**; set to `false` to hide the panel so the form behaves
exactly as before). The **bulk of this feature lives in this repo.**

How it works:

- **One shared `ShipmentDraft` store** (`src/state/shipmentDraft.ts`,
  `ShipmentDraftContext.tsx`) — a typed superset of every field either surface can
  gather, backed by a pure `useReducer`. Scalar fields are wrapped in
  `Tracked<T> { value, source, at }` for provenance (`"form" | "chat" | "hydrated"`).
  Reuses the existing `PackageItem` / `Priority` types (no parallel models) and React
  Context + reducer (no new state-management dependency).
- **Deterministic merge rules** (pure, unit-tested in `state/shipmentDraft.test.ts`): empty
  never overwrites non-empty; a manual form edit always wins; chat fills empty fields freely
  but a genuine chat-vs-form conflict is **surfaced for confirmation, never silently
  applied**; `hydrated` (Java) loses to explicit user writes; normalize before compare so
  "Atlanta" == "Atlanta, GA"; chat fills only the empty numeric primary-item fields.
- **Both surfaces bind to the store.** `HomePage` writes its form fields to the store on
  edit and reflects chat patches back into the inputs (the wizard's section-completion and
  quote-fetch flow is preserved); `ConciergePanel` derives its conversation state from the
  store and patches it back through two pure adapters — `draftToConciergeState(draft)` and
  `conciergeStateToPatch(state)` (which diffs the echoed state and applies only real changes).
- **The "don't re-ask" UX** — because the chat sends the full draft, the server won't ask
  for form-filled fields; chat-extracted values appear in the form fields directly, and a
  conflicting suggestion shows a one-line "keep X or use Y?" confirm. A single "Start over"
  resets both the draft and the chat thread.

Backed by the **Conversational Concierge** chat endpoint (`POST /api/v1/concierge/chat`, a
slot-filling `ConversationState`) in ShipSmart-API. **Backward-compatible** — set
`VITE_USE_CONCIERGE=false` and, with the chat hidden, the form behaves exactly as it does today.

---

## License

See [LICENSE](./LICENSE) for the full text.
