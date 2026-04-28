# ShipSmart — Web Frontend (`web`)

React SPA for the ShipSmart shipping comparison and management platform.
Talks to two backends directly: the Java transactional API and the
Python AI/orchestration API.

**Stack:** React 19 · TypeScript 5.9 · Vite 5 · Tailwind + shadcn/ui · Radix UI · TanStack Query · React Router · Supabase JS · Zod + react-hook-form

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
- pnpm 9+

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

## Build & test

```bash
pnpm build        # production build → dist/
pnpm test         # vitest run
pnpm typecheck
pnpm lint
```

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
