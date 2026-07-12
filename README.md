# ShipSmart — Web Frontend (`web`)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![SSE](https://img.shields.io/badge/Streaming-SSE%20client-FF8A5B)](#streaming--perceived-speed)
[![Tests](https://img.shields.io/badge/tests-87%20(Vitest)-3FB950?logo=vitest&logoColor=white)](#tests--quality-gates)
[![Live demo](https://img.shields.io/badge/Live-demo-46E3B7?logo=render&logoColor=white)](https://shipsmart-web.onrender.com)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue)](./LICENSE)

> The **search-first** UI of the ShipSmart platform: a KAYAK-style quote grid
> with an AI copilot that *drives the search* — by rendering **typed product
> instructions** (never parsed prose), applying **policy-gated, undoable form
> patches**, and streaming answers over **Server-Sent Events**. The assistant
> can never fabricate a price or silently mutate the form.

**[▶ Live demo](https://shipsmart-web.onrender.com)** — *hosted on Render's
free tier; first load may take ~30–60 s to wake.*

Talks to two backends: the Java system of record
([ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator))
and the Python AI layer
([ShipSmart-API](https://github.com/nia194/ShipSmart-API)).

**Stack:** React 19 · TypeScript 5.9 (`strict`) · Vite 5 · Tailwind + shadcn/ui
· Radix UI · TanStack Query 5 · React Router · Supabase JS

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [Engineering highlights](#engineering-highlights)
- [Architecture](#architecture)
- [The typed assistant contract](#the-typed-assistant-contract)
- [Safe, undoable form mutation](#safe-undoable-form-mutation)
- [Streaming & perceived speed](#streaming--perceived-speed)
- [Running locally](#running-locally)
- [Available scripts](#available-scripts)
- [Configuration (feature flags)](#configuration-feature-flags)
- [Tests & quality gates](#tests--quality-gates)
- [License](#license)

---

## The ShipSmart ecosystem

One of six sibling repositories — clone them as siblings of this directory. All
six are also mirrored together in
**[ShipSmart](https://github.com/nia194/ShipSmart)** — the umbrella repository
that snapshots each component at a pinned commit (see its `COMPONENTS.yml`).

| Repo | Role | Stack |
|---|---|---|
| **[ShipSmart-Web](https://github.com/nia194/ShipSmart-Web)** *(this repo)* | React SPA — search-first UI, typed AI rendering | React 19, Vite, TS |
| [ShipSmart-Orchestrator](https://github.com/nia194/ShipSmart-Orchestrator) | Java system of record — single Postgres writer, AI trust boundary | Spring Boot 3.4, Java 17 |
| [ShipSmart-API](https://github.com/nia194/ShipSmart-API) | Python AI layer — RAG, guardrails, agents, SSE | FastAPI, Python 3.13 |
| [ShipSmart-MCP](https://github.com/nia194/ShipSmart-MCP) | Read-only MCP tool server | FastAPI + MCP |
| [ShipSmart-Infra](https://github.com/nia194/ShipSmart-Infra) | Supabase schema, RLS, WORM ledger, edge functions | Supabase, Deno |
| [ShipSmart-Test](https://github.com/nia194/ShipSmart-Test) | Cross-repo contracts + evals + e2e | Python 3.13, pytest |

---

## Engineering highlights

| | Capability | Why it's interesting |
|---|---|---|
| 🧾 | **Renders types, not prose** | The copilot's answer is a typed `AssistantResponse` with a discriminated `result` union — one card per variant. The legacy prose parser survives only as a flagged-off fallback (a strangler mid-retirement). |
| ↩️ | **Policy-gated patches + Undo** | A `FormPatch` is auto-applied, confirmed, or never applied — decided by rule-derived confidence (`ai-trust.ts`). Every assistant apply snapshots the draft; `undoLastPatch()` restores it; a manual edit invalidates the snapshot, so Undo only ever reverses the assistant. |
| 🌊 | **SSE streaming client** | `fetch` + `ReadableStream` + `parseSseBuffer`: progressive `onDelta` text, a final typed envelope on `onDone`, graceful `onError` — plus an instant local-answer path from already-loaded grid data. |
| 🎛️ | **Typed grid action bus** | `sort_grid` / `filter_grid` / `suggest` flow through a pure reducer — the model requests, deterministic code executes. |
| 🔌 | **One fetch wrapper** | `lib/http.ts` mints `X-Request-Id` + `traceparent`, attaches the Supabase bearer, parses RFC-7807 problems, and maps errors to friendly copy — no second fetch pattern exists. |
| 🚦 | **12 ops flags** | Copilot surfaces, **three Java strangler cutovers** (quotes / saved options / booking redirect), market scope, API bases — every integration is a dial with instant rollback. |
| 🧼 | **Verifiably clean** | `strict` TS with **0** `as any`, **0** `dangerouslySetInnerHTML`, **0** `eval` across the tree. |

---

## Architecture

```
  App (Router + QueryClientProvider + AuthContext + ShipmentDraftProvider)
   ├─ lib/http.ts ──────────── one wrapper: correlation + bearer + RFC-7807
   │    ├─ advisor-api · concierge-api · workflow-api · feedback-api
   │    └─ assistant-stream.ts ── SSE reader (parseSseBuffer → onDelta/onDone)
   ├─ lib/typed-outputs.ts ─── TS mirror of the API contract (CI parity-tested)
   ├─ lib/ai-trust.ts ──────── advisory-until-confirmed gate
   ├─ lib/grid-actions.ts ──── pure reducer (typed action bus)
   ├─ state/ShipmentDraftContext ── useReducer: APPLY_PATCH snapshots ·
   │                                UNDO_PATCH · conflicts · "from chat" provenance
   ├─ hooks/useShippingQuotes · useSavedOptions   (TanStack Query)
   └─ components/
        assistant/AssistantResult ── typed card renderer
        advisor|concierge/FloatingShipmentAdvisor ── flag-gated copilot
        shipment-form/ · shipping/ (grid) · workflow/ (HITL surface)
```

## The typed assistant contract

`lib/typed-outputs.ts` mirrors the API's Pydantic models **field-for-field**:
`{ intent, apply_policy, confidence, result, grid_actions, tool_calls, audit }`
with `result` a discriminated union — `shipping_option | comparison |
missing_info | policy_answer`. `AssistantResult` renders one card per variant;
when the backend emits the contract, `parseAssistantSections` is bypassed
entirely. The mirror is **parity-tested in CI** by ShipSmart-Test — a rename on
either side fails the build, not a user session.

## Safe, undoable form mutation

- **Auto / confirm / never** per patch, from rule-derived confidence + field
  risk — a price the model *typed* is never authoritative without a quote
  reference.
- **Undo, precisely scoped:** `APPLY_PATCH` snapshots `previousDraft`;
  `UNDO_PATCH` restores it; `canUndo === (previousDraft !== null)`; manual
  edits invalidate the snapshot.
- **Conflicts surfaced, never clobbered** — with per-field "from chat"
  provenance.

## Streaming & perceived speed

Three layers stack: an **instant local answer** (`tryBuildLocalAnswer`) from
already-loaded grid data when possible → **progressive SSE deltas** → the
**final typed envelope** swapping in structured cards. Transport failures
degrade to `onError`; the client never throws. Vendor code is split into
long-lived chunks (`react-vendor` / `supabase` / `query`).

## Running locally

```bash
npx -y pnpm@9 install
npx -y pnpm@9 dev          # http://localhost:5173
```

Point `VITE_PYTHON_API_BASE_URL` / `VITE_JAVA_API_BASE_URL` at local siblings
(ports 8000 / 8080) or the live services.

## Available scripts

| Script | What |
|---|---|
| `pnpm dev` | Vite dev server (:5173) |
| `pnpm build` / `pnpm preview` | production build / local preview |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint 9 (flat config) |
| `pnpm test` / `pnpm test:watch` | Vitest |

## Configuration (feature flags)

| `VITE_*` | Effect |
|---|---|
| `VITE_USE_CONCIERGE` / `VITE_USE_WORKFLOW` | copilot + workflow surfaces |
| `VITE_USE_JAVA_QUOTES` / `VITE_USE_JAVA_SAVED_OPTIONS` / `VITE_USE_JAVA_BOOKING_REDIRECT` | strangler cutovers to the Java backend |
| `VITE_SHIPPING_SCOPE` / `VITE_DOMESTIC_COUNTRY` | market scope |
| `VITE_PYTHON_API_BASE_URL` / `VITE_JAVA_API_BASE_URL` | backend bases |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_APP_ENV` | platform wiring |

## Tests & quality gates

**87 Vitest tests across 22 files** — libs (http, typed-outputs, ai-trust,
grid-actions, SSE parsing), state (draft / undo / conflicts), hooks, and typed
card rendering. Three distinct CI gates: `tsc -b --noEmit`, ESLint, Vitest.
Cross-repo: the typed contract is parity-locked by **ShipSmart-Test**.

## License

See [LICENSE](./LICENSE).
