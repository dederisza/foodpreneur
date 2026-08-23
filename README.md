# Foodpreneur

Foodpreneur is a business management application designed for UMKM/food businesses. The application transforms daily business data into understandable financial conditions, business intelligence findings, prioritized guidance, and practical next actions.

## Core Value

Raw business data

→ Financial and operational facts

→ Intelligence Engine

→ Structured findings

→ AI Synthesis

→ START Action Plan

→ Reports and business guidance

## Final Development Status

**CONTEST-READY BASELINE VERIFIED**

| Phase | Status | Focus |
|---|---|---|
| Phase 1 | LOCKED | Foundation + Database + Business Context |
| Phase 2 | LOCKED | Product + Ingredient + Recipe + HPP + Pricing |
| Phase 3 | LOCKED | Daily Business Activity |
| Phase 4 | LOCKED | Intelligence Engine |
| Phase 5 | LOCKED | AI Synthesis + START |
| Phase 6 | LOCKED | Reports + UX Polish + QA + Contest Demo |

## Main Features

### Business Foundation
- Authentication and protected routes/API
- Multiple businesses
- Active business context
- Business switching
- Server-side ownership validation

### Product and Cost Management
- Ingredients
- Historical ingredient costs
- Products
- Recipes
- HPP calculation
- HPP versioning
- Historical HPP snapshots
- Selling price history

### Daily Business Activity
- Sales
- Multi-item sales
- Historical sale snapshots
- Expenses
- Capital transactions
- Owner drawings
- Unified transaction history
- Financial summary
- Today, week, month, and custom date ranges

### Intelligence Engine
The deterministic intelligence pipeline follows:

`data → metrics → rules → findings`

It analyzes:
- Sales performance
- Profitability
- Expense pressure
- Business activity

Findings can include:
- Critical conditions
- Warnings
- Opportunities
- Positive signals
- Neutral/informational conditions

Comparison handling distinguishes valid comparison data from insufficient historical data and previous periods with no relevant activity.

### AI Synthesis + START
Phase 5 introduces an AI-provider abstraction. The current implementation uses a deterministic `DummyAiProvider`, not a real external AI API.

Pipeline:

`Phase 4 Findings → AI Context → AI Provider → Structured Synthesis → START Action Plan`

START means:
- **S — Situation:** current business condition
- **T — Target:** immediate improvement target
- **A — Action:** practical actions
- **R — Review:** what to evaluate after action
- **T — Track:** metrics to monitor

The abstraction is designed so a future real provider can be integrated without redesigning the business intelligence pipeline.

### Reports
Reports consolidate:
- Revenue
- COGS/HPP
- Gross Profit
- Operating Expenses
- Operating Result
- Capital
- Owner Drawings
- Sales summary
- Intelligence findings
- AI synthesis
- START action plan

Supported periods:
- Today
- This week
- This month
- Custom date range

## Important Business Rules

### Historical Integrity
Historical financial calculations use stored sale snapshots. Past sales must not change because current product prices, recipes, or ingredient costs change.

### HPP
HPP is based on applicable ingredient costs:

`HPP = SUM(quantity × applicable ingredient cost)`

A new HPP version is created when the calculation basis or total changes. Identical recalculation should not create duplicate versions.

### Financial Separation
Revenue, operating expenses, capital, and owner drawings remain logically separate.

`Gross Profit = Revenue - COGS`

`Operating Result = Gross Profit - Operating Expenses`

Capital is not revenue or profit.

Owner drawings are not operating expenses.

### Business Isolation
All major resources are scoped to the active business and protected by server-side ownership validation. Manipulated IDs must not bypass authorization.

## Contest Demo Flow

1. Select or create a business.
2. Show ingredients and historical costs.
3. Show products, recipes, HPP, and pricing.
4. Record sales and daily financial activity.
5. Show financial results.
6. Show deterministic business intelligence findings.
7. Show AI synthesis and START action plan.
8. Show consolidated reports.

The intended story is:

**Business data → business condition → prioritized guidance → practical next action.**

## Current Limitation

The current AI layer uses a deterministic Dummy AI Provider for testing and demonstration.

No external OpenAI, Anthropic, Gemini, or other AI API is currently integrated.

## Running the Project

Use the repository's existing package scripts and environment configuration.

Typical workflow:

1. Install dependencies.
2. Run database migrations if required.
3. Seed demo data if available.
4. Start the development server.

Refer to the actual `package.json`, migration configuration, and environment files in the codebase for the exact commands used by the project.

## Architecture Principle

Future development should preserve:

- Server-side business ownership validation
- Cross-business isolation
- Historical data integrity
- Historical sale snapshots
- Separation of financial categories
- Deterministic intelligence rules
- Phase 4 as the source of business facts
- Phase 5 as a synthesis layer, not a replacement for factual calculations
- Reusable AI provider abstraction
- MVP simplicity over unnecessary infrastructure

## Future Direction

Possible post-contest development includes:
- Real AI API integration
- Configurable AI providers
- Improved reporting and export
- Additional deterministic intelligence rules
- Advanced business planning or forecasting, only when supported by clear requirements and sufficient data
