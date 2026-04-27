# UC-B16 — Financial Visibility

**Phase**: 1
**Actor(s)**: B2B, B2C (own data only)
**Portal**: customer
**Auth**: session
**Plugin/Adapter**: none (read-only aggregation)
**Meeting #1 delta**: dual-currency hint — surface `displayCurrency` if requested

Buyer dashboard for "ดูสถานะการเงินของฉัน" — open orders, payments due,
upcoming installments, wallet flow.

## Endpoints

### GET /api/v1/financial/visibility

```
?dateFrom=...&dateTo=...&displayCurrency=CNY
```

```ts
const FinancialVisibilityResponse = z.object({
  data: z.object({
    walletBalance: z.number(),
    walletCurrency: z.string(),
    openOrders: z.array(z.object({
      orderId: z.string().cuid(),
      number: z.string(),
      status: z.string(),
      total: z.number(),
      nextInstallment: z.object({
        installment: z.enum(['ONE','TWO','THREE']),
        expectedAmount: z.number(),
        dueAt: z.string().datetime().nullable(),
        bankRef: z.string().nullable(),
      }).nullable(),
    })),
    upcomingPayments: z.array(z.object({
      paymentId: z.string().cuid(),
      orderNumber: z.string(),
      installment: z.enum(['ONE','TWO','THREE']),
      expectedAmount: z.number(),
      currency: z.string(),
      status: z.enum(['PENDING_BUYER','AWAITING_VERIFICATION']),
      dueAt: z.string().datetime().nullable(),
    })),
    summary: z.object({
      totalSpentYTD: z.number(),
      pendingPayments: z.number(),
      currency: z.string(),
      // Meeting #1 #3 — dual-currency hint
      displayCurrency: z.string().optional(),
      displayRate: z.number().optional(),
      displayRateFetchedAt: z.string().datetime().optional(),
    }),
  }),
});
```

**Errors**: standard 401/403.
