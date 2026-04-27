# UC-B01 — สมัครสมาชิก B2C

**Phase**: 1
**Actor(s)**: Guest → B2C
**Portal**: customer (public)
**Auth**: none
**Plugin/Adapter**: `EmailAdapter`, `AuditLogger`
**Meeting #1 delta**: none

## Endpoints

### POST /api/v1/auth/signup/b2c

Create a new B2C account in `PENDING_VERIFICATION` status. Sends verification
email via `EmailAdapter`. No admin approval needed (contrast with B2B/UC-B02).

**Request**:
```ts
const SignupB2CBody = z.object({
  email: z.string().email().max(255),
  password: z.string().min(10).max(128),
  name: z.string().min(1).max(120),
  phone: z.string().regex(/^\+?[0-9\-\s]{8,20}$/).optional(),
  preferredLang: z.enum(['th', 'en', 'zh']).default('th'),
  acceptTerms: z.literal(true),
});
```

**Response 201**:
```ts
const SignupB2CResponse = z.object({
  data: z.object({
    userId: z.string().cuid(),
    email: z.string(),
    status: z.literal('PENDING_VERIFICATION'),
    verificationEmailSent: z.boolean(),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 400 | `validation.failed` | zod failure |
| 409 | `auth.email_taken` | unique violation on `User.email` |
| 503 | `email.adapter_unavailable` | EmailAdapter raised — user row still created, retry job picks up |

**Side effects**:
- `User` insert (`actorType=B2C`, `status=PENDING_VERIFICATION`)
- `Wallet` insert (`currency=THB`, `balanceSnapshot=0`)
- `VerificationToken` insert (TTL 24h)
- `EmailAdapter.send({ template: 'auth.verify-email' })`
- `AuditLog` insert: `event='auth.signup.b2c'`

### POST /api/v1/auth/verify-email

Consumes a token to flip `User.emailVerified` and `User.status=ACTIVE`.

**Request**:
```ts
const VerifyEmailBody = z.object({
  token: z.string().min(1).max(255),
});
```

**Response 200**:
```ts
const VerifyEmailResponse = z.object({
  data: z.object({ userId: z.string().cuid(), status: z.literal('ACTIVE') }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 400 | `auth.token_invalid` | not found |
| 410 | `auth.token_expired` | past `expires` |

**Side effects**:
- `User.emailVerified` set, `status='ACTIVE'`
- `VerificationToken` delete
- `AuditLog`: `event='auth.email.verified'`

### POST /api/v1/auth/verify-email/resend

Rate-limited (5/hour/IP, 3/hour/email).

```ts
const ResendBody = z.object({ email: z.string().email() });
```

Returns 204 regardless of whether the email exists (avoid enumeration).
