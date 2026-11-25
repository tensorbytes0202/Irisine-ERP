# Multi-tenant platform: Part 1 (backend foundation)

> **Updated 2026-11-26:** the platform owner is now the `IT_ADMIN` user whose email is listed in the API setting `PLATFORM_OWNER_EMAILS` (sign in with the IT Admin card, manage schools under `/it-admin/schools`). The separate platform login, the `create-platform-admin.ts` script and the `/platform` pages were removed; `platform_admins` is unused. Where this document says otherwise, this note wins.

Date: 2026-11-25. Scope: backend, database, authentication, authorization, school onboarding,
tenant isolation and feature entitlement. The four portal screens are Part 2.

## 1. How it works

```
Public school  --POST /platform-public/school-registrations-->  PENDING request (no account yet)
Platform owner --POST /platform/registrations/:id/approve {features}-->
      school ACTIVE + chosen features + first SUPER_ADMIN (unusable password) + one-time invite email
School admin   --POST /auth/accept-invite {token, password}--> sets own password, gets tokens
Everything after that is limited to: the user's own school  AND  the features granted to that school.
```

### Two levels, never mixed
| Level | Role | Where it lives |
|---|---|---|
| Platform | `PLATFORM_SUPER_ADMIN` | table `platform_admins`, its own login `POST /platform-public/login`, 1 hour token. Created only by the CLI script, never by an API or signup |
| School | `SUPER_ADMIN`, `IT_ADMIN`, faculty roles, `STUDENT`/`PARENT` | table `users`, always tied to one `schoolId` |

The four portals map onto the existing fine-grained roles (so the 80 existing `@Roles(...)` keep working):

| Portal | Roles |
|---|---|
| SUPER_ADMIN | SUPER_ADMIN, ADMIN |
| IT_ADMIN | IT_ADMIN |
| FACULTY | DIRECTOR, PRINCIPAL, ACADEMIC_COORDINATOR, CLASS_TEACHER, SUBJECT_TEACHER, ACCOUNTANT, TRANSPORT_MANAGER, HOBBY_COORDINATOR |
| STUDENT | STUDENT, PARENT |

`POST /auth/login` takes an optional `portal`. It is only a request: the server compares it with the role stored
in the database and answers 403 on a mismatch. The login response includes the real `portal`.

## 2. Database changes (additive only)

New models: `Feature`, `SchoolFeature`, `SchoolRegistrationRequest`, `AccountInvite`, `PlatformAdmin`
(plus the earlier `EmailOtp`, `PaymentOrder`, `PaymentWebhookEvent`).
New columns on `schools`: `city`, `state`, `country`, `website`, `status` (default `ACTIVE`, so existing schools
keep working). Nothing is dropped, truncated or rewritten.

Entitlement rule for a school and a feature:
`school ACTIVE` and `feature globally active` and `granted (enabled)` and
`(if adminManageable) adminEnabled`. No `school_features` row means no access.

Production SQL (apply in this order, after a backup, by you):
1. `packages/api/prisma/sql/2026-11-23_email_verified_and_payments.sql`
2. `packages/api/prisma/sql/2026-11-25_multi_tenant_platform.sql`

The second file is additive and **grants every existing school every module** (school admins cannot switch them), so
current schools see no change until you trim them.
Do not run `prisma db push` on production.

## 3. APIs

New (all under `/api/v1`):

| Route | Who | Purpose |
|---|---|---|
| `POST /platform-public/school-registrations` | public (5/hour/IP) | submit a registration request |
| `POST /platform-public/login` | public (5/min/IP) | platform owner login |
| `GET /platform/stats`, `/platform/features` | platform owner | overview, feature catalogue |
| `GET /platform/registrations[/:id]` | platform owner | list / read requests |
| `POST /platform/registrations/:id/approve` | platform owner | body `{ features: [{key, enabled, adminManageable?, config?}] }` |
| `POST /platform/registrations/:id/reject` | platform owner | body `{ reason }` |
| `GET /platform/schools[/:id]` | platform owner | schools with their features |
| `PATCH /platform/schools/:id/status` | platform owner | `ACTIVE`, `SUSPENDED`, `DEACTIVATED` |
| `PUT /platform/schools/:id/features` | platform owner | grant / remove / allow-admin-to-manage / config |
| `POST /platform/schools/:id/resend-invite` | platform owner | new invite for the school's first admin |
| `GET /school/features` | any school user | enabled modules, for navigation |
| `PATCH /school/features/:key` | SUPER_ADMIN, IT_ADMIN | switch a feature, only if granted AND `adminManageable` |
| `POST /auth/accept-invite` | public | `{ token, password }` first password |

