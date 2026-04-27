---
name: Read Prisma schema before writing Prisma calls
description: Field names drift when writing from inference; reading schema.prisma first prevents silent typecheck failures
type: feedback
---

When implementing Fastify routes that touch Prisma, always read `schema.prisma` before writing the first `model.create()` or `model.update()`. Field names inferred from use-case semantics drift from actual schema names — `requesterId` vs `requestedBy`, `notes` vs `reason`, `emailVerifiedAt` vs `emailVerified`.

**Why:** On Day 2 Soraphop, b2b-approvals.ts had 11 typecheck errors from schema mismatches that would have been zero if the schema was read first. Every mismatch was "logical" but wrong.

**How to apply:** Before writing any `tx.model.create({ data: { ... } })`, open `apps/api/prisma/schema.prisma` and verify the exact field names for every field being written.
