# Soraphop API Contracts (B2)

> FORGE Oracle ⚒️ · 2026-04-27 · per QB work-order soraphop-structure-week-0
> Pair file: `../B1-schema-v1.prisma`

This catalog defines REST contracts for the **66 Use Cases** in SRS v3.6 plus
**Meeting #1 (2026-04-24)** refinements. It is the source of truth for:

- `apps/api/src/features/<feature>/routes.ts` — Fastify route registration
- `packages/shared-types/src/contracts/*.ts` — zod schemas shared FE↔BE
- `apps/web/src/lib/api/*.ts` — TanStack Query client wrappers
- `docs/openapi.yaml` — auto-generated from zod via `zod-to-openapi`

---

## 1. Conventions

### 1.1 URL shape

```
https://api.soraphop.com/api/v1/<resource>[/...]
```

- **Versioning**: prefix `v1` in the path. Breaking changes ship under `v2`,
  never inside `v1`. (Forward-compatibility is a Day-1 contract — addendum §1.)
- **Resource naming**: plural nouns, kebab-case (`/quotation-conditions`,
  `/admin/b2b-approvals`).
- **Portal-scoped paths**: `/admin/...`, `/supplier/...`, `/qc/...` — used by
  RBAC middleware to short-circuit on actor mismatch before route handlers run.

### 1.2 Method semantics

| Method | Use |
|--------|-----|
| `GET` | List or read; never mutates |
| `POST` | Create, action (e.g., `:approve`, `:suspend`), idempotent retries via `Idempotency-Key` |
| `PATCH` | Partial update of mutable fields |
| `PUT` | Replace (rare; prefer PATCH) |
| `DELETE` | Soft delete only — sets `deleted_at`. Hard delete is not exposed in v1. |

### 1.3 Auth

- Header: `Authorization: Bearer <session-jwt>` issued by Auth.js.
- 2FA challenge for financial actions: `X-2FA-Token: <totp-or-recovery>` —
  required when route declares `requires2FA: true`.
- Public endpoints (signup, login, password reset, FX read) are explicitly
  marked `auth: none`.
