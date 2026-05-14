# Dashboard Redesign — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Prototype:** `.superpowers/brainstorm/44572-1778774738/content/dashboard-full.html`

---

## Overview

Redesign the compliance dashboard (`/dashboard`) from a DORA-only flat layout into a fully modular, multi-framework command centre. The new design communicates Breachr's core USP — compliance-first, cryptographically-audited, European-hosted — at a glance, while scaling cleanly as new frameworks, modules, and AI capabilities are added.

### Design decisions made

| Decision | Choice | Rationale |
|---|---|---|
| Layout structure | CISO Command (hero exposure score + KPI grid + AI panel) | Puts risk story front and centre |
| Framework density | Expandable rows (compact by default, full article table on expand) | Scales to 6 frameworks without vertical overflow |
| Prototype reference | Option B layout + Option C framework density | Approved in brainstorming session |

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR  │  PAGE HEADER (title · tenant · region · scan btn)   │
│           │─────────────────────────────────────────────────────│
│  Nav      │  HERO ROW                                           │
│  links    │  [Exposure Gauge] [KPI Grid 3×2] [AI Engine Panel]  │
│           │─────────────────────────────────────────────────────│
│  Plan     │  COMPLIANCE ROW                                     │
│  meter    │  [Expandable Framework Rows]  [Right Stack:         │
│  tier     │                               Targets / Inventory / │
│  badge    │                               Sensors mini-cards]   │
│           │─────────────────────────────────────────────────────│
│           │  BOTTOM ROW                                         │
│           │  [Recent Findings table]  [Cryptographic Audit]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Section Specs

### 1. Page Header

- Title: "COMPLIANCE DASHBOARD" in all-caps display font
- Subtitle: `{tenantName} · {N} frameworks active · Last scan {X}h ago`
- Right side chips:
  - **Audit trail live** — animated green pulse dot (existing behaviour)
  - **Data residency** — `🇪🇺 EU · Frankfurt` or `🌍 Africa · Cape Town` based on tenant region
  - **Launch Scan** CTA button (existing `LaunchScanButton`)

---

### 2. Hero Row (3-column grid)

**Column 1 — Weighted Exposure Score Gauge**

A circular SVG gauge (80px diameter) displaying the unified score 0–100.

Score calculation (weighted average, extensible):

| Dimension | Weight | Source |
|---|---|---|
| Compliance posture | 35% | Average of all active framework scores |
| Findings severity | 30% | `100 - (criticals×15) - (highs×5) - (mediums×2)`, clamped 0–100 |
| Scan coverage | 20% | `min(100, completedScans × 12 + surfaceCount × 8)` |
| Audit integrity | 15% | % of audit events cryptographically signed |

Colour thresholds: ≥80 green, ≥50 amber, <50 red.

Below the gauge: 4-row breakdown table showing each dimension's contribution.

Adding new dimensions in future: add a row to the weights table in a `EXPOSURE_WEIGHTS` constant. The total is always normalised to 100%.

**Column 2 — KPI Grid (3 columns × 2 rows)**

| Slot | Metric | Accent colour |
|---|---|---|
| 1 | Critical findings open | Red |
| 2 | Total open findings | Amber |
| 3 | Scans (running · complete) | Blue |
| 4 | Audit events (% signed) | Green |
| 5 | Target surfaces (breakdown hint) | Slate |
| 6 | Inventory assets (unreviewed count) | Teal |

Each tile: coloured top accent bar, large number, small sub-label. Existing `MetricCard` component refactored to accept `border` prop.

**Column 3 — AI Engine Panel**

Displays scanning tier, active model, node status, and data residency. Plan-to-tier mapping:

| Plan | Tier | Badge | Scanning quality |
|---|---|---|---|
| `free` | Bronze | 🥉 | Lightweight — `claude-haiku-4-5` class |
| `starter` | Silver | 🥈 | Standard — `claude-sonnet` class |
| `professional` | Gold | 🥇 | Multi-agent — `claude-sonnet-4-6` |
| `enterprise` | Platinum | 💎 | Best models, multi-agent, on-prem option |

