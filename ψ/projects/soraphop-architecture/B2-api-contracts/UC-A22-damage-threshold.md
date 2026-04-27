# UC-A22 — กำหนดเกณฑ์ % ความเสียหาย

**Phase**: 1 (config only)
**Actor(s)**: Admin (`admin.claim_config`)
**Portal**: admin
**Auth**: session
**Plugin/Adapter**: `AuditLogger`
**Meeting #1 delta**: none

Phase-1 ships the *config*; Phase-2 (UC-A10) executes the deduction logic.
The threshold is global by default but configurable per-supplier so
"premium" suppliers can negotiate tighter tolerance.

> Schema note: stored in a `ClaimConfig` table not yet present in B1 v1
> because SRS §5 doesn't list it among the 14 base entities. **FORGE flag
> for QB**: add `ClaimConfig(id, scope:[GLOBAL|SUPPLIER], supplierId?,
> damagePercentThreshold, boxUnitValue, currency, createdAt, updatedAt)`
> before Week 1 close. Tracked in ready-notification.

## Endpoints

### GET /api/v1/admin/claim-configs

```ts
const ClaimConfigRow = z.object({
  configId: z.string().cuid(),
  scope: z.enum(['GLOBAL','SUPPLIER']),
  supplierId: z.string().cuid().nullable(),
  damagePercentThreshold: z.number().min(0).max(100),
  boxUnitValue: z.number().nonnegative(),
  currency: z.string(),
  updatedAt: z.string().datetime(),
});

const ClaimConfigListResponse = z.object({
  data: z.object({ items: z.array(ClaimConfigRow) }),
});
```

### POST /api/v1/admin/claim-configs

```ts
const ClaimConfigBody = z.object({
  scope: z.enum(['GLOBAL','SUPPLIER']),
  supplierId: z.string().cuid().optional(), // required when scope=SUPPLIER
  damagePercentThreshold: z.number().min(0).max(100).default(5),
  boxUnitValue: z.number().nonnegative().default(0),  // UC-A23 lives here too
  currency: z.literal('THB').default('THB'),
});
```

Upsert by (scope, supplierId). AuditLog: `event='claim_config.set'`.

**Errors**:
| Status | code | When |
|--------|------|------|
| 422 | `claim_config.supplier_required` | scope=SUPPLIER without supplierId |
| 409 | `claim_config.global_exists` | scope=GLOBAL when global already exists (use PATCH) |
