# UC-B09 — เสนอสินค้าที่ต้องการ (Special / Custom Request)

**Phase**: 1
**Actor(s)**: B2B
**Portal**: customer
**Auth**: session + role `buyer.b2b`
**Plugin/Adapter**: `EmailAdapter`, `BlobStorageAdapter`, `AuditLogger`
**Meeting #1 delta**: none

Free-form request for a product not in the catalog. Buyer describes desired
spec; admin replies via UC-A18.

## Endpoints

### POST /api/v1/special-requests/upload-url

Same shape as UC-B02 upload-url, but `kind` ∈ `{ 'reference_image', 'spec_doc' }`.

### POST /api/v1/special-requests

```ts
const SpecialRequestBody = z.object({
  kind: z.literal('CUSTOM'),
  productCategory: z.enum(['DURIAN','COCONUT','GIFT_SET','NEW_ARRIVAL']).optional(),
  desiredSpec: z.string().min(1).max(4000),
  qty: z.number().int().min(1),
  unitName: z.string().max(20).default('kg'),
  targetPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('THB'),
  expectedDeliveryAt: z.string().datetime().optional(),
  attachmentBlobKeys: z.array(z.string()).max(5).default([]),
});
```

**Response 201**: same envelope as UC-B08 (`kind: 'CUSTOM'`).

**Errors**:
| Status | code | When |
|--------|------|------|
| 403 | `auth.b2b_only` |
| 422 | `attachment.too_many` | > 5 |
| 422 | `blob.key_invalid` | uploaded blob not found / wrong owner |

**Side effects**:
- `SpecialRequest` insert
- `EmailAdapter.send({ template: 'admin.custom-request' })` to admins
- `AuditLog`: `event='special_request.custom.created'`
