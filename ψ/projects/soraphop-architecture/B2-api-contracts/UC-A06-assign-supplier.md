# UC-A06 — Assign งานให้ล้ง + จัดสรรกล่อง

**Phase**: 1
**Actor(s)**: Admin (`admin.assignment`)
**Portal**: admin
**Auth**: session
**Plugin/Adapter**: `AuditLogger`, `RealtimeAdapter`, `EmailAdapter`
**Meeting #1 delta**: PackagingInventory dual-actor + threshold (#7) — alert flows here

Admin assigns a paid order (`Order.status='PAYMENT_1_VERIFIED'`) to a
supplier, creates the planned `Container(s)`, allocates packaging from
`PackagingInventory`. If allocation drops below `minThreshold`, alert is
queued for the configured subscribers (admin_ids + supplier_ids).

## Endpoints

### POST /api/v1/admin/orders/:id/assign

```ts
const AssignBody = z.object({
  supplierId: z.string().cuid(),
  containers: z.array(z.object({
    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    plannedBoxCount: z.number().int().min(1).max(2000).default(960),
    packagingType: z.string().min(1).max(120),
  })).min(1).max(20),
  notes: z.string().max(2000).optional(),
});
```

**Response 201**:
```ts
const AssignResponse = z.object({
  data: z.object({
    orderId: z.string().cuid(),
    supplierId: z.string().cuid(),
    containers: z.array(z.object({
      containerId: z.string().cuid(),
      number: z.string(),
      plannedDate: z.string(),
      plannedBoxCount: z.number(),
      packagingType: z.string(),
    })),
    packagingAllocation: z.array(z.object({
      packagingType: z.string(),
      requestedBoxes: z.number(),
      remainingOnHand: z.number(),
      thresholdAlert: z.boolean(), // true → alert queued
    })),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 409 | `order.invalid_state` | not in PAYMENT_1_VERIFIED |
| 409 | `supplier.suspended` |
| 422 | `supplier.capacity_exceeded` | container.plannedDate exceeds remaining |
| 422 | `packaging.insufficient` | requested > on-hand for that supplier+type |

**Side effects**:
- `Order.supplierId` set, `Order.status` → ASSIGNED_TO_SUPPLIER
- `Container` rows insert (status=PLANNED)
- `PackagingInventory.quantityOnHand` decremented per allocation
- If new on-hand ≤ minThreshold → enqueue notifications for `alertSubscribers`
- `RealtimeAdapter.publish({ channel: 'private-supplier-{id}' })`
- `EmailAdapter.send({ template: 'supplier.task-assigned' })`
- `AuditLog`: `event='order.assigned'`, severity=NOTICE

### POST /api/v1/admin/orders/:id/reassign

Same body. Rolls back prior allocation (`PackagingInventory.quantityOnHand`
restored), then runs `assign` logic. Allowed only when no Container has left
PLANNED. Otherwise → 409 `assignment.too_late`.
