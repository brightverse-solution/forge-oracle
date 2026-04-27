# UC-A19 — Dashboard และรายงานภาพรวม

**Phase**: 1
**Actor(s)**: Admin, Super Admin (read scope differs)
**Portal**: admin
**Auth**: session + role `admin.dashboard`
**Plugin/Adapter**: `AuditLogger` (read), `AccountingAdapter` (Phase 2 reconcile read-through)
**Meeting #1 delta**: none

Read-only aggregations. Heavy queries cached at the gateway (Redis, TTL 60s)
keyed by (user, params). Cache invalidated by audit-log topic subscriber for
relevant events.

## Endpoints

### GET /api/v1/admin/dashboard/overview

```
?dateFrom=2026-04-01&dateTo=2026-04-30
```

```ts
const DashboardOverviewResponse = z.object({
  data: z.object({
    period: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }),
    orders: z.object({
      total: z.number(),
      byStatus: z.record(z.string(), z.number()),
      revenue: z.number(),       // sum of confirmed quotation totals
      currency: z.literal('THB'),
    }),
    payments: z.object({
      total: z.number(),
      byInstallment: z.object({ ONE: z.number(), TWO: z.number(), THREE: z.number() }),
      byStatus: z.record(z.string(), z.number()),
      verifiedAmount: z.number(),
    }),
    suppliers: z.object({
      total: z.number(),
      active: z.number(),
      capacityUtilization: z.number(), // 0..1
    }),
    inspections: z.object({
      total: z.number(),
      passed: z.number(),
      withClaims: z.number(),
      avgDamagePercent: z.number(),
    }).optional(), // Phase 2 only
    packaging: z.object({
      typesBelowThreshold: z.number(), // alert count
    }),
  }),
});
```

### GET /api/v1/admin/dashboard/orders/timeseries

```
?dateFrom=...&dateTo=...&granularity=day&metric=count|revenue
```

```ts
const TimeseriesResponse = z.object({
  data: z.object({
    granularity: z.enum(['hour','day','week','month']),
    metric: z.enum(['count','revenue']),
    points: z.array(z.object({ at: z.string().datetime(), value: z.number() })),
  }),
});
```

### GET /api/v1/admin/dashboard/audit

Audit-log search with filters. Read-only window into `AuditLog`.

```
?event=order.assigned&actorId=...&dateFrom=...&page=1
```

```ts
const AuditSearchResponse = z.object({
  data: z.object({
    items: z.array(z.object({
      id: z.string().cuid(),
      occurredAt: z.string().datetime(),
      severity: z.enum(['INFO','NOTICE','WARNING','CRITICAL']),
      event: z.string(),
      actorId: z.string().cuid().nullable(),
      targetType: z.string().nullable(),
      targetId: z.string().nullable(),
    })),
    total: z.number(),
    page: z.number(),
  }),
});
```