Changed or removed:
- Removed: `POST /auth/register` (public signup) and the signup OTP purpose. Web: `/signup` page removed; added
  `/register-school` (request form) and `/accept-invite` (set password).
- `POST /auth/login`: optional `portal`, school must be ACTIVE (403 `SCHOOL_NOT_ACTIVE`), email lowercased.
- `POST /users`: `schoolId` in the body is ignored (always the caller's school); only a school SUPER_ADMIN can create
  admin roles; `PLATFORM_SUPER_ADMIN` can never be granted; password min 8. `GET/PATCH /users/:id` are school scoped.
- `POST /students`, `GET /students`, `GET /students/:id`: school scoped; ids of class/section/session are validated;
  a student sees only themselves, a parent only their children; new students get an invite instead of the old fixed
  password `student123`.
- Fees (`/fees/*`) and bulk operations (`/bulk/*`): school scoped. Bulk import used to match a class in ANY school.
- `grace-marks`, `remedial`, `result-workflow` were open to the internet (no login): now guarded and staff-only.

## 4. Where the checks live (one place each)

| Concern | Component |
|---|---|
| Is the account/school still active, current role | `JwtStrategy` (database check on every request) |
| Role | `RolesGuard` + `@Roles()` (existing) |
| Feature entitlement | `FeatureGuard` (global), table driven, route prefix to feature via `feature-catalog.ts` |
| Tenant ownership | `TenantService` (`classInSchool`, `studentInSchool`, `assertCanViewStudent`, ...) |
| Invites | `InvitesService` |

`FeatureGuard` returns 403 `{ code: 'FEATURE_NOT_ENABLED', feature }` and never deletes data.
New module: add its controller prefix to `feature-catalog.ts`, and it is gated automatically.
A school admin can never grant a feature: `adminToggle` only flips `adminEnabled` of a row the platform created.

## 5. Environment

See `.env.example`. New: `APP_URL` (invite links), `JWT_ACCESS_EXPIRES`, `PLATFORM_ADMIN_*` (CLI only),
`TEACHER_SEED_PASSWORD`. Removed: `ALLOW_SIGNUP`. No secrets in code; remaining dev defaults
(`mis_password`, `minioadmin`) exist only in `docker-compose.yml` and `.env.example` for the local containers.

## 6. Run it

```bash
cd packages/api
npx prisma generate
npx prisma db push                 # LOCAL database only
npx nest build

# create the platform owner once (never via API)
PLATFORM_ADMIN_EMAIL=owner@yourcompany.com PLATFORM_ADMIN_PASSWORD='a-strong-password' npx ts-node prisma/create-platform-admin.ts

node dist/main.js                  # http://localhost:4000, docs at /api/docs
```

Tests:
```bash
cd packages/api
npx jest                                                         # unit tests
npx jest --config ./test/jest-e2e.json test/multi-tenant.e2e-spec.ts   # multi-tenant e2e (needs the local DB, cleans up after itself)
cd ../web && npm test
```

## 7. Not done yet / known limits

- Tenant scoping is applied to users, students, fees, bulk operations and the 3 previously open controllers.
  About 40 other services (attendance, assessments, syllabus, timetable, admission, ...) still look records up by id
  only. They are protected by login, role and the feature guard, but NOT yet by a school check. Do these next, module by
  module, with `TenantService` (the pattern is in `students` and `fees`).
- Rows with a `schoolId` column are only 40 of 131 tables; the rest are tied to a school through class or user.
- The old e2e suite in `test/*.e2e-spec.ts` expects seeded demo data (`admin@irisine.demo`) that was removed, so it was not run.
- Access tokens last 7 days by default because the web app does not refresh tokens yet; the database check on every
  request makes suspension and role changes immediate anyway. Shorten with `JWT_ACCESS_EXPIRES` in Part 2.
- Production DB is untouched: the two SQL files above are waiting for your approval.
