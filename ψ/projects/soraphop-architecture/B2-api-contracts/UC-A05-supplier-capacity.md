# UC-A05 — ตรวจสอบ Capacity ของล้ง

**Phase**: 1
**Actor(s)**: Admin / System (assignment engine)
**Portal**: admin
**Auth**: session + role `admin.assignment`
**Plugin/Adapter**: `AuditLogger`
**Meeting #1 delta**: none

Read-only view of supplier capacity for an upcoming date range. Default
capacity from `Supplier.defaultDailyCapacity` (3-5 containers/day) merged
with `SupplierCapacityOverride` rows.

## Endpoints

### GET /api/v1/admin/suppliers/:id/capacity

```
?dateFrom=2026-05-01&dateTo=2026-05-31
```

```ts
const CapacityDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultCapacity: z.number(),
  overrideCapacity: z.number().nullable(),
  effectiveCapacity: z.number(),
  // assigned containers for that day, derived from Container rows scheduled
  assignedCount: z.number(),
  remaining: z.number(),
});

const CapacityResponse = z.object({
  data: z.object({
    supplierId: z.string().cuid(),
    code: z.string(),
    legalName: z.string(),
    days: z.array(CapacityDay),
  }),
});
```

### GET /api/v1/admin/capacity/overview

Cross-supplier view for assignment screen.

```
?date=2026-05-15
```

```ts
const CapacityOverviewResponse = z.object({
  data: z.object({
    date: z.string(),
    suppliers: z.array(z.object({
      supplierId: z.string().cuid(),
      code: z.string(),
      legalName: z.string(),
      isInternalSoraphop: z.boolean(),
      effectiveCapacity: z.number(),
      assignedCount: z.number(),
      remaining: z.number(),
    })),
  }),
});
```

### POST /api/v1/admin/suppliers/:id/capacity/overrides

```ts
const OverrideBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capacity: z.number().int().min(0).max(50),
  reason: z.string().max(2000).optional(),
});
```

Upsert by `(supplierId, date)`. AuditLog: `event='supplier.capacity.override'`.
