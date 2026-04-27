# UC-X07 — Anti-hacking (Audit Log + 2FA + Encryption)

**Phase**: 1
**Actor(s)**: System + every authenticated user
**Portal**: all
**Auth**: cross-cutting middleware (per-route declares `requires2FA`)
**Plugin/Adapter**: `AuditLogger`, `TwoFactorAdapter`, `RateLimiter`
**Meeting #1 delta**: none

Bundle of cross-cutting protections. No single endpoint owns it; the
behaviors below ride on every route via Fastify hooks.

## Cross-cutting behaviors

### Audit log
Every financial txn + every state transition + every admin action emits
`AuditLog`. Implemented via the `AuditLogger` plugin (default sink:
`PrismaAuditAdapter`). See UC-A19 for the read endpoint.

### 2FA enforcement
Routes that mutate finance, approvals, or roles declare `requires2FA: true`
in their plugin metadata. Fastify hook checks `X-2FA-Token` (TOTP via
`TotpAdapter`) before handler runs. Recovery codes burn one per use.

### 2FA enrollment endpoints

See [`CROSS-CUTTING.md`](./CROSS-CUTTING.md) for `/auth/2fa/setup`,
`/verify`, `/disable`, `/recovery-codes/regenerate`.

### Rate limiting

Sliding-window limits per route declared in plugin metadata. Limits emitted
in `X-RateLimit-*` headers; 429 with `i18nKey: 'errors.rate.limited'`.

Defaults:
| Scope | Limit |
|-------|-------|
| Per IP, /auth/* | 20/15min |
| Per email, /auth/login | 5/15min |
| Per IP, /auth/verify-email/resend | 5/hour |
| Per session, GET reads | 600/min |
| Per session, mutating routes | 60/min |
| Per session, /admin/* | 120/min |

### Encryption
- TLS 1.2+ in-transit (terminated at Caddy/Traefik on Hetzner — ANVIL).
- AES-256 at-rest for blob storage and DB volume (provider-level encryption).
- App-level AEAD for `TwoFactorSecret.secret` (AES-256-GCM, key in KMS).
- Bcrypt cost 12 for `User.passwordHash`.

### Anti-hacking signals
On every login, audit captures:
- `User.lastLoginIp`, `User.lastLoginUa` (added by WARD's B3 — schema may
  carry these later)
- Anomaly events: country mismatch, sudden device change, rapid concurrent
  sessions → emit `AuditLog` `severity=WARNING`, `event='auth.anomaly.<kind>'`.

### Health endpoint

#### GET /api/v1/system/health
`auth: none`. Returns:
```ts
const HealthResponse = z.object({
  data: z.object({
    status: z.enum(['ok','degraded','down']),
    checks: z.record(z.string(), z.object({
      ok: z.boolean(),
      latencyMs: z.number().optional(),
    })),
    version: z.string(),
    uptime: z.number(),
  }),
});
```
Each adapter (Bank, Email, Realtime, Blob) registers a probe; composition
root collates. This is what Uptime Kuma polls.
