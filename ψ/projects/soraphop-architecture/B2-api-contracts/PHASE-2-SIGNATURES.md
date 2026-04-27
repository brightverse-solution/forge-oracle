# Phase 2 — Endpoint signatures (37 UCs)

> Brief signatures only. Detailed contracts deferred per work-order scoping
> (Week 5+). Schema (`B1-schema-v1.prisma`) already supports every field
> referenced below — Phase 2 ships **without breaking migrations**.

Each row: `[METHOD] path` · auth · 1-line note.

---

## Buyer (4)

| UC | Endpoint(s) | Auth | Note |
|----|-------------|------|------|
| UC-B12 | `POST /api/v1/orders/:id/payments/2/intent` | session + 2FA | Generate bankRef for installment 2 (20% on container close); Idempotency-Key required. Triggered after UC-A07 admin notice. |
| UC-B13 | `POST /api/v1/orders/:id/payments/2` | session + 2FA | Submit installment-2 payment proof (or pre-confirmed via wallet). Same shape as UC-B05 topup-intent but for `Payment(installment=TWO)`. |
| UC-B14 | `POST /api/v1/orders/:id/payments/3` | session + 2FA | Final 30% (net of claim/box). Server-computed `expectedAmount`. |
| UC-B15 | `GET /api/v1/orders/:id/tracking` | session | Tracking timeline merged from `Container.status`, `ShippingProviderAdapter.status`, `Inspection.status`, `Certificate`. |

## Admin (12)

| UC | Endpoint(s) | Auth | Note |
|----|-------------|------|------|
| UC-A03 | `POST /api/v1/admin/payments/:id/verify` (installment=TWO) | session + 2FA | Same handler as UC-A02; `Order.status` advances to PAYMENT_2_VERIFIED. |
| UC-A04 | `POST /api/v1/admin/payments/:id/verify` (installment=THREE) | session + 2FA | Same handler; finalizes order. Triggers UC-A14 supplier release. |
| UC-A07 | `POST /api/v1/admin/orders/:id/payments/2/notify` | session | Sends `payment.installment-2-due` email + realtime to buyer. AuditLog `event='order.payment.notified'`. |
| UC-A08 | `POST /api/v1/admin/containers/:id/authorize-ship` | session + 2FA | Container gate: `SEALED` → ship eligibility unlocks shipping-provider call. |
| UC-A09 | `POST /api/v1/admin/inspections/:id/certificate` | session | Persists Certificate row + signed PDF blob key. Mirrors UC-Q07 outcome. |
| UC-A10 | `POST /api/v1/admin/orders/:id/claim-calc` | session | Reads `ClaimConfig` + `Inspection.damagePercent` → returns proposed deduction breakdown. Pure compute; no mutation. |
| UC-A11 | `POST /api/v1/admin/containers/:id/box-reconcile` | session | Compares `Container.defaultBoxCount` vs `actualBoxCount` (+ QRCode count); produces shortfall summary. |
| UC-A12 | `POST /api/v1/admin/orders/:id/finalize-bill` | session + 2FA | Applies UC-A10 + UC-A11 deductions to supplier bill (UC-A14). Idempotent. |
| UC-A13 | `POST /api/v1/admin/orders/:id/payments/3/notify` | session | Mirrors UC-A07 for installment 3 (post-cert). |
| UC-A14 | `POST /api/v1/admin/suppliers/:id/release-bill` | session + 2FA | Calls `BankAdapter.transfer` to supplier account. Idempotency-Key required. |
| UC-A15 | `POST /api/v1/admin/bank/auto-reconcile/config` | super_admin + 2FA | Toggle/configure auto-reconcile rules (cadence, matching tolerance). |
| UC-A21 | `GET /api/v1/admin/packaging/dispatch-log` | session | Read-only audit of box dispatch + supplier withdrawals. Aggregates `PackagingInventory` deltas. |

## Supplier (12)

