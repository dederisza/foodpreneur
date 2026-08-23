# Foodpreneur BI — Project Context

This document is a fast-orientation summary of the project: what it is,
what's been built, how it's built, and the rules that must never be
broken by future work. `README.md` is the detailed, phase-by-phase
build-and-verification log (1300+ lines); this file is the short version
to read first — start here, then go to `README.md` for the specifics of
any one phase.

---

## 1. What This Is

An AI-powered Business Intelligence and Growth System for young
foodpreneurs and small food businesses (street food, fast food, small
cafés) in Indonesia. The goal: take a business owner from "I have data
but don't understand my business" to "I know what's happening, why, and
what to do next."

**The one architectural rule that governs everything else:**

```
Database → Deterministic Business Engines → Metrics → Diagnostics
→ Health Score → Priority Engine → Canonical Structured Context
→ AI Synthesis → Insight & Action Plan
```

AI (when it eventually appears, in Phase 5+) sits at the very end, as an
interpreter of facts the deterministic layers below it have already
computed. AI is never the calculation engine, never a source of facts,
and nothing built so far (Phases 1-4) contains any AI at all — Phase 4's
"Intelligence Engine" is a plain rules engine, explicitly not AI.

## 2. Current Status

| Phase | Status | Scope |
|---|---|---|
| 1 | ✅ Locked | Foundation, auth, business ownership, database architecture |
| 2 | ✅ Locked | Ingredients, products, recipes, HPP engine, selling price history |
| 3 | ✅ Locked | Sales (with historical snapshots), expenses, capital, owner drawings, financial summary, unified transaction history |
| 4 | ✅ Locked | Deterministic rule-based Business Intelligence engine |
| 5 | ⬜ Not started | AI Synthesis + START (business planning for pre-launch founders) |
| 6 | ⬜ Not started | Reports + UX polish + QA + demo |

Each phase went through an explicit build → verify → fix → re-verify
cycle before being locked, including live `curl`-based smoke testing
(not just static code review) and, for phases with security
implications, live multi-account cross-business attack testing. See
`README.md` for the specific verification logs.

**Do not begin Phase 5 or redesign any locked phase without explicit
instruction** — this mirrors the Master Development Prompt's own
phase-discipline rule, which this project has followed throughout.

