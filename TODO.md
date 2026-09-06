# Architecture implementation backlog

This backlog translates `ARCHITECTURE_D1.md` into safe, incremental work. Do not begin a later phase until its verification criteria pass.

## Completed work log

- [x] **2026-09-06 — PR #10:** Prevented candidate scores from being returned by dashboard, attempt, and submission server functions before results are published. Added result-visibility coverage.
- [x] **2026-09-06 — PR #9:** Blocked candidate examination activity for suspended or archived organisations, including direct server-function calls. Added lifecycle-policy coverage.
- [x] **2026-09-05 — PR #8:** Added server-enforced examination deadlines for starting attempts and saving answers. Added deadline-boundary tests.
- [x] **2026-09-05 — PR #7:** Added server-enforced examination lifecycle rules and tests for publish, close, archive, and result-release transitions.
- [x] **2026-09-05 — PR #6:** Added Zod validation for examination questions, candidate assignments, workflow actions, attempts, and answers. Added contract tests.
- [x] **2026-09-05 — PR #5:** Added explicit organisation-membership guards so members can select their active organisation without gaining management permissions. Added role-policy tests.
- [x] **2026-09-05 — PR #1:** Added the authorization foundation, the organisation permission matrix, and initial examination Zod contract tests. Merged as `6b2f503`.
- [x] **2026-09-05 — PR #2:** Added Zod contracts and tests for organisation membership and invitation mutations; fixed invitation acceptance to authorise the signed-in recipient. Merged as `1cc8a63`.
- [x] **2026-09-05 — PR #3:** Added Zod contracts and tests for Platform Admin governance mutations, settings, and audit filters. Merged as `b845cf9`.

## Phase 0 — Baseline and guardrails

- [ ] Inspect and document the current D1 schema, Better Auth tables, migration journal, server functions and route guards.
- [ ] Add a working `typecheck` script if TypeScript supports it cleanly.
- [ ] Resolve the repository-wide Biome schema/version mismatch and establish a passing formatting/lint baseline.
- [ ] Add route-level error and pending states for protected areas without exposing internal database errors.
- [ ] Document local and remote migration commands, including rollback/recovery expectations.

**Done when:** `npm run build`, lint, typecheck and local migration checks are reliable and documented.

## Phase 1 — Server boundaries and authorization

- [x] Create centralized server-only helpers: `requireSession`, `requireGlobalAdmin`, `requireActiveOrganization`, `requireOrganizationMember`, and `requireOrganizationPermission`.
- [x] Define the organisation permission matrix for owner, admin and member roles.
- [x] Replace duplicated authorization checks in organisation, examination and Super Admin server functions with the centralized helpers.
- [ ] Ensure active/suspended/archived organisation lifecycle status is checked consistently before every operational mutation.
- [ ] Add safe domain errors for unauthorized, forbidden, missing-resource and invalid-state cases.
- [ ] Add direct server-function tests proving route guards alone are not relied on.

**Done when:** every private server function authorizes the trusted Better Auth session independently of its UI route.

## Phase 2 — Validation and contracts

- [ ] Install and standardize Zod for all untrusted Server Function, route-param and search-param input.
- [ ] Define reusable schemas for organisation, invitation, examination, question, candidate assignment, attempt, platform setting and governance mutations.
- [ ] Remove ad-hoc validators and broad `any` types from UI/server boundaries.
- [ ] Keep tenant authority out of client inputs where it can be resolved from the active server-side organisation context.
- [ ] Return typed, client-safe response shapes rather than raw D1 rows.

**Done when:** every external input has a shared schema and invalid input produces a safe user-facing error.

**Completed in this phase so far:**

- [x] Examination creation contract and tests.
- [x] Examination question, candidate assignment, workflow action, attempt, and answer contracts and tests.
- [x] Organisation, membership, and invitation mutation contracts and tests.
- [x] Platform Admin user, organisation, lifecycle, settings, and audit-filter contracts and tests.

## Phase 3 — Drizzle, repositories and services