Panel sections:
- **AI Engine**: tier icon + tier name + plan label
- **Active Model**: monospace model name chip + "Switch / BYO Model" button (links to Settings → AI tab, which is a future feature; renders as disabled with tooltip on non-Enterprise)
- **Scan Nodes**: row of coloured dots (green = active, grey = available on upgrade). Node count from `tenants.node_count` column (default 1; Enterprise configurable). Inactive nodes show "unlock on Enterprise" tooltip.
- **Data Residency**: flag + region name + compliance badge (GDPR / POPIA). EU default; Africa Cape Town as add-on.
- **Audit Live**: small animated indicator matching header chip.

---

### 3. Compliance Frameworks Section

Reads `tenants.compliance_frameworks` (string array, e.g. `['DORA','PCI-DSS','NIS2']`). Renders one expandable row per active framework. If no frameworks set, shows a "Configure frameworks →" prompt linking to Settings.

**Row header (always visible):**
- Framework name (coloured per framework — see colour map below)
- Score progress bar + % score
- Critical findings count chip (red) or "Compliant" chip (green)
- Expand/collapse chevron

**Row body (visible on expand):**
- Full article/requirement table: Ref · Name · Sub-description · Score bar + % · Status pill
- Shortcut action links specific to that framework (e.g. "Export BaFin Pack" for DORA, "Cardholder scope" for PCI-DSS)

**Framework colour map:**

| Framework | Colour |
|---|---|
| DORA | Blue `#3b82f6` |
| PCI-DSS | Amber `#f59e0b` |
| NIS2 | Green `#22c55e` |
| HIPAA | Purple `#a78bfa` |
| ISO27001 | Teal `#14b8a6` |
| SOC2 | Slate `#64748b` |

**Framework article definitions** live in `lib/frameworks.ts` (new file). Each framework exports: `{ id, name, color, articles: [{ ref, name, desc, weight }] }`. Score calculation per article mirrors existing DORA logic but is framework-agnostic.

**Expand state**: stored in `localStorage` keyed by `fw-expanded-{frameworkId}` so state persists across page refreshes.

---

### 4. Right Panel Stack

Three stacked cards in the right column of the compliance row.

**Targets card:**
- Header: "Target Endpoints" + "View all →" link to `/dashboard/targets`
- Body: grouped by `attack_surfaces.target_type` (web, api, cloud, mobile, other)
- Each row: type icon + name + count + status chips (clean / findings / critical)
- Data: query `attack_surfaces` grouped by `target_type`, joined with `findings` count per surface

**Inventory mini-card:**
- Total asset count, sub-breakdown: Servers / Services / Unreviewed
- Links to `/dashboard/inventory`

**Sensors mini-card:**
- Online count / offline count
- Per-sensor status dot + region label (from `sensors.location`)
- Links to `/dashboard/sensors`

---

### 5. Bottom Row

**Recent Findings table** (left half):
- Columns: Finding title + hash snippet · Severity · CVSS · AI Model + confidence · Framework tag(s)
- Shows 5 most recent findings
- "View all N open →" link

**Cryptographic Audit Trail** (right half):
- Shows 5 most recent `audit_logs` entries
- Each row: timestamp · action badge (colour-coded) · detail snippet · signature hash prefix
- "✓ 100% signed →" or `{N}% signed →` link to `/dashboard/audit`
- Audit entries now include `node_id` and `model_used` in the detail field (populated by scanner)

---

### 6. Sidebar Updates

- **Plan tier badge** added to the bottom plan meter block — shows tier medal emoji + tier name (Bronze/Silver/Gold/Platinum) derived from `plan`
- Existing scan/token meters unchanged
- No other structural sidebar changes

---

## Data Requirements

### New DB columns needed

| Table | Column | Type | Notes |
|---|---|---|---|
| `tenants` | `node_count` | `int2` default 1 | Number of concurrent scan nodes |
| `tenants` | `ai_model_override` | `text` nullable | BYO model name (Enterprise only) |
| `tenants` | `data_region` | `text` default `'eu'` | `'eu'` or `'africa'` |

