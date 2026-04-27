# UC-A18 — ตอบรับ/ปฏิเสธ Sample + Special Request

**Phase**: 1
**Actor(s)**: Admin (`admin.special_request`)
**Portal**: admin
**Auth**: session
**Plugin/Adapter**: `EmailAdapter`, `AuditLogger`, `RealtimeAdapter`
**Meeting #1 delta**: none

Admin response to UC-B08 (SAMPLE) and UC-B09 (CUSTOM). Endpoints are
shared; behavior parameterized by `SpecialRequest.kind`.

## Endpoints

### GET /api/v1/admin/special-requests

`?kind=SAMPLE&status=PENDING&page=1`

```ts
const SpecialRequestRow = z.object({
  requestId: z.string().cuid(),
  kind: z.enum(['SAMPLE','CUSTOM']),
  status: z.enum(['PENDING','ACCEPTED','REJECTED','FULFILLED']),
  requesterId: z.string().cuid(),
  requesterEmail: z.string(),
  productId: z.string().cuid().nullable(),
  desiredSpec: z.string().nullable(),
  qty: z.number(),
  unitName: z.string(),
  createdAt: z.string().datetime(),
});

const SpecialRequestListResponse = z.object({
  data: z.object({
    items: z.array(SpecialRequestRow),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});
```

### POST /api/v1/admin/special-requests/:id/accept

```ts
const AcceptBody = z.object({
  response: z.string().min(1).max(4000),
  // optional: link to a quoted product or to a draft order
  proposedProductId: z.string().cuid().optional(),
  proposedPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('THB'),
});
```

**Side effects**:
- `SpecialRequest.status='ACCEPTED'`, `adminResponse`, `decidedAt`
- `EmailAdapter.send({ template: 'special-request.accepted' })`
- `AuditLog`: `event='special_request.accepted'`

### POST /api/v1/admin/special-requests/:id/reject

```ts
const RejectBody = z.object({
  reason: z.string().min(1).max(2000),
});
```

Side effects symmetric (status=REJECTED, audit, email).
