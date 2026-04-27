# UC-A02 — Verify การจ่ายเงินงวด 1 (50%)

**Phase**: 1
**Actor(s)**: Admin (`admin.payment_verify`)
**Portal**: admin
**Auth**: session + 2FA
**Plugin/Adapter**: `BankAdapter`, `AuditLogger`, `RealtimeAdapter`, `EmailAdapter`
**Meeting #1 delta**: none

Phase-1 verification of the 50% deposit. UC-A03 (20%) and UC-A04 (30%) are
Phase-2 — they share the same endpoint shape, parameterized by
`installment`. So this contract is the canonical "verify-payment" route.

## Endpoints

### GET /api/v1/admin/payments?installment=ONE&status=AWAITING_VERIFICATION

```ts
const PaymentRow = z.object({
  paymentId: z.string().cuid(),
  orderId: z.string().cuid(),
  orderNumber: z.string(),
  buyerEmail: z.string(),
  installment: z.enum(['ONE','TWO','THREE']),
  expectedAmount: z.number(),
  paidAmount: z.number().nullable(),
  currency: z.string(),
  bankRef: z.string().nullable(),
  bankTxnId: z.string().nullable(),
  method: z.enum(['WALLET','BANK_TRANSFER','QR_PROMPTPAY','ALIPAY','WECHAT_PAY']).nullable(),
  status: z.enum(['PENDING_BUYER','AWAITING_VERIFICATION','VERIFIED','REJECTED','REFUNDED']),
  detectedAt: z.string().datetime().nullable(),
});

const PaymentListResponse = z.object({
  data: z.object({
    items: z.array(PaymentRow),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});
```

### POST /api/v1/admin/payments/:id/verify

`requires2FA: true`. Idempotent.

```ts
const VerifyBody = z.object({
  notes: z.string().max(2000).optional(),
});
```

**Response 200**:
```ts
const VerifyResponse = z.object({
  data: z.object({
    paymentId: z.string().cuid(),
    status: z.literal('VERIFIED'),
    orderId: z.string().cuid(),
    orderStatus: z.string(),
    walletTransactionId: z.string().cuid(),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 409 | `payment.invalid_state` | not in AWAITING_VERIFICATION |
| 422 | `payment.amount_mismatch` | paidAmount differs from expectedAmount beyond ±0.01 |
| 422 | `payment.bank_txn_missing` | bankTxnId null — re-run BankAdapter pull |

**Side effects**:
- `Payment.status` → VERIFIED, `verifiedAt`, `verifiedBy`
- `Order.status` step transition (ONE → `PAYMENT_1_VERIFIED`; TWO → `PAYMENT_2_VERIFIED`; THREE → `PAYMENT_3_VERIFIED` + `COMPLETED`)
- `WalletTransaction` (`type=PAYMENT_RELEASE`)
- `RealtimeAdapter.publish({ channel: 'private-user-{buyerId}' })`
- `EmailAdapter.send({ template: 'payment.verified' })` to buyer
- `AuditLog`: `event='payment.verified'`, severity=NOTICE

### POST /api/v1/admin/payments/:id/reject

`requires2FA: true`.

```ts
const RejectBody = z.object({
  reason: z.string().min(1).max(2000),
  refund: z.boolean().default(false), // when true, BankAdapter.refund called
});
```

**Side effects**:
- `Payment.status` → REJECTED
- If `refund=true`: `BankAdapter.refund()` + `WalletTransaction(type=PAYMENT_REFUND)`
- `AuditLog`: `event='payment.rejected'`, severity=WARNING
