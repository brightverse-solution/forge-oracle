# UC-B07 — เลือกดูแค็ตตาล็อกสินค้า

**Phase**: 1
**Actor(s)**: Guest, B2B, B2C
**Portal**: customer
**Auth**: optional (price visibility differs)
**Plugin/Adapter**: `FxRateAdapter` (for dual-currency display, Meeting #1 #3)
**Meeting #1 delta**: dual-currency hint piggybacks via `?displayCurrency=`

## Endpoints

### GET /api/v1/catalog/products

```
?category=DURIAN&q=...&page=1&pageSize=20&sort=-createdAt&displayCurrency=CNY
```

Price visibility:
- Guest / B2C → `priceB2C` only
- B2B → both `priceB2B` and `priceB2C`
- Admin → both + `editLockUntil`

When `displayCurrency` is set and ≠ THB, the response includes a
`displayPrice` per item computed via the latest `FxRate` row (`source` chosen
by composition root). The original price stays as the primary number; the
converted is informational ("ประมาณ").

```ts
const CatalogListQuery = z.object({
  category: z.enum(['DURIAN','COCONUT','GIFT_SET','NEW_ARRIVAL']).optional(),
  q: z.string().max(120).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  displayCurrency: z.string().length(3).optional(),
});

const CatalogProduct = z.object({
  id: z.string().cuid(),
  sku: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
  nameZh: z.string().nullable(),
  category: z.enum(['DURIAN','COCONUT','GIFT_SET','NEW_ARRIVAL']),
  priceB2C: z.number(),
  priceB2B: z.number().nullable(),  // null for non-B2B viewers
  currency: z.string(),
  displayPrice: z.object({ // present when displayCurrency requested
    currency: z.string(),
    rate: z.number(),
    rateFetchedAt: z.string().datetime(),
    approxAmount: z.number(),
  }).optional(),
  unitWeight: z.number().nullable(),
  unitName: z.string(),
  imageKeys: z.array(z.string()),
});

const CatalogListResponse = z.object({
  data: z.object({
    items: z.array(CatalogProduct),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});
```

### GET /api/v1/catalog/products/:id

Single product. Same price-visibility rules.

```ts
const CatalogProductDetail = CatalogProduct.extend({
  description: z.string().nullable(),
  status: z.enum(['DRAFT','PUBLISHED','ARCHIVED']),
  supplierId: z.string().cuid(),
  // promotion bundles linked to this product (Meeting #1 #1)
  promotions: z.array(z.object({
    promotionId: z.string().cuid(),
    code: z.string(),
    title: z.string(),
    unitQty: z.number().nullable(),
    unitWeight: z.number().nullable(),
    durationDays: z.number().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })),
});
```

### GET /api/v1/catalog/promotions

Surfaces active promotions with their linked products (Meeting #1 #1 — admin
links manually). Used by promotion grid on home page.

```ts
const PromotionListResponse = z.object({
  data: z.object({
    items: z.array(z.object({
      promotionId: z.string().cuid(),
      code: z.string(),
      title: z.string(),
      titleEn: z.string().nullable(),
      titleZh: z.string().nullable(),
      bannerImageKey: z.string().nullable(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      productCount: z.number(),
    })),
  }),
});
```

**Errors**: standard 400 (validation), 404 (product not found / archived for
non-admin viewer).
