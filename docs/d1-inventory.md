# D1 inventory and ownership

## Migration journal

`migrations/0000` and `0001` create and correct the legacy `exam_sessions`
table. `0002` and `0003` create Better Auth tables and its admin and
organisation extensions. `0004` adds Platform Admin governance tables,
`0005` adds the MCQ examination workflow, and `0006`–`0007` add query indexes.

## Table ownership

Better Auth owns `user`, `session`, `account`, `verification`, `organization`,
`member`, and `invitation`. The application reads these tables but must use
Better Auth APIs for authentication and membership writes where an API exists.

The application owns `platform_organization`, `platform_audit_log`,
`platform_setting`, `examination`, `examination_question`,
`examination_option`, `examination_assignment`, `examination_attempt`, and
`examination_answer`. These are represented in `src/db/schema.ts`.

## Server boundaries

Routes provide navigation guards only. Private data is protected again inside
TanStack server functions through `requireSession`, `requireGlobalAdmin`,
`requireOrganizationMember`, and `requireOrganizationPermission` in
`src/server/auth/authorization.ts`.

Current feature server functions live in `src/lib/organization.functions.ts`,
`src/lib/examination.functions.ts`, and `src/lib/super-admin.functions.ts`.
The next architecture step is to extract application-owned SQL into
tenant-scoped repositories and services while keeping those functions thin.
