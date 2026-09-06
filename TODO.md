# Architecture implementation backlog

This backlog translates `ARCHITECTURE_D1.md` into safe, incremental work. Do not begin a later phase until its verification criteria pass.

## Completed work log

- [x] **2026-09-06 — PR #43:** Exported reusable inferred input types from examination, organisation, and Platform Admin Zod contracts.
- [x] **2026-09-06 — PR #42:** Converted all examination workflow failures to typed safe domain errors.
- [x] **2026-09-06 — PR #41:** Moved organisation-scoped examination creation into the examination repository.
- [x] **2026-09-06 — PR #40:** Added the first tenant-aware examination repository and moved managed examination lookup and organisation listing into it.
- [x] **2026-09-06 — PR #39:** Replaced Platform Admin list `any` casts with explicit client-safe list response types.
- [x] **2026-09-06 — PR #38:** Documented the D1 migration journal, table ownership, and protected server-function boundaries.
- [x] **2026-09-06 — PR #37:** Updated the Biome schema and applied safe lint fixes to establish a passing lint baseline.
- [x] **2026-09-06 — PR #36:** Replaced Platform Admin organisation browser prompts with shadcn value-and-reason dialogs.
- [x] **2026-09-06 — PR #35:** Added and locally verified D1 indexes for active examination, invitation, and membership query paths.
- [x] **2026-09-06 — PR #34:** Expanded the Drizzle schema to cover application-owned platform governance and examination D1 tables and indexes.
- [x] **2026-09-06 — PR #33:** Applied typed safe errors and target-existence checks across Platform Admin governance mutations.
- [x] **2026-09-06 — PR #32:** Applied typed not-found and invalid-state errors to organisation member and invitation management.
- [x] **2026-09-06 — PR #31:** Added typed safe domain errors for authorization and core examination lookup/input failures, with policy coverage.
- [x] **2026-09-06 — PR #30:** Added safe root loading/error/not-found states and documented local/remote D1 migration, backup, and recovery procedures.
- [x] **2026-09-06 — PR #29:** Improved Platform Admin list recovery: audit reset reloads current data, audit filtering is safely invoked, and users/organisations have clearable searches with safe loading errors.
- [x] **2026-09-06 — PR #28:** Added an empty search state to Platform Admin organisations.
- [x] **2026-09-06 — PR #27:** Added an empty search state to Platform Admin users.
- [x] **2026-09-06 — PR #26:** Excluded suspended and archived organisations from manager dashboard metrics and activity.
- [x] **2026-09-06 — PR #25:** Added server-side search to Platform Admin organisations.
- [x] **2026-09-06 — PR #24:** Hid examinations from candidate dashboards when their organisation is suspended or archived.
- [x] **2026-09-06 — PR #23:** Consolidated Platform Admin audit persistence onto the shared server-side audit writer.
- [x] **2026-09-06 — PR #22:** Allowed Platform Admin audit filtering by actor email as well as internal user ID.
- [x] **2026-09-06 — PR #21:** Refreshed the current Platform Admin organisations page after governance actions.
- [x] **2026-09-06 — PR #20:** Refreshed the current Platform Admin users page after access, session, or verification actions.
- [x] **2026-09-06 — PR #19:** Derived examination listing organisation scope from the authenticated active organisation.
- [x] **2026-09-06 — PR #18:** Added D1 indexes for audit action, actor, target, and chronological filtering. Verified the migration locally.
- [x] **2026-09-06 — PR #17:** Displayed safe audit context in Platform Admin audit records.
- [x] **2026-09-06 — PR #16:** Added actor and date filters to the Platform Admin audit interface.
- [x] **2026-09-06 — PR #15:** Added validated, bounded pagination for Platform Admin organisations.
- [x] **2026-09-06 — PR #14:** Added validated server-side search and pagination for Platform Admin users.
- [x] **2026-09-06 — PR #13:** Added validated, bounded pagination to Platform Admin audit trails with Previous and Next controls.
- [x] **2026-09-06 — PR #12:** Added immutable audit events for organisation invitations, member changes, removals, and profile updates. Protected owner roles from direct changes before ownership transfer.
- [x] **2026-09-06 — PR #11:** Added immutable audit events for examination creation, question changes, candidate assignment, lifecycle actions, and candidate submissions.
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

- [x] Inspect and document the current D1 schema, Better Auth tables, migration journal, server functions and route guards.
- [ ] Add a working `typecheck` script if TypeScript supports it cleanly.
- [x] Resolve the repository-wide Biome schema/version mismatch and establish a passing formatting/lint baseline.
- [x] Add route-level error and pending states for protected areas without exposing internal database errors.
- [x] Document local and remote migration commands, including rollback/recovery expectations.

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

- [x] Expand `src/db/schema.ts` to cover application-owned D1 tables: platform governance, examinations, questions/options, assignments, attempts and answers.
- [ ] Adopt one timestamp convention for application tables and migrate inconsistent application-owned timestamps safely.
- [ ] Create repository modules that always accept trusted `organizationId` for tenant-owned reads/writes.
- [ ] Move business workflows from `src/lib/*.functions.ts` into server-side services; keep server functions thin: validate → authorize → service → typed response.
- [ ] Use D1-compatible Drizzle queries and transactions/batches for multi-record operations.
- [x] Add or validate indexes for active query paths: organisation/status, organisation/created date, assignment/user, attempt/assignment and audit filters.

**Done when:** application database access is centralized through Drizzle repositories/services and every tenant query scopes `organizationId`.

## Phase 4 — Examination workflow hardening

**Completed in this phase so far:**

- [x] Added server-enforced lifecycle transition rules for publishing, closing, archiving, and releasing results.
- [x] Prevented candidates from starting or autosaving an attempt after an examination deadline.
- [x] Prevented candidate access, answer saving, and submission when an organisation is suspended or archived.
- [x] Prevented candidate score exposure before an organisation manager publishes results.
- [x] Added immutable audit events for core examination lifecycle and candidate-management actions.
- [x] Added immutable audit events for organisation membership, invitations, and profile management.

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
- [x] Replace temporary browser prompts with shadcn dialogs/forms for ownership transfer and organisation editing.

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
