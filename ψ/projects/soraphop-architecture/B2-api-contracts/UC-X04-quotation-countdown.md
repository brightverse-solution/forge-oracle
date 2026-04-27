# UC-X04 — Countdown Timer 5-7 วัน

**Phase**: 1
**Actor(s)**: System (worker) — observed via Quotation row
**Portal**: n/a (no dedicated endpoint; surfaced via UC-B11 GET)
**Auth**: n/a
**Plugin/Adapter**: `RealtimeAdapter`, `EmailAdapter`, `AuditLogger`
**Meeting #1 delta**: none

Countdown is a property of `Quotation.expiresAt` (5-7 days; configured per
quotation by the pricing engine). The "timer" is FE rendering of that
absolute timestamp. Server-side concerns:

- A worker scans `Quotation` rows where `status='PENDING_BUYER_CONFIRM'`
  AND `expiresAt < now()` → flips to `EXPIRED`, releases held wallet funds
  (if any), emits realtime + email events.
- Buyer-facing reminder pushes at -24h and -1h before `expiresAt`.

## Endpoints

### POST /api/v1/system/quotations/expire-tick

`auth: system token`. Worker invokes this every minute. Idempotent.

```ts
const ExpireTickResponse = z.object({
  data: z.object({
    expired: z.number(),
    remindersSent: z.number(),
  }),
});
```

**Side effects**:
- `Quotation.status` → EXPIRED for matched rows
- Parent `Order` returns to `CART`
- `Payment(installment=ONE,status=PENDING_BUYER)` is voided if pre-confirm
- `EmailAdapter.send({ template: 'quotation.expired' })` to requester
- `AuditLog`: `event='quotation.expired'`

### Surfaced via UC-B11 GET

`GET /api/v1/quotations/:id` already includes:
- `expiresAt`
- derivable `secondsRemaining` (FE computes from server time + `Date.now()`)

To avoid clock skew, the response carries a `serverTime` envelope field:
```ts
const QuotationGetResponse = z.object({
  data: QuotationResponse.shape.data,
  meta: z.object({ serverTime: z.string().datetime() }),
});
```