- All other endpoints: middleware enforces session + role. Role check reads
  `Permission` rows (WARD's B3, plugin per addendum §2 WARD bullet) — never
  hardcoded.

### 1.4 Request / response envelope

All payloads are JSON. Bodies validated via zod at the route boundary.

**Success response**:
```ts
{
  data: T,                  // resource or { items, total, page }
  meta?: { ... }            // pagination, rate-limit headroom, etc.
}
```

**Error response** (uniform across 4xx + 5xx):
```ts
{
  error: {
    code: string,           // dotted, stable: "user.not_found"
    message: string,        // EN fallback
    messageKey: string,     // i18n key for HERALD: "errors.user.not_found"
    details?: unknown,      // field-level validation errors, etc.
    requestId: string       // for log correlation
  }
}
```

**Status codes** — keep narrow:
- `200` OK (read, non-creating action)
- `201` Created (POST that creates a resource)
- `204` No Content (action with no body to return)
- `400` Validation error (zod failure)
- `401` Unauthenticated
- `403` Forbidden (auth ok, permission denied)
- `404` Not Found
- `409` Conflict (state machine violation, duplicate key)
- `422` Business rule violation (e.g., insufficient wallet balance)
- `429` Rate-limited
- `500` Internal (with `requestId` for tracing)
- `503` External adapter failure (e.g., BankAdapter unavailable)

### 1.5 Pagination

```
GET /api/v1/<resource>?page=1&pageSize=20&sort=-createdAt&filter[status]=ACTIVE
```

- `page` starts at 1; default `pageSize=20`, max 100.
- `sort`: comma-separated, `-` prefix = desc.
- Response: `{ data: { items: T[], total: number, page, pageSize } }`.

### 1.6 Idempotency

`POST` actions that move money or create durable side effects accept
`Idempotency-Key: <uuid>` header. Server stores `(key, requestHash, response)`
in Redis (TTL 24h). Same key + same hash → cached response; same key +
different hash → `409 idempotency.mismatch`.

### 1.7 i18n + error keys

Every user-facing message ships an `i18nKey` rather than free text. HERALD
populates TH/EN/ZH catalogs. Pattern: `errors.<domain>.<code>`.

Examples:
- `errors.auth.invalid_credentials`
- `errors.order.payment_already_verified`
- `errors.packaging.below_min_threshold`

### 1.8 Real-time

Some flows (payment verified, container status change, claim raised) push
events via `RealtimeAdapter` (Pusher in v1, self-hosted SSE later). The
adapter is referenced from feature modules but the wire-protocol is opaque
to the API consumer beyond endpoint topics:

```
private-user-{userId}        — owner-scoped events
private-order-{orderId}      — order participants only
private-supplier-{supplierId}
private-admin                — admin broadcast
```

---

## 2. Adapters & plugins (per binding addendum)

Routes live under `apps/api/src/features/`. External integrations sit under
`apps/api/src/adapters/` behind narrow interfaces:

| Port | Adapter implementations | Used by |
|------|--------------------------|---------|
| `BankAdapter` | `ScbAdapter`, `KBankAdapter`, `MockBankAdapter` | UC-B05, UC-B12-14, UC-X01, UC-X02 |
| `AccountingAdapter` | `FlowAccountAdapter` | UC-X03, UC-A14 |
| `EmailAdapter` | `ResendAdapter`, `SendGridAdapter`, `MockEmailAdapter` | UC-B01, UC-B02, UC-A01, every notification |
| `FxRateAdapter` | `ExchangeRateApiAdapter`, `BankFxAdapter`, `MockFxAdapter` | Cross-cutting `/fx/rates` |
| `BlobStorageAdapter` | `S3Adapter` (Wasabi/R2) | UC-B02 docs, UC-Q05 photos, certificates |
| `RealtimeAdapter` | `PusherAdapter`, `SelfHostedSseAdapter` | every status-change endpoint |
| `AuditLogger` | `PrismaAuditAdapter`, `ExternalSinkAdapter` | every financial endpoint, every approval |
| `TwoFactorAdapter` | `TotpAdapter`, `WebauthnAdapter` (later) | `/auth/2fa/*`, every financial action |
| `PaymentMethodPlugin` | `BankTransferPlugin`, `QrPromptPayPlugin`, `AlipayPlugin`, `WeChatPayPlugin` | UC-B12-14, registered in DB (`PaymentMethodConfig`) |
| `ShippingProviderAdapter` | `DhlAdapter`, `FedexAdapter`, `LocalConsolidatorAdapter` | UC-B15 (Phase 2) |

Composition root: `apps/api/src/composition.ts` wires concretes → ports per
environment. Tests use `Mock*Adapter`. **No business code imports a concrete
adapter directly.**

---

## 3. Folder layout (binding from addendum §3)

```
apps/api/src/
├── features/
│   ├── auth/                    # UC-B01, B02, B03, X05, X07 (2FA), X07 (audit)
│   ├── wallet/                  # UC-B05, B06
│   ├── catalog/                 # UC-B07, A16, A17
│   ├── special-requests/        # UC-B08, B09, A18
│   ├── orders/                  # UC-B10, B17
│   ├── quotations/              # UC-B11 (+ B2C expand from Meeting #1 #4)
│   ├── financial-visibility/    # UC-B16
│   ├── b2b-approvals/           # UC-A01
│   ├── payment-verification/    # UC-A02 (+ A03, A04 in Phase 2)
│   ├── capacity/                # UC-A05
│   ├── assignment/              # UC-A06
│   ├── promotions/              # Meeting #1 #1
│   ├── promotion-products/      # cross-cutting endpoint
│   ├── quotation-conditions/    # Meeting #1 #8
│   ├── packaging/               # Meeting #1 #7
│   ├── claim-config/            # UC-A22, A23
│   ├── dashboard/               # UC-A19
│   ├── role-management/         # UC-A20
│   ├── containers/              # Phase 2
│   ├── claims/                  # Phase 2 (cross-actor)
│   ├── certificates/            # Phase 2
│   ├── shipping/                # Phase 2
│   ├── fx/                      # cross-cutting
│   └── system/                  # X04 (countdown), X06 (responsive — FE only)
├── adapters/
│   ├── bank/
│   ├── accounting/
│   ├── email/
│   ├── fx/
│   ├── blob/
│   ├── realtime/
│   ├── twofactor/
│   ├── shipping/
│   └── payment-method/
├── platform/
│   ├── auth/                    # WARD's B3
│   ├── audit/                   # AuditLogger plugin
│   ├── i18n/                    # HERALD's F4 keys
│   ├── errors/                  # error envelope, i18nKey lookups
│   ├── idempotency/             # Idempotency-Key middleware
│   ├── pagination/
│   └── rate-limit/
├── composition.ts
└── server.ts
```

Each `features/<x>/` is a Fastify plugin (`fastify-plugin`). Composition root
registers them: `fastify.register(ordersPlugin, { prefix: '/api/v1/orders' })`.
Removing a feature = remove one register line.

---

## 4. UC index

### 4.1 Phase 1 — 29 UCs (this directory has 1 file per UC)

**Buyer (13)** — `UC-B01-signup-b2c.md` … `UC-B17-transport-mode.md`
| ID | Title | File |
|----|-------|------|
| UC-B01 | สมัครสมาชิก B2C | [UC-B01](./UC-B01-signup-b2c.md) |
| UC-B02 | สมัครสมาชิก B2B | [UC-B02](./UC-B02-signup-b2b.md) |
| UC-B03 | Login / Logout | [UC-B03](./UC-B03-login-logout.md) |
| UC-B04 | เลือกเปลี่ยนภาษา | [UC-B04](./UC-B04-language-toggle.md) |
| UC-B05 | เติมเงินเข้า Wallet | [UC-B05](./UC-B05-wallet-topup.md) |
| UC-B06 | ดู Wallet balance + history | [UC-B06](./UC-B06-wallet-view.md) |
| UC-B07 | แค็ตตาล็อกสินค้า | [UC-B07](./UC-B07-catalog.md) |
| UC-B08 | Request Sample | [UC-B08](./UC-B08-request-sample.md) |
| UC-B09 | Special Request | [UC-B09](./UC-B09-special-request.md) |
| UC-B10 | สร้างคำสั่งซื้อ | [UC-B10](./UC-B10-create-order.md) |
| UC-B11 | Quotation (B2B + B2C) 🔄 | [UC-B11](./UC-B11-quotation.md) |
| UC-B16 | Financial Visibility | [UC-B16](./UC-B16-financial-visibility.md) |
| UC-B17 | เลือกโหมดขนส่ง 🔄 | [UC-B17](./UC-B17-transport-mode.md) |

**Admin (11)** — `UC-A01-approve-b2b.md` … `UC-A23-box-unit-value.md`
| ID | Title | File |
|----|-------|------|
| UC-A01 | อนุมัติ/ปฏิเสธ B2B | [UC-A01](./UC-A01-approve-b2b.md) |
| UC-A02 | Verify งวด 1 (50%) | [UC-A02](./UC-A02-verify-payment-1.md) |
| UC-A05 | ตรวจ Capacity ล้ง | [UC-A05](./UC-A05-supplier-capacity.md) |
| UC-A06 | Assign + จัดสรรกล่อง | [UC-A06](./UC-A06-assign-supplier.md) |
| UC-A16 | จัดการแค็ตตาล็อก | [UC-A16](./UC-A16-product-management.md) |
| UC-A17 | ปรับราคา | [UC-A17](./UC-A17-price-adjustment.md) |
| UC-A18 | ตอบ Sample/Special Request | [UC-A18](./UC-A18-respond-special-request.md) |
| UC-A19 | Dashboard + รายงาน | [UC-A19](./UC-A19-dashboard.md) |
| UC-A20 | Role Management | [UC-A20](./UC-A20-role-management.md) |
| UC-A22 | กำหนด % เสียหาย | [UC-A22](./UC-A22-damage-threshold.md) |
| UC-A23 | กำหนดมูลค่ากล่อง | [UC-A23](./UC-A23-box-unit-value.md) |

**System (5)**:
| ID | Title | File |
|----|-------|------|
| UC-X01 | Bank Wallet auto-reconcile | [UC-X01](./UC-X01-bank-wallet-reconcile.md) |
| UC-X04 | Countdown Timer 5-7 d | [UC-X04](./UC-X04-quotation-countdown.md) |
| UC-X05 | Auto-detect language | [UC-X05](./UC-X05-language-detect.md) |
| UC-X06 | Responsive display | [UC-X06](./UC-X06-responsive.md) |
| UC-X07 | Anti-hacking | [UC-X07](./UC-X07-security.md) |

🔄 = Meeting #1 baseline change applied.

### 4.2 Cross-cutting endpoints (Meeting #1 + 2FA)

See [`CROSS-CUTTING.md`](./CROSS-CUTTING.md):
- `POST /api/v1/auth/2fa/setup`, `/verify`, `/disable`
- `GET /api/v1/fx/rates`
- `POST /api/v1/admin/promotions/:id/products` (link product to promotion)
- `POST /api/v1/admin/quotation-conditions` (define condition header)
- `POST /api/v1/admin/quotations/:id/suspend`

### 4.3 Phase 2 — 37 UCs (signatures only)

See [`PHASE-2-SIGNATURES.md`](./PHASE-2-SIGNATURES.md). Detailed contracts
deferred to Week 5+ per work-order scoping.

---

## 5. Conventions per UC document

Each `UC-*.md` follows this template:

```
# UC-XXX — Title

**Phase**: 1 | 2
**Actor(s)**: ...
**Portal**: customer | admin | supplier | qc
**Auth**: role(s) — references Permission rows
**Plugin/Adapter touchpoints**: BankAdapter | EmailAdapter | ...
**Meeting #1 delta**: (if applicable)

## Endpoint(s)

### POST /api/v1/...

**Request** (zod):
```ts
const Body = z.object({ ... });
```

**Response 201/200** (zod):
```ts
const Response = z.object({ data: ... });
```

**Errors**:
| Status | Code | When |

**Side effects**:
- `AuditLog` insert: event=`...`
- Notification: ...
- Adapter call: ...

**State machine** (where relevant): from → to
```

---

## 6. Open questions surfaced to Palm

Flagged in `from-forge_*-ready.md` per addendum §6:

1. **DI framework**: vanilla composition.ts vs Awilix. *FORGE recommends
   vanilla* — `fastify-plugin` already provides DI scoping; Awilix adds a
   layer that buys little in a 14-week build. Revisit at Month 6 if testing
   pain emerges.
2. **Plugin discovery**: explicit register list. Filesystem scan looks magic
   in PR review and breaks when feature folders need partial enablement
   (e.g., Phase-2 still stubbed).
3. **Per-plugin versioning**: skip for v1. Single root `package.json` keeps
   the monorepo lean; extract a feature into its own package only when a
   second consumer (e.g., a separate worker process) needs it.
