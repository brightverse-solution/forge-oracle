# UC-X05 — Auto-detect ภาษาจากอุปกรณ์

**Phase**: 1
**Actor(s)**: All (anonymous + authenticated)
**Portal**: all
**Auth**: optional
**Plugin/Adapter**: none
**Meeting #1 delta**: none

Language detection priority (highest first):
1. `User.preferredLang` if logged in
2. `lang=` query param (deep-link override)
3. `lang` cookie (set by FE on first visit)
4. `Accept-Language` header → first matching of {th, en, zh}
5. Fallback: `th`

The server reflects its decision via the `meta.lang` envelope on the
language-aware endpoints (catalog, dashboards, quotations). Pure detection
helper:

## Endpoints

### GET /api/v1/i18n/detect

`auth: none`. No side effects — server inspects headers + (optional) session
to surface what FE *would* default to.

```ts
const DetectQuery = z.object({
  hint: z.string().max(64).optional(), // accepts raw Accept-Language string
});

const DetectResponse = z.object({
  data: z.object({
    lang: z.enum(['th','en','zh']),
    source: z.enum(['user_pref','query','cookie','accept_header','default']),
  }),
});
```
