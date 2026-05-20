---
name: Export feature + pagination shipped
description: Background export system and inventory pagination shipped to staging on 2026-05-08
type: project
---

Background data export system is fully implemented and deployed to staging.

**Why:** User requested CSV/XLSX export for Findings, Audit Trail, and Inventory — admin/account_owner only.

**How to apply:** The export flow is complete end-to-end. If touching export-related code, the key files are: `portal/app/api/exports/route.ts`, `portal/app/api/crons/process-exports/route.ts`, `portal/components/ExportButton.tsx`, `portal/components/ExportsTab.tsx`, `portal/lib/email.ts` (sendExportReadyEmail), `portal/app/dashboard/reports/page.tsx`.

Key facts:
- `data_exports` table in Supabase with RLS; Storage bucket `exports` (private)
- Vercel Cron on Hobby plan is daily-only (`0 0 * * *`) — needs Pro for every-minute schedule
- `sendExportReadyEmail` takes `{ to, dataType, format, rowCount, expiresAt, requestedAt, portalUrl }` — note `requestedAt` was added beyond original spec
- Signed URLs generated fresh on GET /api/exports (30-day expiry), never stored in DB
- Inventory pagination added at PAGE_SIZE=50 matching Findings and Audit Trail
