# UC-B02 — สมัครสมาชิก B2B (นิติบุคคล)

**Phase**: 1
**Actor(s)**: Guest → B2B (`status=PENDING_B2B_APPROVAL`)
**Portal**: customer (public)
**Auth**: none
**Plugin/Adapter**: `EmailAdapter`, `BlobStorageAdapter`, `AuditLogger`
**Meeting #1 delta**: none

B2B signup creates `User` + `Company` rows and uploads supporting documents
(registration cert, VAT cert, bankbook). User cannot log in until UC-A01
admin approval. Document files go through `BlobStorageAdapter` so the API
never holds bytes in DB.

## Endpoints

### POST /api/v1/auth/signup/b2b/upload-url

Pre-signed upload URL for company documents. Issued before form submit so the
form POST carries blob keys, not multipart bodies.

**Request**:
```ts
const UploadUrlBody = z.object({
  filename: z.string().max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  kind: z.enum(['registration_cert', 'vat_cert', 'bank_book']),
});
```

**Response 200**:
```ts
const UploadUrlResponse = z.object({
  data: z.object({
    uploadUrl: z.string().url(), // pre-signed S3 URL, TTL 10min
    blobKey: z.string(),         // hand back on form submit
    expiresAt: z.string().datetime(),
  }),
});
```

### POST /api/v1/auth/signup/b2b

**Request**:
```ts
const SignupB2BBody = z.object({
  // user
  email: z.string().email().max(255),
  password: z.string().min(10).max(128),
  contactPersonName: z.string().min(1).max(120),
  contactPhone: z.string().regex(/^\+?[0-9\-\s]{8,20}$/),
  preferredLang: z.enum(['th', 'en', 'zh']).default('th'),
  // company
  legalName: z.string().min(1).max(255),
  taxId: z.string().regex(/^[0-9]{10,15}$/),
  registrationNumber: z.string().max(50).optional(),
  countryCode: z.string().length(2).default('TH'),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(120),
  province: z.string().max(120).optional(),
  postalCode: z.string().max(20),
  contactPersonRole: z.string().max(120).optional(),
  // blob keys returned from upload-url
  registrationCertKey: z.string().min(1),
  vatCertKey: z.string().min(1),
  bankBookKey: z.string().optional(),
  acceptTerms: z.literal(true),
});
```

**Response 201**:
```ts
const SignupB2BResponse = z.object({
  data: z.object({
    userId: z.string().cuid(),
    companyId: z.string().cuid(),
    approvalRequestId: z.string().cuid(),
    status: z.literal('PENDING_B2B_APPROVAL'),
  }),
});
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 400 | `validation.failed` | zod failure |
| 409 | `auth.email_taken` | duplicate email |
| 409 | `company.tax_id_taken` | duplicate `Company.taxId` |
| 422 | `blob.key_invalid` | uploaded blob not found / wrong owner |

**Side effects**:
- `User` (`actorType=B2B`, `status=PENDING_B2B_APPROVAL`, `emailVerified=null`)
- `Company` insert linked to user
- `Wallet` insert
- `AdminApproval` insert (`kind=B2B_SIGNUP`, `subjectType='User'`)
- `EmailAdapter.send({ template: 'auth.b2b-pending' })` to applicant
- `EmailAdapter.send({ template: 'admin.b2b-approval-pending' })` to admins
- `AuditLog`: `event='auth.signup.b2b'`

State: `PENDING_B2B_APPROVAL` → UC-A01 (admin) → `ACTIVE` or `SUSPENDED`.
