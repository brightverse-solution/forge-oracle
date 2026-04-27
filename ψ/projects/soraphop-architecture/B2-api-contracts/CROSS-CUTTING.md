# Cross-cutting endpoints

> Endpoints not bound to a single SRS UC. Includes Meeting #1 additions
> (FX, promotion-product link, quotation conditions, suspend) and 2FA
> enrollment that UC-X07 references.

All shapes follow the conventions in [`README.md`](./README.md) §1.

---

## 1. 2FA enrollment

`TwoFactorAdapter` is the port; default concrete is `TotpAdapter` (RFC 6238).
`WebauthnAdapter` is reserved for future opt-in.

### POST /api/v1/auth/2fa/setup

`auth: session`. Generates a TOTP secret + provisioning URI. Returns the QR
payload for the authenticator app. Secret is stored encrypted (`enabled=false`)
until UC-`/verify` confirms it.

**Response 201**:
```ts
const SetupResponse = z.object({
  data: z.object({
    enrollmentId: z.string().cuid(),
    otpauthUri: z.string().url(),  // otpauth://totp/...
    qrPngBase64: z.string(),       // FE renders directly
    recoveryCodes: z.array(z.string()).length(8), // shown ONCE
  }),
});
```

### POST /api/v1/auth/2fa/verify

`auth: session`. Confirms enrollment by validating a TOTP code against the
pending secret. On success, `TwoFactorSecret.enabled=true` and
`recoveryCodes` are persisted (hashed).

```ts
const VerifyBody = z.object({
  code: z.string().regex(/^\d{6,8}$/),
});
```

**Response 200**: `{ data: { enabled: true } }`.

### POST /api/v1/auth/2fa/disable

`auth: session + 2FA challenge`. Body empty. AuditLog
`event='auth.2fa.disabled'`, severity=WARNING.

### POST /api/v1/auth/2fa/recovery-codes/regenerate

`auth: session + 2FA`. Returns a fresh array of 8 recovery codes (the prior
set is invalidated).

---

## 2. FX rates (Meeting #1 #3)

`FxRateAdapter` is the port; default concrete is `ExchangeRateApiAdapter`.
Composition root may swap to `BankFxAdapter` (SCB FX feed) for higher
fidelity later.

### GET /api/v1/fx/rates

`auth: none`. Cached at edge for 60s. Used by:
- UC-B07 catalog `displayCurrency` query param
- UC-B16 financial visibility `displayCurrency` summary
- Checkout dual-currency hint

```
?currencies=CNY,USD&base=THB
```

```ts
const FxQuery = z.object({
  currencies: z.string().regex(/^[A-Z]{3}(,[A-Z]{3})*$/), // ISO 4217 list
  base: z.literal('THB').default('THB'),
});

const FxRatesResponse = z.object({
  data: z.object({
    base: z.literal('THB'),
    rates: z.array(z.object({
      currency: z.string().length(3),
      rateToThb: z.number(),
      source: z.string(),
      fetchedAt: z.string().datetime(),
      stale: z.boolean(), // true when fetchedAt > 1h
    })),
  }),
});
```

### POST /api/v1/system/fx/refresh

`auth: system token`. Worker invokes hourly. Pulls all configured currencies
via `FxRateAdapter.fetch()` and inserts a fresh `FxRate` row per
(currency, source). Returns count.

---

## 3. Promotion ↔ Product manual link (Meeting #1 #1)

Admin manually picks each product matching unit/qty for a promotion.
System never auto-matches.

### POST /api/v1/admin/promotions/:id/products

`auth: session + role admin.promotion`.

```ts
const LinkBody = z.object({
  productId: z.string().cuid(),
  unitQty: z.number().int().positive().optional(),
  unitWeight: z.number().positive().optional(),
  durationDays: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});
```

