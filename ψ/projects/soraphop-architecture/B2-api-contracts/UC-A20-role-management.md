# UC-A20 — จัดการสิทธิ์ผู้ใช้ + Role Management

**Phase**: 1
**Actor(s)**: Super Admin (`super_admin.role_management`)
**Portal**: admin
**Auth**: session + 2FA
**Plugin/Adapter**: `AuditLogger`
**Meeting #1 delta**: none

WARD's B3 RBAC owns the matrix; FORGE exposes the CRUD endpoints. Permission
list is data — middleware reads `Permission` rows so adding a new permission
is INSERT, no deploy.

> Note: shape may evolve once WARD ships the formal RBAC matrix. The
> endpoints below are stable in path + intent; field set may grow.

## Endpoints

### GET /api/v1/admin/roles

```ts
const RoleRow = z.object({
  roleId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissionCount: z.number(),
  userCount: z.number(),
});

const RoleListResponse = z.object({
  data: z.object({ items: z.array(RoleRow) }),
});
```

### POST /api/v1/admin/roles

```ts
const RoleCreateBody = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_.]+$/).max(64),
  description: z.string().max(2000).optional(),
  permissionCodes: z.array(z.string()).default([]),
});
```

### PATCH /api/v1/admin/roles/:id

`isSystem=true` rows reject mutations on `name`. AuditLog every change.

### DELETE /api/v1/admin/roles/:id

Forbidden when `isSystem=true` or `userCount > 0`.

### GET /api/v1/admin/permissions

Read-only. Returns the full `Permission` catalog (curated by WARD).

### POST /api/v1/admin/users/:userId/roles

`requires2FA: true`.

```ts
const AssignRolesBody = z.object({
  roleIds: z.array(z.string().cuid()).min(1),
});
```

Replaces the user's role set (idempotent). AuditLog: `event='user.roles.assigned'`,
severity=NOTICE, diff before/after.

### DELETE /api/v1/admin/users/:userId/roles/:roleId

`requires2FA: true`. AuditLog: `event='user.roles.revoked'`.
