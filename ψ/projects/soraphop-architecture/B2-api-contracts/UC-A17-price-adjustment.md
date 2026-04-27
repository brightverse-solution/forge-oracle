# UC-A17 — ปรับราคาตามกลไกตลาด

**Phase**: 1
**Actor(s)**: Admin (`admin.pricing`), System (scheduled job)
**Portal**: admin
**Auth**: session + 2FA (manual mode)
**Plugin/Adapter**: `AuditLogger`
**Meeting #1 delta**: none (separate from PromotionProductLink)

Bulk price update with audit trail. Distinct from UC-A16 because it's a mass
operation (CSV import or rule-based). Each row touched gets its own
AuditLog entry.

## Endpoints

### POST /api/v1/admin/products/bulk-price

`requires2FA: true`. Idempotent.

```ts
const BulkPriceBody = z.object({
  rows: z.array(z.object({
    productId: z.string().cuid(),
    priceB2B: z.number().nonnegative().optional(),
    priceB2C: z.number().nonnegative().optional(),
  })).min(1).max(500),
  reason: z.string().min(1).max(2000),
});
```

**Response 200**:
```ts
const BulkPriceResponse = z.object({
  data: z.object({
    updated: z.number(),
    skipped: z.array(z.object({
      productId: z.string().cuid(),
      reason: z.string(),
    })),
  }),
});
```

**Side effects**:
- `Product` rows update + `lastEditedAt`
- `AuditLog` per row: `event='product.price.updated'`, severity=NOTICE,
  `diff={ before, after }`

### POST /api/v1/admin/products/price-rules

System-driven adjustment via rule (e.g., +5% for category=DURIAN). Rules are
just declarative payloads stored as audit metadata; no separate `PriceRule`
entity in v1.

```ts
const PriceRuleBody = z.object({
  filter: z.object({
    category: z.enum(['DURIAN','COCONUT','GIFT_SET','NEW_ARRIVAL']).optional(),
    supplierId: z.string().cuid().optional(),
  }),
  operation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('multiply'), factor: z.number().positive() }),
    z.object({ kind: z.literal('add'),      amount: z.number() }),
    z.object({ kind: z.literal('set'),      value: z.number().nonnegative() }),
  ]),
  target: z.enum(['priceB2B','priceB2C','BOTH']),
  reason: z.string().min(1).max(2000),
  dryRun: z.boolean().default(false),
});
```

**Response 200** (dryRun=true): returns count + sample of affected rows
without writing.