**Response 201**:
```ts
const LinkResponse = z.object({
  data: z.object({
    linkId: z.string().cuid(),
    promotionId: z.string().cuid(),
    productId: z.string().cuid(),
    unitQty: z.number().nullable(),
    unitWeight: z.number().nullable(),
    durationDays: z.number().nullable(),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 409 | `promotion.product_already_linked` | unique (promotionId, productId) violation |
| 422 | `promotion.unit_mismatch` | unit/qty incompatible with product unitName/unitWeight (warning, can override with `?force=true`) |

**Side effects**:
- `PromotionProductLink` insert
- `AuditLog`: `event='promotion.product.linked'`

### DELETE /api/v1/admin/promotions/:id/products/:linkId

204. AuditLog: `event='promotion.product.unlinked'`.

### GET /api/v1/admin/promotions/:id/products

List linked products with their per-link overrides.

---

## 4. Quotation conditions (Meeting #1 #8)

Dev defines header categories. Suppliers override their own values via
`SupplierQuotationData`. Admin can suspend a supplier-derived quotation.

### POST /api/v1/admin/quotation-conditions

`auth: session + role admin.quotation_config + 2FA`.

```ts
const ConditionBody = z.object({
  category: z.string().regex(/^[a-z][a-z0-9_]+$/).max(64),
  label: z.string().min(1).max(255),
  labelEn: z.string().max(255).optional(),
  labelZh: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  // valueSchema is a serialized zod schema. Service layer validates it
  // by attempting to parse with `zod-to-json-schema`'s inverse.
  valueSchema: z.unknown(),
  defaultValue: z.unknown().optional(),
  isActive: z.boolean().default(true),
});
```

**Response 201**: returns the persisted condition.

### PATCH /api/v1/admin/quotation-conditions/:id

Same fields, all optional. Existing `SupplierQuotationData` rows are
re-validated against the new `valueSchema`; rows that fail are flagged
(`isActive=false`) and an admin notification is queued.

### GET /api/v1/admin/quotation-conditions

```ts
const ConditionListResponse = z.object({
  data: z.object({
    items: z.array(z.object({
      id: z.string().cuid(),
      category: z.string(),
      label: z.string(),
      isActive: z.boolean(),
      supplierOverrideCount: z.number(),
    })),
  }),
});
```

### POST /api/v1/supplier/quotation-data

`auth: session + role supplier.quotation`. Supplier sets/updates their
override of one condition. Upsert by (supplierId, conditionId).

```ts
const SupplierDataBody = z.object({
  conditionId: z.string().cuid(),
  value: z.unknown(), // validated against condition.valueSchema
});
```

---

## 5. Suspend supplier-derived quotation (Meeting #1 #8)

### POST /api/v1/admin/quotations/:id/suspend

`auth: session + role admin.quotation_oversight + 2FA`.

```ts
const SuspendBody = z.object({
  reason: z.string().min(1).max(2000),
  // when true, also disables future quotations from this supplier until
  // explicitly re-enabled (creates an AdminApproval row of kind=QUOTATION_SUSPEND)
  alsoSuspendSupplier: z.boolean().default(false),
});
```

**Response 200**:
```ts
const SuspendResponse = z.object({
  data: z.object({
    quotationId: z.string().cuid(),
    status: z.literal('SUSPENDED'),
    suspendedAt: z.string().datetime(),
    supplierAlsoSuspended: z.boolean(),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 409 | `quotation.invalid_state` | already CONFIRMED or EXPIRED |
| 422 | `quotation.not_supplier_derived` | source != SUPPLIER_DERIVED |

**Side effects**:
- `Quotation.status='SUSPENDED'`, `suspendedAt`, `suspendReason`
- If `alsoSuspendSupplier=true`: `Supplier.status='SUSPENDED'` + `AdminApproval(kind=QUOTATION_SUSPEND)`
- `EmailAdapter.send({ template: 'supplier.quotation-suspended' })` to supplier
- `AuditLog`: `event='quotation.suspended'`, severity=WARNING

### POST /api/v1/admin/quotations/:id/resume

Inverse. AuditLog: `event='quotation.resumed'`.

---

## 6. Idempotency replay

### GET /api/v1/system/idempotency/:key

`auth: session`. Diagnostic — returns the cached response for a prior
`Idempotency-Key`. Useful when FE retried but lost the response.

```ts
const IdempotencyLookupResponse = z.object({
  data: z.object({
    key: z.string(),
    method: z.string(),
    path: z.string(),
    status: z.number(),
    response: z.unknown(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
});
```
