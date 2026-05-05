# Compliance Frameworks — Design Spec
**Date:** 2026-05-05
**Status:** Approved

## Overview

Add compliance framework selection to onboarding and auto-generate frozen, in-app compliance reports after each completed scan. Frameworks supported: DORA (EU), PCI DSS, NIS2.

Target markets: EU fintech (banking, insurance, payments) and healthtech. Reports satisfy DORA Art.24/25 TLPT evidence requirements, PCI DSS penetration testing evidence, and NIS2 Art.21 risk measure documentation.

---

## 1. Data Model

### `tenants` table — new column
```sql
compliance_frameworks text[] DEFAULT '{}'
```
Stores the frameworks selected during onboarding, e.g. `'{dora,pci_dss,nis2}'`. Empty array means no frameworks selected (users who onboarded before this feature).

### `compliance_reports` table — new columns
```sql
scan_id        uuid REFERENCES scans(id)
findings_snapshot jsonb   -- frozen array of findings with controls tagged
framework_summary jsonb   -- { critical: N, high: N, medium: N, low: N }
```

**Row structure:** one row per framework per completed scan. A tenant with DORA + PCI DSS + NIS2 gets 3 report rows per scan.

Existing columns retained: `id`, `tenant_id`, `framework`, `title`, `status`, `created_at`, `report_url` (reserved for future PDF generation).

---

## 2. Industry → Framework Pre-selection

Pre-selected during onboarding based on industry. User can override any selection.

| Industry   | DORA | PCI DSS | NIS2 |
|------------|------|---------|------|
| Banking    | ✅   | ✅      | ✅   |
| Insurance  | ✅   | —       | ✅   |
| Payments   | ✅   | ✅      | ✅   |
| HealthTech | —    | —       | ✅   |
| Energy     | —    | —       | ✅   |
| Other      | —    | —       | —    |

**Rationale:**
- DORA: mandatory for EU financial entities (banking, insurance, payments)
- PCI DSS: mandatory for orgs processing card payments
- NIS2: covers financial infrastructure and healthcare as essential sectors

---

## 3. Onboarding Change