| UC | Endpoint(s) | Auth | Note |
|----|-------------|------|------|
| UC-S01 | (reuses UC-B03 `/auth/login`) | session | Supplier portal login — same Auth.js flow; portal routing via `actorType=SUPPLIER`. |
| UC-S02 | `POST /api/v1/supplier/orders/:id/accept` | supplier session | Acknowledge assignment. Order moves PACKING. |
| UC-S03 | `POST /api/v1/supplier/orders/:id/pack-progress` | supplier session | Heartbeat update; emits realtime to admin + buyer. |
| UC-S04 | `POST /api/v1/supplier/containers/:id/qrcodes/generate` | supplier session | Bulk-generate `QRCode` rows (up to 960). Idempotent on `(containerId, sequenceNo)`. |
| UC-S05 | `POST /api/v1/supplier/containers/:id/seal` | supplier session + 2FA | Closes container with `actualBoxCount` + container#. Triggers UC-A07 (Phase 2 chain). |
| UC-S06 | `POST /api/v1/supplier/containers/:id/ship` | supplier session | Marks IN_TRANSIT. `ShippingProviderAdapter.createShipment()` called. |
| UC-S07 | `POST /api/v1/supplier/orders/:id/bills` | supplier session | Submit invoice for admin release (UC-A14). |
| UC-S08 | `GET /api/v1/supplier/payments` | supplier session | List inbound payments from Soraphop (filtered by `BankAdapter.transfer` audit refs). |
| UC-S09 | `GET /api/v1/supplier/orders` | supplier session | List + filter own orders by status. |
| UC-S10 | `GET /api/v1/supplier/dashboard` | supplier session | Same shape as UC-A19 but scoped to own data. |
| UC-S11 | `PATCH /api/v1/supplier/me` | supplier session | Update contact info, address. |
| UC-S12 | `POST /api/v1/supplier/packaging-inventory/:id/withdraw` | supplier session | Decrement `quantityOnHand`. Triggers low-stock alert (Meeting #1 #7). |

## QC / Logistics (7)

| UC | Endpoint(s) | Auth | Note |
|----|-------------|------|------|
| UC-Q01 | (reuses UC-B03) | session | QC portal login. |
| UC-Q02 | `GET /api/v1/qc/incoming` | qc session | Containers expected at destination. Joins shipping-provider tracking. |
| UC-Q03 | `POST /api/v1/qc/containers/:id/open` | qc session | Marks AT_DESTINATION + creates `Inspection(status=IN_PROGRESS)`. |
| UC-Q04 | `POST /api/v1/qc/inspections/:id/result` | qc session + 2FA | Records `damagePercent`, status (PASSED/PASSED_WITH_CLAIM/FAILED). |
| UC-Q05 | `POST /api/v1/qc/inspections/:id/photos` | qc session | Append blob keys to `Inspection.photoBlobKeys`. Pre-signed via UC-B02-style upload-url. |
| UC-Q06 | `POST /api/v1/qc/inspections/:id/temperature` | qc session | Append a temperature point to `Inspection.temperatureLog`. |
| UC-Q07 | `POST /api/v1/qc/inspections/:id/issue-certificate` | qc session + 2FA | Generates Certificate + (optionally) creates `Claim` rows. Triggers UC-A09 confirmation + UC-A13 buyer notice. |

## System (2)

| UC | Endpoint(s) | Auth | Note |
|----|-------------|------|------|
| UC-X02 | `POST /api/v1/system/bank/transfer` | system token | `BankAdapter.transfer()` outbound. Used by UC-A14. Idempotency-Key required. AuditLog severity=CRITICAL. |
| UC-X03 | `POST /api/v1/system/accounting/sync` | system token | `AccountingAdapter.postEntries()` to FlowAccount. Splits ledger by product category (DURIAN/COCONUT). Hourly worker. |

---

## Notes

- All Phase-2 UCs route through the same `requires2FA` + `Idempotency-Key`
  middleware as Phase-1 financial actions. No new cross-cutting infra needed.
- `BankAdapter`, `AccountingAdapter`, `ShippingProviderAdapter` ship as
  `Mock*` in dev/staging until LENS finishes Week 1 research and Palm picks
  the production concrete (see open-items OI-01 through OI-05).
- Phase-2 UC numbering preserves SRS v3.6 IDs. Meeting #1's *new* UC
  candidates (`UC-A2x`, `UC-X0x`) are deferred to SRS rewrite per
  decisions-2026-04-27 §7.2.
