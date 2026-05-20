# Asset Classification Design

**Goal:** Add business classification fields to assets (criticality, type, owner, department, location, notes) with a cryptographically auditable change log, surfaced as a badge on the inventory list and a full edit panel on the asset detail page.

**Architecture:** DB migration adds nullable classification columns to `public.assets` plus an immutable `asset_classification_log` table. A single API route handles updates and writes the audit log atomically. UI: criticality badge + quick popover on inventory list; full classification card on asset detail.

**Frameworks:** DORA Art. 8, ISO 27001 A.5.9/5.10, CIS v8 Control 1, NIST CM-8, SOC 2 CC6.1.

---

## DB Schema

### New columns on `public.assets`
```sql
criticality       text CHECK (criticality IN ('mission_critical','business_essential','business_support','non_essential'))
asset_type_label  text CHECK (asset_type_label IN ('server','workstation','network_device','iot','cloud_service','mobile','other'))
department        text
owner_name        text
owner_email       text
physical_location text
classification_notes text
classified_at     timestamptz
classified_by     uuid REFERENCES public.users(id)
```

### New table: `asset_classification_log`
```sql
id          uuid PK
asset_id    uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE
tenant_id   uuid NOT NULL REFERENCES public.tenants(id)
changed_by  uuid NOT NULL REFERENCES public.users(id)
changed_at  timestamptz NOT NULL DEFAULT now()
field       text NOT NULL
old_value   text
new_value   text
record_hash text NOT NULL  -- SHA-256 of (asset_id|field|old_value|new_value|changed_by|changed_at)
```

RLS: tenant members can SELECT their own tenant's log. Only service role writes.

---

## Criticality Display

| Value | Label | Colour |
|-------|-------|--------|
| `mission_critical` | Mission Critical | Red (#ef4444) |
| `business_essential` | Business Essential | Amber (#f59e0b) |
| `business_support` | Business Support | Blue (#3b82f6) |
| `non_essential` | Non-Essential | Grey (#64748b) |
| null | Unclassified | Grey outline |

---

## API Route

### `PATCH /api/assets/[id]/classify`
- Auth required; role must be `account_owner` or `admin`
- Body: partial object of classification fields
- Validates tenant ownership of asset
- For each changed field: writes row to `asset_classification_log` with SHA-256 hash
- Updates `public.assets` classification columns + `classified_at`, `classified_by`
- Returns updated asset classification fields

---

## UI

### Inventory list (`/dashboard/inventory`)
- New "Classification" column: criticality badge + owner name
- Clicking badge opens an inline `<ClassifyPopover>` with criticality dropdown only (quick triage)
- Saving popover calls `PATCH /api/assets/[id]/classify`

### Asset detail (`/dashboard/inventory/[assetId]`)
- New "Classification" card below existing content
- Read mode: shows all 7 fields with labels; "Edit" button top-right
- Edit mode: inline form for all fields; "Save" / "Cancel"
- On save: calls `PATCH /api/assets/[id]/classify`, shows success toast

---

## Not in scope
- Bulk classification
- Classification required gate (assets can remain unclassified)
- Showing full audit log on asset detail (use `/dashboard/audit`)
