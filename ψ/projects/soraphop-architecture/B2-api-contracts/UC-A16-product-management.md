# UC-A16 — จัดการสินค้าในแค็ตตาล็อก

**Phase**: 1
**Actor(s)**: Admin (`admin.product`), Supplier (own products only) — Meeting #1 #5/#10
**Portal**: admin / supplier
**Auth**: session + role
**Plugin/Adapter**: `BlobStorageAdapter`, `AuditLogger`
**Meeting #1 delta**: same UI for admin (Soraphop's internal supplier) and external suppliers; anti-dump scaffolding

Two writers share this contract: external supplier publishes own products,
admin manages Soraphop's products via the internal-supplier flag (Meeting
#1 #10). Authorization differs by row ownership; endpoint shape identical.

## Endpoints

### POST /api/v1/products

`auth: session + (role admin.product OR supplier of supplierId)`.

```ts
const ProductCreateBody = z.object({
  supplierId: z.string().cuid(), // for admin, must point at internal supplier; for supplier, must be own
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  nameZh: z.string().max(255).optional(),
  description: z.string().max(8000).optional(),
  category: z.enum(['DURIAN','COCONUT','GIFT_SET','NEW_ARRIVAL']),
  priceB2B: z.number().nonnegative(),
  priceB2C: z.number().nonnegative(),
  currency: z.literal('THB').default('THB'),
  unitWeight: z.number().nonnegative().optional(),
  unitName: z.string().max(20).default('kg'),
  imageKeys: z.array(z.string()).max(10).default([]),
});
```

**Response 201**: returns `ProductDetail`.

**Errors**:
| Status | code | When |
|--------|------|------|
| 403 | `product.supplier_mismatch` | supplier writing to another supplier's row |
| 409 | `product.sku_taken` |
| 422 | `product.edit_locked` | `editLockUntil` in future (anti-dump) |

### PATCH /api/v1/products/:id

Same field set as create, all optional. On any update:
- `lastEditedAt` set
- `editLockUntil` set per anti-dump policy (Meeting #1 #9 — logic deferred,
  default null until OI-05 closes)
- `AuditLog`: `event='product.updated'` with diff

### POST /api/v1/products/:id/publish

```ts
const PublishBody = z.object({});
```

Sets `status='PUBLISHED'`. Admin-only when `editLockUntil` is in the future.
AuditLog: `event='product.published'`.

### POST /api/v1/products/:id/archive

Sets `status='ARCHIVED'`, soft-delete (`deletedAt`).

### GET /api/v1/products

Internal listing for admin / supplier. Includes DRAFT and ARCHIVED rows
(catalog API at UC-B07 shows PUBLISHED only).
