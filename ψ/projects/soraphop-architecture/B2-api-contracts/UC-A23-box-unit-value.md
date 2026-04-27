# UC-A23 — กำหนดมูลค่ากล่องต่อชิ้น

**Phase**: 1 (config only)
**Actor(s)**: Admin (`admin.claim_config`)
**Portal**: admin
**Auth**: session
**Plugin/Adapter**: `AuditLogger`
**Meeting #1 delta**: PackagingInventory threshold + alert (#7) — same mutation surface

Sets the box-unit value used by Phase-2 UC-A11/A12 box reconcile + supplier
bill deduction. Bundled with `PackagingInventory` mutation since both fields
live on the same row.

## Endpoints

### PATCH /api/v1/admin/packaging-inventory/:id

`requires2FA: true` for `unitValue` changes.

```ts
const PackagingInventoryPatch = z.object({
  unitValue: z.number().nonnegative().optional(),
  minThreshold: z.number().int().nonnegative().optional(), // Meeting #1 #7
  alertSubscribers: z.object({
    adminIds: z.array(z.string().cuid()),
    supplierIds: z.array(z.string().cuid()),
  }).optional(),
});
```

**Response 200**:
```ts
const PackagingInventoryDetail = z.object({
  data: z.object({
    id: z.string().cuid(),
    supplierId: z.string().cuid(),
    packagingType: z.string(),
    quantityOnHand: z.number(),
    minThreshold: z.number(),
    unitValue: z.number(),
    currency: z.literal('THB'),
    alertSubscribers: z.object({
      adminIds: z.array(z.string().cuid()),
      supplierIds: z.array(z.string().cuid()),
    }).nullable(),
    updatedAt: z.string().datetime(),
  }),
});
```

**Side effects**:
- `PackagingInventory` update
- `AuditLog`: `event='packaging.config.updated'` with diff. severity=NOTICE.

### POST /api/v1/admin/suppliers/:id/packaging-inventory

Create a new packaging row for a supplier.

```ts
const PackagingCreateBody = z.object({
  packagingType: z.string().min(1).max(120),
  unitName: z.string().max(20).default('box'),
  quantityOnHand: z.number().int().nonnegative().default(0),
  minThreshold: z.number().int().nonnegative().default(0),
  unitValue: z.number().nonnegative().default(0),
  alertSubscribers: z.object({
    adminIds: z.array(z.string().cuid()),
    supplierIds: z.array(z.string().cuid()),
  }).optional(),
});
```

Unique on `(supplierId, packagingType)`.
