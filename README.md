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

> **Metric convention:** structural counts are facts (87 tests, 12 flags,
> 0 `as any`/`eval`/`innerHTML`); latency/bundle figures are **(target)**.

---

## Table of contents

- [The ShipSmart ecosystem](#the-shipsmart-ecosystem)
- [Architecture (HLD)](#architecture-hld)
- [Component tree](#component-tree)
- [The typed assistant contract](#the-typed-assistant-contract)
- [Safe, undoable form mutation](#safe-undoable-form-mutation)
- [Streaming & perceived speed](#streaming--perceived-speed)
- [State management](#state-management)
- [Module design (LLD)](#module-design-lld)
- [Performance, safety & degradation](#performance-safety--degradation)
- [Deployment topology](#deployment-topology)
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

## Architecture (HLD)

**Figure 1 — app composition.** Everything the copilot can do flows through
three framework-free modules — `typed-outputs` (what it may say), `ai-trust`
(what may apply), `grid-actions` (what the grid may do) — the most heavily
unit-tested seams in the app.

```mermaid
flowchart TB
    MAIN["main.tsx"] --> APP["App: Router + QueryClientProvider + AuthContext + ShipmentDraftProvider"]
    subgraph LIB["lib/ (framework-free core)"]
        HTTP["http.ts — X-Request-Id + traceparent + bearer + RFC-7807 + friendly errors"]
        CLI["advisor-api · concierge-api · workflow-api · feedback-api"]
        SSE["assistant-stream.ts — parseSseBuffer / onDelta / onDone / onError"]
        TO["typed-outputs.ts — TS mirror of API Pydantic (CI parity)"]
        TRUST["ai-trust.ts — responseNeedsConfirmation"]
        GA["grid-actions.ts — pure reducer"]
    end
    subgraph STATE["state/"]
        SD["ShipmentDraftContext — useReducer: APPLY_PATCH snapshot · UNDO_PATCH · conflicts · provenance"]
        SYNC[useShipmentDraftFormSync]
    end
    subgraph HOOKS["hooks/"]
        H1["useShippingQuotes (TanStack Query)"]
        H2[useSavedOptions]
    end
    subgraph UI["components/"]
        AR["assistant/AssistantResult — typed card renderer"]
        COP["FloatingShipmentAdvisor (flag-gated copilot) + tryBuildLocalAnswer"]
        FORM["shipment-form/ steps"]
        GRID["shipping/ QuoteRow · CompareSection · SmartResultsSection"]
        WKF["workflow/ WorkflowForm · ReviewPanel · WorkflowResult"]
    end
    PAGES["pages: Home · Auth · Saved · Workflow · NotFound"]
    APP --> LIB
    APP --> STATE
    APP --> PAGES
    PAGES --> UI
    UI --> HOOKS
    UI --> STATE
    UI --> LIB
```

---

## Component tree

**Figure 2 — key components: state owners vs consumers, and which flag gates
which surface.**

```mermaid
flowchart TB
    APP[App] --> HP[HomePage]
    APP --> AU["AuthPage (Supabase)"]
    APP --> SP[SavedPage]
    APP --> WP["WorkflowPage (VITE_USE_WORKFLOW)"]
    HP --> HERO[HeroSection]
    HP --> SPF["ShipmentProgressForm (owner: draft via context)"]
    SPF --> LS[LocationStep]
    SPF --> PDS[PackageDetailsStep]
    SPF --> DS[DateStep]
    HP --> QRS["QuoteResultsSection (owner: quotes via TanStack)"]
    QRS --> QR[QuoteRow]
    QRS --> CS[CompareSection]
    QRS --> SRS[SmartResultsSection]
    HP --> FSA["FloatingShipmentAdvisor (VITE_USE_CONCIERGE variant switch)"]
    FSA --> ARV["AssistantResult — consumes typed union"]
    WP --> WF[WorkflowForm]
    WP --> RP["ReviewPanel (HITL)"]
    WP --> WR[WorkflowResult]
    SP --> SSIM["SaveSignInModal (auth-on-save)"]
```

---

## The typed assistant contract

**Figure 3 — types render; the prose parser is bypassed.**

```mermaid
sequenceDiagram
    participant U as User
    participant C as Copilot component
    participant A as API /assistant
    participant R as AssistantResult
    U->>C: "compare the two cheapest"
    C->>A: POST (draft context + signed state)
    A-->>C: typed AssistantResponse (ASSISTANT_CONTRACT_V1)
    C->>R: result union
    alt result = comparison
        R-->>U: comparison card
    else shipping_option
        R-->>U: option card
    else missing_info
        R-->>U: targeted question card
    else policy_answer
        R-->>U: cited policy card
    end
    Note over C: parseAssistantSections (legacy prose path) NOT invoked — strangler fallback only
```

**Figure 4 — the render-path decision (the strangler in one diagram).**

```mermaid
flowchart LR
    R[response arrives] --> Q{"typed contract present?"}
    Q -->|yes| T["AssistantResult renders the discriminated union — one card per variant"]
    Q -->|no| P["legacy parseAssistantSections prose path (flagged-off fallback, being retired)"]
    T --> DONE[UI]
    P --> DONE
```

`lib/typed-outputs.ts` mirrors the API's Pydantic models **field-for-field**
and is **parity-tested in CI** by ShipSmart-Test — a rename on either side
fails the build, not a user session.

---

## Safe, undoable form mutation

**Figure 5 — auto / confirm / never, with snapshot Undo.** A price the model
*typed* is never authoritative without a quote reference; Undo can only ever
reverse the assistant, never the user.

```mermaid
sequenceDiagram
    participant AI as AssistantResponse
    participant T as ai-trust
    participant ST as ShipmentDraft store
    participant U as User
    AI->>T: FormPatch + confidence + risk
    alt auto-apply
        T->>ST: APPLY_PATCH (previousDraft snapshot taken)
        ST-->>U: patch summary + Undo affordance
    else needs confirmation
        T-->>U: confirm dialog
        U->>ST: approve -> APPLY_PATCH (snapshot)
    else never apply
        T-->>U: advisory only — no mutation
    end
    U->>ST: undoLastPatch()
    ST->>ST: UNDO_PATCH -> restore previousDraft
    Note over ST: manual edit invalidates snapshot -> canUndo=false
```

---

## Streaming & perceived speed

**Figure 6 — three layers stack: instant local answer → progressive deltas →
typed envelope.** Transport failures degrade to `onError`; the client never
throws.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Copilot
    participant L as tryBuildLocalAnswer
    participant S as streamAssistant
    participant A as API /assistant/stream
    U->>C: question
    C->>L: try local answer from loaded grid data
    alt answerable locally
        L-->>U: instant answer (0 network)
    else needs the model
        C->>S: streamAssistant(handlers)
        S->>A: fetch (ReadableStream)
        loop frames
            A-->>S: data: {"delta": ...}
            S->>S: parseSseBuffer -> complete frames + rest
            S-->>U: onDelta progressive render
        end
        A-->>S: data: {"done": true, "assistant": {...}}
        S-->>C: onDone typed envelope -> swap in cards
    end
```

---

## State management

**Figure 7 — the draft store lifecycle (state machine).**

```mermaid
stateDiagram-v2
    [*] --> Draft: user fills form / chat extracts
    Draft --> Draft: field update (provenance from-chat tracked)
    Draft --> Patched: APPLY_PATCH (previousDraft snapshot)
    Patched --> Draft: UNDO_PATCH (restore snapshot)
    Patched --> Draft: manual edit (snapshot invalidated, canUndo=false)
    Draft --> Conflict: chat value != form value
    Conflict --> Draft: user resolves (never silent clobber)
```

**Figure 8 — auth exactly when needed.**

```mermaid
sequenceDiagram
    participant U as User
    participant B as Bookmark/save
    participant M as SaveSignInModal
    participant SB as Supabase
    U->>B: save option
    alt session exists
        B->>SB: persist (bearer)
    else no session
        B->>M: open modal
        U->>M: sign in
        M->>SB: auth
        SB-->>B: session -> save proceeds
    end
```

---

## Module design (LLD)

**Figure 9 — the `lib/` seams.** `typed-outputs` is the single source the
other seams import — and the file the cross-repo parity test locks against the
API.

```mermaid
classDiagram
    class http {
        +request(path, init)
        -mint X-Request-Id + traceparent
        -attach Supabase bearer
        -parse RFC-7807 ProblemDetail
        +friendlyAdvisorError(code)
    }
    class typedOutputs {
        <<types>>
        AssistantResponse
        ResultUnion: shipping_option | comparison | missing_info | policy_answer
        FormPatch
        GridAction
    }
    class aiTrust {
        +responseNeedsConfirmation(resp) bool
    }
    class gridActions {
        <<pure>>
        +reduce(state, GridAction) state
    }
    class assistantStream {
        +streamAssistant(req, handlers)
        +parseSseBuffer(buffer) events_rest
    }
    http <.. assistantStream
    typedOutputs <.. aiTrust
    typedOutputs <.. gridActions
    typedOutputs <.. assistantStream
```

---

## Performance, safety & degradation

**Perceived-speed budget (target):**

| Milestone | Budget *(target)* |
|---|---|
| Local answer (grid data) | < 50 ms |
| First streamed token | < 1 s |
| Typed envelope (done) | < 3 s |
| Route TTI (warm) | < 2 s |

```mermaid
xychart-beta
    title "Perceived-speed budget in ms (target)"
    x-axis ["local-answer", "first-token", "typed-done", "route-TTI"]
    y-axis "ms (target)" 0 --> 3000
    bar [50, 1000, 3000, 2000]
```

*Honest caveat (fact):* Render free tier cold-starts the backend ~30–60 s on
first hit; the UI communicates rather than hides it. Vendor code is split into
long-lived chunks (`react-vendor` / `supabase` / `query`).

**Safety & hygiene (facts):** `strict` TS + `noUnusedLocals`/`Parameters`;
**0** `as any` · **0** `dangerouslySetInnerHTML` · **0** `eval`
(grep-verified); ESLint 9 flat config.

| Threat | Control |
|---|---|
| Malicious model output → DOM | typed rendering; zero `innerHTML`/`eval` |
| Silent form manipulation | apply-policy + confirm + undo + provenance |
| Fabricated price display | prices render from grid/quote data, not prose |
| Token mishandling | single auth-aware `http` wrapper |

**Degradation matrix (coded behaviors):**

| Condition | Behavior |
|---|---|
| `VITE_USE_CONCIERGE` off | advisor variant renders; concierge surface absent |
| `VITE_USE_WORKFLOW` off | workflow page/feature hidden |
| Java cutover flags off | legacy quote/saved/booking paths used (strangler) |
| SSE transport failure | `onError` fallback — non-streamed answer path |
| Typed contract absent | legacy prose parser fallback |

---

## Deployment topology

**Figure 10 — production layout.** 12 `VITE_*` flags make every integration a
dial: capability rollout, strangler cutovers, market scope.

```mermaid
flowchart LR
    U[Browser] --> W["Render static hosting: shipsmart-web"]
    W -->|"VITE_PYTHON_API_BASE_URL"| A["shipsmart-api-python"]
    W -->|"VITE_JAVA_API_BASE_URL"| J["shipsmart (Java)"]
    W --> SB["Supabase (auth)"]
    W --> EF["Supabase edge functions"]
```

---

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
