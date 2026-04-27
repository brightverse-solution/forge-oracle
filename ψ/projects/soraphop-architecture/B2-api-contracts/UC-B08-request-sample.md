# UC-B08 — ขอตัวอย่างสินค้า (Request Sample)

**Phase**: 1
**Actor(s)**: B2B
**Portal**: customer
**Auth**: session + role `buyer.b2b`
**Plugin/Adapter**: `EmailAdapter`, `AuditLogger`
**Meeting #1 delta**: none

A B2B-only flow that creates a special request record. Replied to via UC-A18.
Schema-wise this rides on the same `SpecialRequest` model as UC-B09 (no
separate model needed — discriminator field).

> **Schema note**: `SpecialRequest` is *not yet* in B1 schema v1 because SRS
> §5 doesn't list it among the 14 base entities. **FORGE flag for QB**: add
> `SpecialRequest` (id, requesterId, kind:[SAMPLE|CUSTOM], productId?, qty?,
> notes, status, adminResponse, decidedAt) before Week 1 close — small
> addition that would otherwise force a Phase-2 migration. Tracked in the
> ready-notification.

## Endpoints

### POST /api/v1/special-requests

```ts
const RequestSampleBody = z.object({
  kind: z.literal('SAMPLE'),
  productId: z.string().cuid(),
  qty: z.number().int().min(1).max(50),
  shippingAddress: z.object({
    addressLine1: z.string().max(255),
    city: z.string().max(120),
    province: z.string().max(120).optional(),
    postalCode: z.string().max(20),
    countryCode: z.string().length(2).default('TH'),
  }),
  notes: z.string().max(2000).optional(),
});
```

**Response 201**:
```ts
const RequestSampleResponse = z.object({
  data: z.object({
    requestId: z.string().cuid(),
    status: z.literal('PENDING'),
    kind: z.literal('SAMPLE'),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 403 | `auth.b2b_only` | actorType ≠ B2B |
| 404 | `product.not_found` |
| 409 | `request.duplicate_open` | open SAMPLE request for same product within 7d |

**Side effects**:
- `SpecialRequest` insert
- `EmailAdapter.send({ template: 'admin.sample-request' })` to admins
- `AuditLog`: `event='special_request.sample.created'`

### GET /api/v1/special-requests/mine

`auth: session`. List requester's own requests with admin response status.

### GET /api/v1/special-requests/:id

Owner or admin only.
