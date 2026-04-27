# UC-X01 — Bank API ตรวจสอบยอดโอน Wallet (Auto-Reconcile)

**Phase**: 1
**Actor(s)**: System (BullMQ scheduled worker, every 60s) + Admin (manual trigger)
**Portal**: admin (manual trigger only)
**Auth**: system token (worker) / admin session (manual trigger)
**Plugin/Adapter**: `BankAdapter`, `AuditLogger`, `RealtimeAdapter`
**Meeting #1 delta**: none

System endpoint, not customer-facing. The worker pulls bank ledger via
`BankAdapter.listTransactions()`, matches incoming transfers against open
TopupIntents + Payments by `bankRef`, and credits wallets / advances
payments accordingly.

## Endpoints

### POST /api/v1/system/bank/reconcile

`auth: system token` — only the BullMQ worker (or admin manual trigger).
Idempotent.

```ts
const ReconcileBody = z.object({
  since: z.string().datetime().optional(),
  dryRun: z.boolean().default(false),
});
```

**Response 200**:
```ts
const ReconcileResponse = z.object({
  data: z.object({
    fetched: z.number(),
    matchedTopups: z.number(),
    matchedPayments: z.number(),
    unmatched: z.number(),
    errors: z.number(),
  }),
});
```

**Side effects** (per matched txn, transactional):
- For matched top-up: `WalletTransaction(type=TOP_UP)` + `Wallet.balanceSnapshot` += amount; intent → FULFILLED; `RealtimeAdapter.publish` to user.
- For matched payment: `Payment.bankTxnId` set, `Payment.paidAmount`, `Payment.status='AWAITING_VERIFICATION'`; `RealtimeAdapter.publish` to admin.
- `AuditLog` per txn: `event='bank.reconcile.matched'` or `'bank.reconcile.unmatched'`.

### GET /api/v1/admin/bank/reconcile/runs

Admin view of recent reconcile runs.

```ts
const ReconcileRunRow = z.object({
  runId: z.string().cuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  fetched: z.number(),
  matched: z.number(),
  unmatched: z.number(),
  errors: z.number(),
  triggeredBy: z.enum(['SYSTEM','ADMIN']),
});
```
