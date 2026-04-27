# UC-B03 — Login / Logout

**Phase**: 1
**Actor(s)**: All actor types
**Portal**: all
**Auth**: none (login) / session (logout)
**Plugin/Adapter**: `TwoFactorAdapter`, `AuditLogger`
**Meeting #1 delta**: none

Auth.js handles the heavy lifting. We expose thin wrappers so FE has a stable
contract independent of the Auth.js callback shape.

## Endpoints

### POST /api/v1/auth/login

```ts
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
```

**Response 200** — split: 2FA-enrolled users get a challenge, others get a
session immediately.

```ts
const LoginResponse = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('SESSION'),
    data: z.object({
      sessionToken: z.string(),
      expiresAt: z.string().datetime(),
      user: z.object({
        id: z.string().cuid(),
        actorType: z.enum(['B2C','B2B','ADMIN','SUPER_ADMIN','SUPPLIER','QC_LOGISTICS']),
        preferredLang: z.string(),
      }),
    }),
  }),
  z.object({
    outcome: z.literal('TWOFACTOR_REQUIRED'),
    data: z.object({
      challengeId: z.string(),
      expiresAt: z.string().datetime(),
    }),
  }),
]);
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 401 | `auth.invalid_credentials` | wrong email/password |
| 403 | `auth.account_pending` | `status=PENDING_VERIFICATION` |
| 403 | `auth.account_pending_approval` | `status=PENDING_B2B_APPROVAL` |
| 403 | `auth.account_suspended` | `status=SUSPENDED` |
| 429 | `auth.rate_limited` | 5 failed attempts/15min/email or 20/IP |

**Side effects**:
- `Session` insert on success
- `AuditLog`: `event='auth.login.success'` or `'auth.login.failed'`

### POST /api/v1/auth/login/2fa

```ts
const Login2FABody = z.object({
  challengeId: z.string(),
  code: z.string().min(6).max(20),
});
```

Returns the same `SESSION` shape as above. `TwoFactorAdapter.verify()` checks
TOTP or recovery code.

### POST /api/v1/auth/logout

`auth: session`. Deletes the current `Session` row.

**Response 204**.

**Side effects**:
- `Session` delete
- `AuditLog`: `event='auth.logout'`