## 3. Technology Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript | Single deployable app, server components + API routes |
| Database | SQLite via Node's built-in `node:sqlite` | Zero native compilation, zero external services — see below |
| ORM | Drizzle ORM (`sqlite-proxy` driver) | Type-safe, plain-SQL migrations |
| Auth | Custom: bcrypt + `jose`-signed JWT + DB-backed sessions | No third-party auth platform was in place; DB-backed sessions make logout real (a stateless JWT can't be revoked) |
| Validation | Zod | Every API route validates its body |
| Styling | Tailwind CSS v4 | |

**Why not Prisma or `better-sqlite3`?** Both were tried and abandoned
after concrete, reproduced failures during Phase 1: Prisma's engine
binaries download from a domain outside this environment's network
allowlist; `better-sqlite3` reproducibly fails `npm ci`/`npm install`
once a lockfile exists, because npm forces a native rebuild regardless
of the package's own `"gypfile": false` setting, and that rebuild needs
Node headers from a domain also outside the allowlist. `node:sqlite`
(stable since Node 22) has no native compilation step at all, which is
what makes it work reliably in a sandboxed build environment — and
plausibly in any other restricted/offline environment this project gets
exported to. Full details in `README.md`'s Phase 1 verification section.

## 4. Directory Map

```
src/
  app/
    (public)         page.tsx, login/, register/, onboarding/, start/
    app/             protected shell — layout.tsx enforces auth + active business
      dashboard/ ingredients/ products/ products/[id]/
      sales/ sales/new/ sales/[id]/ expenses/ capital/ owner-drawings/
      transactions/  activity/ (financial summary)  analysis/ (business intelligence)
      diagnostics/ health/ actions/ strategy/ goals/ reports/ settings/
                     — these six are still Phase 5/6 placeholders
    api/             one route folder per resource, mirrors the app/ tree
  components/
    ui/              Button, Input, Card — generic primitives
    layout/          Sidebar, Topbar, ComingSoon
    auth/ business/  Phase 1 forms
    catalog/         Phase 2 — ingredients, products, recipe/HPP UI
    finance/         Phase 3 — sales, expenses, capital, drawings, summary, transaction history
    intelligence/    Phase 4 — Business Intelligence findings view
  modules/           ALL business logic lives here, never in components or routes
    auth/            registration, credential verification, session management
    business/        business CRUD + getOwnedBusinessOrThrow (THE ownership pattern)
    catalog/         ingredients, products, recipes (Phase 2)
    costing/         deterministic HPP engine + version snapshotting (Phase 2)
    pricing/         selling price history (Phase 2)
    sales/           sale creation with mandatory snapshotting (Phase 3)
    finance/         expenses, capital, drawings, financial summary,
                      date ranges, unified transaction history (Phase 3)
    intelligence/    metrics → rules → engine, the Phase 4 rules engine
  lib/
    context.ts       requireAppContext / requireBusinessContext — page-side auth+business resolution
    apiContext.ts    requireActiveBusinessForApi — same idea, for API routes
  db/
    schema.ts        full Drizzle schema, heavily commented per table
    client.ts        node:sqlite + drizzle client singleton
    migrate.ts / seed.ts
    migrations/      0000 (Phase 1), 0001 (Phase 2), 0002 (Phase 3) — Phase 4 added no schema
```

## 5. Database Schema Summary

- **Phase 1:** `users`, `businesses`, `sessions`
- **Phase 2:** `ingredients`, `ingredient_cost_history`, `products`, `product_recipes`, `product_cost_versions`, `selling_price_history`
- **Phase 3:** `sales`, `sale_items`, `expenses`, `capital_transactions`, `owner_drawings`
- **Phase 4:** none — findings are computed on-demand, never persisted (deliberate; see `modules/intelligence/types.ts`)

Every table has a direct or indirect `business_id` scope. Migrations are
additive only — each phase's migration was verified to apply cleanly on
top of the real, previously-seeded database from the prior phase, with
zero data loss (not just reviewed as SQL, actually executed and checked).

## 6. Non-Negotiable Business Rules

These rules span every phase and must be preserved by any future work:

1. **Historical integrity, everywhere.** Ingredient costs, HPP versions,
   selling prices, and sale line-item snapshots are all append-only —
   nothing overwrites a past record. A sale's `sellingPriceSnapshot` and
   `hppSnapshot` freeze the applicable price/HPP *as of the sale's
   transaction date*, and remain correct forever after, regardless of
   later price/recipe/ingredient-cost changes. Verified live, repeatedly,
   across every phase.
2. **Ownership is enforced server-side, always, via a throws-not-null
   pattern.** `getOwnedBusinessOrThrow` (Phase 1) is the template every
   subsequent ownership check follows (`getOwnedIngredientOrThrow`,
   `getOwnedProductOrThrow`, `getOwnedSaleOrThrow`, etc.) — "doesn't
   exist" and "exists but isn't yours" must look identical to the
   caller, and every page/API route resolves the business through
   `requireBusinessContext()` / `requireActiveBusinessForApi()`, never
   trusting a client-supplied business ID.
3. **Capital and Owner Drawings are never revenue or operating
   expenses.** They're always displayed and summed separately from
   Revenue/COGS/Gross Profit/Operating Expenses/Operating Result.
4. **Sales are voided, never edited or deleted**, once finalized — this
   is what keeps historical financial reporting trustworthy.
5. **No AI, anywhere, in Phases 1-4.** Phase 4's "Intelligence Engine" is
   pure `data → metrics → rules → findings`, with every finding
   traceable to an actual number.
6. **Recipe quantities use the ingredient's own base unit** — there is
   no unit-conversion engine (deliberate simplification, Phase 2).
7. **Every finding, HPP calculation, and financial figure must be
   explainable** — no black boxes, no "just trust the number."

## 7. Getting Started

```bash
npm install
cp .env.example .env.local   # then set a real SESSION_SECRET (see file)
npm run db:migrate
npm run db:seed              # demo login: demo@foodpreneur.local / demo12345
npm run dev
```

`npm run build`, `npx tsc --noEmit`, and `npm run lint` should all pass
clean from a fresh clone — this has been verified repeatedly throughout
the project, including from a fully clean `node_modules`-deleted state.

## 8. Known Limitations Carried Forward

- Single shared SQLite connection — fine at this MVP's scale (one
  business's own data), would need revisiting for true concurrent-write
  load.
- `node:sqlite` is still Node-flagged "experimental" (functionally
  stable for this project's needs).
- Date-range calculations assume UTC; no per-business timezone concept
  yet.
- Intelligence Engine thresholds (`modules/intelligence/rules.ts`'s
  `THRESHOLDS`) are fixed constants, not yet per-business configurable.
- No automated test suite — every phase's validation has been live
  `curl`/`tsx`-script-based testing against a running dev server,
  documented in `README.md`.

## 9. Next Step

**Phase 5 — AI Synthesis + START** is next, but has not been started.
Do not begin it without explicit instruction. When it does start, the
existing placeholder routes (`diagnostics`, `health`, `actions`,
`strategy`, `goals`, `reports`) and the `/start` public page are where
that work is expected to land, and Phase 4's `IntelligenceReport` /
`Finding` model (in `modules/intelligence/types.ts`) is the "canonical
structured context" the architecture diagram in Section 1 expects an AI
synthesis layer to consume — it was deliberately shaped to be
AI-consumable later, without needing to be redesigned.