- [ ] Expand `src/db/schema.ts` to cover application-owned D1 tables: platform governance, examinations, questions/options, assignments, attempts and answers.
- [ ] Adopt one timestamp convention for application tables and migrate inconsistent application-owned timestamps safely.
- [ ] Create repository modules that always accept trusted `organizationId` for tenant-owned reads/writes.
- [ ] Move business workflows from `src/lib/*.functions.ts` into server-side services; keep server functions thin: validate → authorize → service → typed response.
- [ ] Use D1-compatible Drizzle queries and transactions/batches for multi-record operations.
- [ ] Add or validate indexes for active query paths: organisation/status, organisation/created date, assignment/user, attempt/assignment and audit filters.

**Done when:** application database access is centralized through Drizzle repositories/services and every tenant query scopes `organizationId`.

## Phase 4 — Examination workflow hardening

**Completed in this phase so far:**

- [x] Added server-enforced lifecycle transition rules for publishing, closing, archiving, and releasing results.
- [x] Prevented candidates from starting or autosaving an attempt after an examination deadline.
- [x] Prevented candidate access, answer saving, and submission when an organisation is suspended or archived.
- [x] Prevented candidate score exposure before an organisation manager publishes results.

- [ ] Derive the active organisation server-side for examination creation/listing; validate any selected organisation against authenticated membership.
- [ ] Add explicit permission checks for create, edit, publish, close, archive, assign candidates and release results.
- [ ] Enforce atomic state transitions for publish, submit and result release.
- [ ] Add deadline/timer enforcement on the server, including submission after expiry.
- [ ] Add tenant-scoped results reporting with pagination for candidates and attempts.
- [ ] Add organisation audit events for invitation, examination lifecycle, candidate assignment, submission and results publication.

**Done when:** cross-organisation access is impossible and all examination lifecycle transitions are server-enforced and auditable.

## Phase 5 — Platform Admin governance

- [ ] Replace remaining inline Super Admin workflow logic with governance services and typed policies.
- [ ] Ensure every privileged mutation requires a reason, confirmation and immutable audit event.
- [ ] Add pagination/filter validation for platform users, organisations and audit trails.
- [ ] Add audit context for lifecycle, ownership, role, session and settings actions without storing secrets.
- [ ] Verify final-active-platform-admin, self-demotion, self-suspension and self-session-revocation protections.
- [ ] Keep platform settings limited to operational defaults; secrets stay in Worker environment variables.

**Done when:** every Platform Admin action is protected, explainable through audit records and safe at scale.

## Phase 6 — Client server-state and UX

- [ ] Introduce TanStack Query keys that include organisation context, filters and pagination.
- [ ] Move data mutations to query mutations with targeted cache invalidation.
- [ ] Clear/invalidate organisation-scoped caches when active organisation changes.
- [ ] Add loading, empty, error and success states to all sidebar modules.
- [ ] Replace temporary browser prompts with shadcn dialogs/forms for ownership transfer and organisation editing.

**Done when:** client cache cannot show data from a previously active organisation and every mutation has clear feedback.

## Phase 7 — Operations and scheduled work

- [ ] Decide whether scheduled jobs are required for expired invitations, overdue examinations and retention checks.
- [ ] If required, implement a Worker-compatible scheduled entrypoint and cron service layer; do not call the app’s own HTTP endpoints.
- [ ] Add cron configuration in `wrangler.jsonc` only after the first concrete job exists.
- [ ] Add observability for failed background jobs without logging secrets or sensitive answers.

**Done when:** scheduled work is optional, explicit and independently testable.

## Verification matrix

- [ ] Anonymous requests cannot read protected route or server-function data.
- [ ] Standard users cannot call Platform Admin server functions.
- [ ] Organisation members cannot manage organisation/examination configuration.
- [ ] Owner/admin access is limited to their own organisation.
- [ ] Every tenant query, update and delete includes trusted `organizationId` scope.
- [ ] Every privileged platform mutation writes an immutable audit event.
- [ ] Local D1 migrations apply from an empty database and production migrations are reproducible.
- [ ] Build, lint, typecheck and focused integration tests pass before deployment.
