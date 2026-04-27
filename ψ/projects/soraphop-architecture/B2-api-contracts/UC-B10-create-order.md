# UC-B10 — สร้างคำสั่งซื้อ

**Phase**: 1
**Actor(s)**: B2B, B2C
**Portal**: customer
**Auth**: session
**Plugin/Adapter**: `AuditLogger`, `RealtimeAdapter`
**Meeting #1 delta**: transport divergence is part of order creation (linked to UC-B17)

Cart-style flow. Cart is itself a draft order (`status='CART'`). Adding /
removing items mutates the same row. Submitting creates the quotation request
(UC-B11) which transitions order to `PENDING_QUOTATION`.

## Endpoints

### GET /api/v1/orders/cart

`auth: session`. Returns the user's open `CART` order (creates one if missing).

```ts
const CartResponse = z.object({
  data: z.object({
    orderId: z.string().cuid(),
    status: z.literal('CART'),
    currency: z.string(),
    items: z.array(z.object({
      orderItemId: z.string().cuid(),
      productId: z.string().cuid(),
      qty: z.number(),
      unitName: z.string(),
      unitPrice: z.number(),
      lineTotal: z.number(),
    })),
    subtotal: z.number(),
    total: z.number(),
    transportMode: z.enum(['ROAD','AIR','SEA','ROAD_AIR_HYBRID']).nullable(),
    transportConfig: z.unknown().nullable(),
  }),
});
```

### POST /api/v1/orders/cart/items

Add an item.

```ts
const AddItemBody = z.object({
  productId: z.string().cuid(),
  qty: z.number().positive().max(100_000),
  unitName: z.string().max(20).optional(),
});
```

**Response 201**: same `CartResponse` shape (full cart).

**Errors**:
| Status | code | When |
|--------|------|------|
| 404 | `product.not_found` |
| 422 | `product.archived` |
| 422 | `cart.qty_exceeds_supply` | running stock check returns insufficient |

### PATCH /api/v1/orders/cart/items/:orderItemId

```ts
const UpdateItemBody = z.object({
  qty: z.number().positive().max(100_000),
});
```

### DELETE /api/v1/orders/cart/items/:orderItemId

204.

### POST /api/v1/orders

Promote cart → pending order. Requires transport selection (UC-B17 happens
inline on the cart page; we re-validate here).

```ts
const SubmitOrderBody = z.object({
  transportMode: z.enum(['ROAD','AIR','SEA','ROAD_AIR_HYBRID']),
  transportConfig: z.unknown(), // shape validated per actorType (UC-B17)
  notes: z.string().max(4000).optional(),
});
```

**Response 201**:
```ts
const SubmitOrderResponse = z.object({
  data: z.object({
    orderId: z.string().cuid(),
    number: z.string(),                  // ORD-2026-04-00001
    status: z.literal('PENDING_QUOTATION'),
  }),
});
```

**Side effects**:
- `Order.status` → `PENDING_QUOTATION`
- `Quotation` insert (DRAFT → see UC-B11 for finalize)
- `RealtimeAdapter.publish({ channel: 'private-admin', event: 'order.submitted' })`
- `AuditLog`: `event='order.submitted'`
