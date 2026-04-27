# UC-B11 — รับและยืนยัน Quotation ภายใน Countdown

**Phase**: 1
**Actor(s)**: **B2B + B2C** 🔄 (Meeting #1 #4 — was B2B-only in SRS v3.6)
**Portal**: customer
**Auth**: session
**Plugin/Adapter**: `AuditLogger`, `RealtimeAdapter`, `EmailAdapter`
**Meeting #1 delta**: actor expanded to include B2C; conditions are configurable (#8)

Order submitted → system computes Quotation (or supplier-derived). Buyer has
`countdownDays` (UC-X04, default 5-7) to confirm. Confirming locks the
`ONE` payment installment for 50%.

## Endpoints

### GET /api/v1/quotations/:id

Owner or admin. Returns the quotation snapshot including applied conditions
(Meeting #1 #8 — frozen at confirm time for audit reproducibility).

```ts
const QuotationResponse = z.object({
  data: z.object({
    quotationId: z.string().cuid(),
    number: z.string(),
    requesterId: z.string().cuid(),
    requesterType: z.enum(['B2B','B2C']),
    source: z.enum(['SYSTEM','SUPPLIER_DERIVED']),
    supplierId: z.string().cuid().nullable(),
    status: z.enum(['DRAFT','PENDING_BUYER_CONFIRM','CONFIRMED','EXPIRED','CANCELLED','SUSPENDED']),
    currency: z.string(),
    items: z.array(z.object({
      productId: z.string().cuid(),
      qty: z.number(),
      unitName: z.string(),
      unitPrice: z.number(),
      lineTotal: z.number(),
    })),
    subtotal: z.number(),
    total: z.number(),
    expiresAt: z.string().datetime(),
    confirmedAt: z.string().datetime().nullable(),
    appliedConditions: z.array(z.object({
      category: z.string(),
      label: z.string(),
      appliedValue: z.unknown(),
    })),
  }),
});
```

### POST /api/v1/quotations/:id/confirm

Idempotent via `Idempotency-Key`. Locks the buyer's first payment.

**Request**: empty body.

**Response 200**:
```ts
const ConfirmResponse = z.object({
  data: z.object({
    quotationId: z.string().cuid(),
    orderId: z.string().cuid(),
    status: z.literal('CONFIRMED'),
    payment1: z.object({
      paymentId: z.string().cuid(),
      installment: z.literal('ONE'),
      expectedAmount: z.number(),
      bankRef: z.string(),
    }),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 403 | `quotation.not_owner` | requesterId ≠ session userId (and not admin) |
| 409 | `quotation.invalid_state` | not in PENDING_BUYER_CONFIRM |
| 410 | `quotation.expired` | past expiresAt — system marks EXPIRED automatically |
| 422 | `quotation.suspended` | admin suspended via cross-cutting endpoint |

**State transitions**:
- `Quotation`: PENDING_BUYER_CONFIRM → CONFIRMED
- `Order`: PENDING_QUOTATION → AWAITING_PAYMENT_1
- `Payment` insert (`installment=ONE`, status=`PENDING_BUYER`, expectedAmount=50% of total)
- `QuotationAppliedCondition` snapshot frozen
- `RealtimeAdapter.publish({ channel: 'private-user-{id}' })`
- `AuditLog`: `event='quotation.confirmed'`

### POST /api/v1/quotations/:id/cancel

Owner. Allowed only in DRAFT or PENDING_BUYER_CONFIRM.

```ts
const CancelBody = z.object({ reason: z.string().max(2000).optional() });
```

**Side effect**: `status='CANCELLED'`, parent Order returns to `CART` (line
items preserved).

### POST /api/v1/quotations/request

Meeting #1 #4: B2C may also request a quotation. Replaces the implicit
B2B-only flow. Body identical for both actor types; behavior differs in the
pricing engine (B2C uses `priceB2C`, B2B uses `priceB2B` and may apply
supplier-derived overrides).

```ts
const QuotationRequestBody = z.object({
  orderId: z.string().cuid(),
  // optional: hint which supplier-derived data to use (UI surfaces choices
  // from PromotionProductLink + supplier overrides)
  preferredSupplierId: z.string().cuid().optional(),
});
```

**Response 201**: returns a `QuotationResponse` in `PENDING_BUYER_CONFIRM`
state with `expiresAt` set per UC-X04.