The existing 3-step flow (company details → target URLs → you're all set) becomes 4 steps. A new **Step 3** is inserted between target URLs and the confirmation screen.

**Step 3: "SELECT COMPLIANCE FRAMEWORKS"**
- Subtitle: "We've recommended frameworks based on your industry. Adjust as needed."
- Three checkbox cards, one per framework:
  - **DORA** — "EU Digital Operational Resilience Act. Mandatory for financial entities operating in the EU."
  - **PCI DSS** — "Payment Card Industry Data Security Standard. Required if you process, store or transmit card data."
  - **NIS2** — "EU Network and Information Security Directive. Applies to essential and important entities across sectors."
- Pre-checked per the industry mapping table above
- At least zero frameworks allowed (user can deselect all)
- On submit: `UPDATE tenants SET compliance_frameworks = $1 WHERE id = $2`
- "You're all set" becomes Step 4 (dot indicator updates to 4 dots)

---

## 4. OWASP → Framework Control Mapping

New file: `scanner/engine/frameworks.py`

Hardcoded mapping from OWASP Top 10 2021 category → controls per framework. Used at report generation time.

**Matching logic:** Claude returns `owasp_category` as a full string e.g. `"A05:2021 – Security Misconfiguration"`. The mapper extracts the two-character prefix (`A05`) using a regex and looks it up in the table. Unrecognised prefixes fall through to the fallback row.

| OWASP Category | DORA | PCI DSS | NIS2 |
|---|---|---|---|
| A01 Broken Access Control | Art.9 | Req 7, Req 8 | Art.21(i), Art.21(j) |
| A02 Cryptographic Failures | Art.9 | Req 3, Req 4 | Art.21(h) |
| A03 Injection | Art.9 | Req 6 | Art.21(e) |
| A04 Insecure Design | Art.9 | Req 6 | Art.21(e) |
| A05 Security Misconfiguration | Art.9 | Req 2 | Art.21(a) |
| A06 Vulnerable Components | Art.28 | Req 6 | Art.21(d) |
| A07 Auth Failures | Art.9 | Req 8 | Art.21(i), Art.21(j) |
| A08 Data Integrity Failures | Art.9 | Req 6 | Art.21(d) |
| A09 Logging/Monitoring Failures | Art.13 | Req 10 | Art.21(b) |
| A10 SSRF | Art.9 | Req 6 | Art.21(e) |
| Missing security headers / TLS | Art.9 | Req 4, Req 6 | Art.21(h) |
| *(fallback — any unrecognised)* | Art.9 | Req 6 | Art.21(a) |

---

## 5. Report Generation (Scanner)

**Trigger:** immediately after `scans.status` is set to `'complete'` in `scanner.py`.

**Steps:**
1. Fetch `tenants.compliance_frameworks` for this scan's `tenant_id`
2. If empty, skip — no reports generated
3. Fetch all findings for this `scan_id` from the `findings` table
4. For each framework in `compliance_frameworks`:
   a. Map each finding's `owasp_category` → controls for this framework via `frameworks.py`
   b. Build `findings_snapshot`: array of finding objects (title, severity, owasp_category, description, remediation, controls)
   c. Build `framework_summary`: `{ critical, high, medium, low }` counts
   d. Derive `title`: e.g. `"DORA Report — Breachr Website — 05 May 2026"`
   e. Derive `status`: `"gaps_found"` if any critical/high findings, otherwise `"passed"`
   f. Insert one row into `compliance_reports`
5. Log count of reports generated

**Error handling:** wrap in try/except — a report generation failure must not cause the scan itself to fail. Log the error, continue.

---

## 6. Reports Page (`/dashboard/reports`)

Replaces the current page which showed an empty state or a basic table.

**List view:**
Each row shows:
- Target name + URL (joined from findings_snapshot or scan → attack_surface)
- Framework badge: `DORA` / `PCI DSS` / `NIS2` (coloured pill)
- Severity summary: `2 critical · 3 high · 1 medium · 0 low`
- Status indicator: `GAPS FOUND` (red, any critical/high) or `PASSED` (green)
- Scan date
- "View Report" button → `/dashboard/reports/[id]`

The existing `report_url` download button is preserved but hidden until populated (reserved for future PDF feature).

---

## 7. Report Detail Page (`/dashboard/reports/[id]`)

New page. Read-only — snapshot data, no editing.

**Sections:**

**Header:**
- Target name + URL
- Framework name (full: "Digital Operational Resilience Act (DORA)")
- Scan date
- Overall risk: highest severity finding (CRITICAL / HIGH / MEDIUM / LOW / PASSED)

**Summary card:**
- Counts by severity (critical / high / medium / low)
- Compliance status: `GAPS FOUND — Immediate action required` or `PASSED — No critical or high severity gaps identified`

**Findings table:**
- Columns: Severity badge | Title | OWASP Category | Framework Controls | Description
- Sorted: critical → high → medium → low
- Read-only — no status editing (this is a frozen snapshot)
- Empty state: "No findings — all probes passed"

---

## 8. Security & DORA Cryptographic Compliance

### Encryption at rest
Supabase enforces AES-256 disk-level encryption on all data including `compliance_reports` and `findings_snapshot`. This satisfies DORA Art.9(4)(c)'s "where appropriate" cryptographic requirement for internal operational data. Application-layer field-level encryption on `findings_snapshot` is explicitly **not** used: it would require storing the decryption key in the same infrastructure (no meaningful security gain), breaks jsonb queryability, and adds operational complexity disproportionate to the risk. This decision is documented here as the auditable rationale for regulators.

### Encryption in transit
Supabase enforces TLS 1.2/1.3 on all connections. No plaintext access is possible.

### Access control (Row-Level Security)
An explicit RLS policy must be applied to `compliance_reports`:
```sql
CREATE POLICY "tenant_isolation" ON compliance_reports
  FOR ALL USING (tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
```
Without this, any authenticated user can query any tenant's reports. This is a security requirement, not optional.

### Audit logging
DORA requires evidence of who accessed what and when. Every view of a report detail page must write an entry to the audit log (table: `audit_log` or equivalent — confirm existing schema). Log entry: `{ action: 'report.viewed', resource_id: report_id, user_id, tenant_id, timestamp }`.

### Data retention
DORA Art.9 requires ICT-related records to be retained for a defined period (minimum 5 years for EU financial entities). Compliance reports must **not** be deletable by users through the UI. They are immutable records.

**GDPR conflict:** DORA retention vs. GDPR right to erasure. Resolution: on a GDPR erasure request, pseudonymise the `findings_snapshot` by stripping any PII fields (user identifiers, email addresses if present), but retain the compliance record structure and severity counts. The report record itself is kept; only PII within it is erased. This is handled in Sub-project B (Settings / GDPR right to be forgotten).

---

## 9. What's Not In Scope (v1)

- PDF report download (reserved — `report_url` column kept for this)
- Editing framework selection post-onboarding (deferred to Settings section, Sub-project B)
- Per-control pass/fail attestation (manual compliance checkbox tracking)
- Scheduled or recurring report generation
- Email delivery of reports

---

## Files Changed

**Portal:**
- `app/dashboard/onboarding/page.tsx` — add Step 3 (framework selection), update step count to 4
- `app/dashboard/reports/page.tsx` — updated list view
- `app/dashboard/reports/[id]/page.tsx` — new report detail page

**Scanner:**
- `engine/frameworks.py` — new file: OWASP → framework control mapping
- `engine/scanner.py` — report generation after scan completion

**Database (SQL migrations):**
- Add `compliance_frameworks text[]` to `tenants`
- Add `scan_id`, `findings_snapshot`, `framework_summary` to `compliance_reports`
- Add RLS policy `tenant_isolation` on `compliance_reports`