### New queries on dashboard page

The existing 14-parallel-query block is extended with:
- `targets_by_type`: `attack_surfaces` grouped by `target_type` with findings count per surface
- `sensors`: `sensors` table, online/offline status
- `inventory_summary`: count from `assets` table, unreviewed count (existing)
- Per-framework scores: derived in-page from existing scan/findings data, using `lib/frameworks.ts` definitions

---

## Component Architecture

```
app/dashboard/page.tsx          ← server component, data fetching
  components/dashboard/
    ExposureGauge.tsx           ← SVG gauge + breakdown table
    KpiGrid.tsx                 ← 6-tile KPI grid
    AiEnginePanel.tsx           ← tier + model + nodes + region
    FrameworkAccordion.tsx      ← list of expandable framework rows
      FrameworkRow.tsx          ← single expandable row
    TargetsCard.tsx             ← endpoint type breakdown
    InventoryMiniCard.tsx       ← asset count summary
    SensorsMiniCard.tsx         ← sensor status dots
  lib/
    frameworks.ts               ← framework definitions + score calculators
    exposure-score.ts           ← weighted exposure score engine
```

Existing components (`LaunchScanButton`, `AuditRow` logic) are reused. `MetricCard` in `page.tsx` is extracted to `KpiGrid.tsx`.

`FrameworkRow.tsx` must be a **client component** (`'use client'`) because it reads/writes `localStorage` for expand state. All other new dashboard components are server components or pure presentational components that receive props from `page.tsx`.

---

## Scoring Engine (`lib/exposure-score.ts`)

```ts
export interface ExposureDimension {
  label: string
  weight: number          // 0–1, all weights must sum to 1.0
  score: number           // 0–100
}

export function computeExposureScore(dimensions: ExposureDimension[]): number {
  // normalises weights, then weighted average
}
```

Future dimensions (TLPT coverage, sensor health, inventory classification %) can be added by pushing to the dimensions array passed from `page.tsx`. The total always normalises, so no existing weights need updating.

---

## Plan Tier System (`lib/plans.ts` additions)

```ts
export type ScanTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export const PLAN_TIER: Record<PlanId, ScanTier> = {
  free:         'bronze',
  starter:      'silver',
  professional: 'gold',
  enterprise:   'platinum',
}

export const TIER_CONFIG: Record<ScanTier, {
  label: string
  badge: string
  modelClass: string   // human-readable model family description
  maxNodes: number     // display cap; actual enforcement is in scanner
  byoModel: boolean    // whether Switch/BYO button is enabled
  onPrem: boolean      // whether on-prem hosting option is shown
}> = {
  bronze:   { label: 'Bronze',   badge: '🥉', modelClass: 'Lightweight AI',          maxNodes: 1, byoModel: false, onPrem: false },
  silver:   { label: 'Silver',   badge: '🥈', modelClass: 'Standard AI',              maxNodes: 1, byoModel: false, onPrem: false },
  gold:     { label: 'Gold',     badge: '🥇', modelClass: 'Multi-Agent AI',           maxNodes: 3, byoModel: false, onPrem: false },
  platinum: { label: 'Platinum', badge: '💎', modelClass: 'Best Models · Multi-Agent', maxNodes: 10, byoModel: true, onPrem: true },
}
```

---

## Non-Goals (out of scope for this iteration)

- Actual BYO model / local LLM switching UI (placeholder button only)
- Multi-node scan scheduling UI (node dots are display-only; count comes from DB)
- Africa region provisioning (flag visible but greyed as add-on)
- HIPAA / ISO27001 / SOC2 article definitions (DORA + PCI-DSS + NIS2 shipped first)
- Mobile-responsive layout (desktop-first, same as current)

---

## Migration

One migration file: `add_tenant_node_count_model_override_region.sql`

```sql
alter table tenants
  add column if not exists node_count      smallint not null default 1,
  add column if not exists ai_model_override text,
  add column if not exists data_region     text not null default 'eu';
```

No data backfill required. Existing tenants default to 1 node, no override, EU region.
