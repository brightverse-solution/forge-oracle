# UC-A01 — อนุมัติ/ปฏิเสธการสมัครสมาชิก B2B

**Phase**: 1
**Actor(s)**: Admin
**Portal**: admin
**Auth**: session + role `admin.b2b_approval`
**Plugin/Adapter**: `EmailAdapter`, `BlobStorageAdapter` (read-only signed URL), `AuditLogger`
**Meeting #1 delta**: none

Admin reviews pending B2B signups created by UC-B02. Approval flips
`User.status` to `ACTIVE`; rejection sets it to `SUSPENDED` with reason.

## Endpoints

### GET /api/v1/admin/b2b-approvals

`?page=1&pageSize=20&status=PENDING`

```ts
const B2BApprovalListItem = z.object({
  approvalId: z.string().cuid(),
  userId: z.string().cuid(),
  email: z.string(),
  status: z.enum(['PENDING','APPROVED','REJECTED','CANCELLED']),
  company: z.object({
    legalName: z.string(),
    taxId: z.string(),
    contactPersonName: z.string(),
    contactPhone: z.string(),
    countryCode: z.string(),
  }),
  createdAt: z.string().datetime(),
});

const B2BApprovalListResponse = z.object({
  data: z.object({
    items: z.array(B2BApprovalListItem),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});
```

### GET /api/v1/admin/b2b-approvals/:id

Returns the approval row plus signed URLs for the supporting documents
(`registrationCertKey`, `vatCertKey`, `bankBookKey`) generated via
`BlobStorageAdapter.signRead()` with TTL 5min.

```ts
const B2BApprovalDetail = B2BApprovalListItem.extend({
  documents: z.object({
    registrationCertUrl: z.string().url().nullable(),
    vatCertUrl: z.string().url().nullable(),
    bankBookUrl: z.string().url().nullable(),
  }),
});
```

### POST /api/v1/admin/b2b-approvals/:id/approve

`requires2FA: true`. Idempotent.

```ts
const ApproveBody = z.object({
  notes: z.string().max(2000).optional(),
});
```

**Response 200**:
```ts
const ApproveResponse = z.object({
  data: z.object({
    approvalId: z.string().cuid(),
    userId: z.string().cuid(),
    status: z.literal('APPROVED'),
    userStatus: z.literal('ACTIVE'),
  }),
});
```

**Side effects**:
- `AdminApproval.status` → APPROVED, `decidedBy=userId`, `decidedAt=now()`
- `User.status` → ACTIVE; `User.emailVerified=now()` (admin-attested)
- `EmailAdapter.send({ template: 'auth.b2b-approved' })` to applicant
- `AuditLog`: `event='approval.b2b.approved'`, severity=NOTICE

### POST /api/v1/admin/b2b-approvals/:id/reject

`requires2FA: true`.

```ts
const RejectBody = z.object({
  reason: z.string().min(1).max(2000),
});
```

**Side effects**:
- `AdminApproval.status` → REJECTED with reason
- `User.status` → SUSPENDED
- `EmailAdapter.send({ template: 'auth.b2b-rejected' })`
- `AuditLog`: `event='approval.b2b.rejected'`
