# UC-B06 — ดูยอดเงินและประวัติ Wallet

**Phase**: 1
**Actor(s)**: B2B, B2C (own wallet only)
**Portal**: customer
**Auth**: session
**Plugin/Adapter**: none
**Meeting #1 delta**: none

## Endpoints

### GET /api/v1/wallet

Returns the calling user's wallet.

```ts
const WalletResponse = z.object({
  data: z.object({
    walletId: z.string().cuid(),
    currency: z.string(),
    balance: z.number(),         // computed live from SUM(transactions)
    balanceSnapshot: z.number(), // for reconciliation diagnostics
    snapshotAt: z.string().datetime(),
  }),
});
```

### GET /api/v1/wallet/transactions

```
?page=1&pageSize=20&type=TOP_UP&dateFrom=...&dateTo=...&sort=-createdAt
```

```ts
const WalletTxnList = z.object({
  data: z.object({
    items: z.array(z.object({
      id: z.string().cuid(),
      type: z.enum([
        'TOP_UP','PAYMENT_HOLD','PAYMENT_RELEASE','PAYMENT_REFUND',
        'CLAIM_DEDUCTION','BOX_DEDUCTION','ADJUSTMENT',
      ]),
      amount: z.number(),
      currency: z.string(),
      refType: z.string().nullable(),
      refId: z.string().nullable(),
      bankTxnId: z.string().nullable(),
      description: z.string().nullable(),
      createdAt: z.string().datetime(),
    })),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});
```

**Errors**: standard 401 if no session; 403 only when admin attempts to read
another user's wallet via this endpoint (admin uses `/admin/wallets/:userId`
in a different UC).
