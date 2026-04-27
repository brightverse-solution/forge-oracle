# UC-B17 — เลือกโหมดการขนส่ง

**Phase**: 1
**Actor(s)**: B2B (full config), B2C (mode-only) — Meeting #1 #2 🔄
**Portal**: customer
**Auth**: session
**Plugin/Adapter**: none (validation lives in service layer; ShippingProviderAdapter wires in Phase 2)
**Meeting #1 delta**: B2B picks mode + port + factors; B2C system-defaults to ROAD+AIR

Validates and stores transport on the cart's `Order`. Called both
inline-as-cart-update and at order submission (UC-B10) — same endpoint, same
zod schema.

## Endpoints

### PUT /api/v1/orders/cart/transport

```ts
const TransportConfigB2B = z.object({
  mode: z.enum(['ROAD','AIR','SEA','ROAD_AIR_HYBRID']),
  destinationPort: z.string().min(1).max(120),  // e.g., "GUANGZHOU", "SHANGHAI"
  // calculation factors — locked vocabulary; OI-01 may add fields
  factors: z.object({
    estimatedWeightKg: z.number().nonnegative().optional(),
    estimatedVolumeM3: z.number().nonnegative().optional(),
    requiresColdChain: z.boolean().default(false),
    insuranceTier: z.enum(['NONE','BASIC','FULL']).default('BASIC'),
    incoterm: z.enum(['EXW','FOB','CIF','DDP']).optional(),
  }).default({}),
});

const TransportConfigB2C = z.object({
  // System default for B2C is ROAD+AIR hybrid; UI may surface a single
  // toggle. Open OI-01 — kฤษณะ may detail more fields. Schema's `Json`
  // column on Order.transportConfig keeps this evolvable.
  mode: z.literal('ROAD_AIR_HYBRID').default('ROAD_AIR_HYBRID'),
});

const TransportPutBody = z.discriminatedUnion('actorType', [
  z.object({ actorType: z.literal('B2B'), config: TransportConfigB2B }),
  z.object({ actorType: z.literal('B2C'), config: TransportConfigB2C }),
]);
```

**Response 200**:
```ts
const TransportPutResponse = z.object({
  data: z.object({
    orderId: z.string().cuid(),
    transportMode: z.enum(['ROAD','AIR','SEA','ROAD_AIR_HYBRID']),
    transportConfig: z.unknown(),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 403 | `transport.actor_mismatch` | B2C posted B2B config |
| 422 | `transport.port_invalid` | unknown destination port (validated against allowlist) |
| 409 | `order.invalid_state` | not in CART |

**Side effects**:
- `Order.transportMode` + `Order.transportConfig` update
- `AuditLog`: `event='order.transport.updated'`
