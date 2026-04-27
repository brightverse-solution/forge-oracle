# UC-B04 — เลือกเปลี่ยนภาษา

**Phase**: 1
**Actor(s)**: All
**Portal**: all
**Auth**: session (persists per-user) / none (anonymous via cookie)
**Plugin/Adapter**: none
**Meeting #1 delta**: none

Language toggle has two layers: anonymous (cookie/localStorage, FE-only) and
authenticated (persisted on `User.preferredLang`, follows the user across
devices). Auto-detect logic = UC-X05.

## Endpoints

### PATCH /api/v1/users/me/preferences

`auth: session`. Mutates only the calling user.

**Request**:
```ts
const PreferencesPatch = z.object({
  preferredLang: z.enum(['th', 'en', 'zh']).optional(),
});
```

**Response 200**:
```ts
const PreferencesResponse = z.object({
  data: z.object({ preferredLang: z.enum(['th', 'en', 'zh']) }),
});
```

**Side effects**:
- `User.preferredLang` update
- `AuditLog`: `event='user.preferences.updated'` (low-severity)

### GET /api/v1/i18n/messages?lang=th&namespace=catalog

`auth: none`. Read-only — HERALD's catalog. Cached at CDN edge for 5 min.
Returned shape is opaque key-value map; FE owns the translation function.

```ts
const MessagesResponse = z.object({
  data: z.object({
    lang: z.enum(['th','en','zh']),
    namespace: z.string(),
    messages: z.record(z.string(), z.string()),
    version: z.string(), // for cache busting
  }),
});
```
