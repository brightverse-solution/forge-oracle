# UC-B05 — เติมเงินเข้า E-Wallet

**Phase**: 1
**Actor(s)**: B2B, B2C
**Portal**: customer
**Auth**: session + 2FA
**Plugin/Adapter**: `BankAdapter` (verify), `AuditLogger`, `RealtimeAdapter`
**Meeting #1 delta**: none (but plugin pattern: `PaymentMethodPlugin` for top-up rails)

Top-up flow: buyer requests a top-up intent → system returns a unique
reference number + bank account → buyer transfers via their bank → Bank
auto-reconcile job (UC-X01) detects matching deposit → wallet credited.

## Endpoints

### POST /api/v1/wallet/topup-intents

Idempotent via `Idempotency-Key`.

**Request**:
```ts
const TopupIntentBody = z.object({
  amount: z.number().positive().max(10_000_000),
  currency: z.literal('THB'),
  method: z.enum(['BANK_TRANSFER', 'QR_PROMPTPAY']),
});
```

**Response 201**:
```ts
const TopupIntentResponse = z.object({
  data: z.object({
    intentId: z.string().cuid(),
    bankRef: z.string(),     // e.g., "TOPUP-9F2A3" — buyer prints in transfer memo
    amount: z.number(),
    currency: z.literal('THB'),
    method: z.enum(['BANK_TRANSFER', 'QR_PROMPTPAY']),
    bankAccount: z.object({
      bankName: z.string(),
      accountNumber: z.string(),
      accountName: z.string(),
    }).optional(),         // null when method=QR_PROMPTPAY
    qrPayload: z.string().optional(), // EMVCo QR for QR_PROMPTPAY
    expiresAt: z.string().datetime(), // 24h
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 422 | `wallet.amount_below_minimum` | < 100 THB |
| 422 | `wallet.method_disabled` | `PaymentMethodConfig.isEnabled=false` |
| 503 | `bank.adapter_unavailable` | rare; queue for retry |

**Side effects**:
- `WalletTransaction` insert (`type=TOP_UP`, status pending — we model state
  via parent intent table; for v1 we keep it as a metadata-flagged row)
- `AuditLog`: `event='wallet.topup.requested'`

### GET /api/v1/wallet/topup-intents/:id

Poll fallback when realtime channel is unavailable. Returns intent +
fulfillment status.

```ts
const TopupIntentDetail = z.object({
  data: z.object({
    intentId: z.string(),
    status: z.enum(['PENDING', 'FULFILLED', 'EXPIRED']),
    bankRef: z.string(),
    amount: z.number(),
    creditedAt: z.string().datetime().nullable(),
    bankTxnId: z.string().nullable(),
  }),
});
```
