# Irisine Classrooms: Complete Project Overview

> **Update 2026-11-25:** public signup was replaced by a multi-tenant platform (school registration requests, platform owner approval, per-school feature entitlement, tenant isolation). Where this file talks about signup, `ALLOW_SIGNUP` or `/auth/register`, read [MULTI_TENANT_PART1.md](MULTI_TENANT_PART1.md) instead.

*Smart classrooms, simple school management.*
Last updated: 2026-11-24

This file explains what the project is, how every part connects, which outside services it uses,
what is deployed where, and what is still left to do. Facts that I could not confirm from the code
are marked **(not confirmed)** instead of guessed.

---

## 1. What the product is

A multi-module school ERP / LMS: admissions, students, attendance, timetable, syllabus, assignments,
assessments, grading and report cards, LMS (course modules, live classes, discussions, learning paths),
fees and online payments, staff, leaves, communication, parent portal, and a lot more.

- Origin: a rebrand of the open-source **Globussoft Open School MIS** (licence **AGPL-3.0**).
  The `LICENSE` file and the README credit stay. The UI/code notice line was removed on the owner's request.
- Brand: **Irisine Classrooms**, emerald/light-green theme, Plus Jakarta Sans font.
- Size: **80+ API modules**, **80+ web pages**, **131 database models (tables)**, **11 user roles**.

## 2. Architecture at a glance

```
 Browser (parents, students, teachers, admins)
        |
        v
 Next.js 14 web app  (Render: irisine-web.onrender.com)  -- NEXT_PUBLIC_API_URL -->
        |
        v
 NestJS 10 API  (Render)  /api/v1/...   Swagger at /api/docs
   |        |         |             |                 |
   v        v         v             v                 v
 MySQL/   MinIO/S3  Resend        Razorpay        SMTP (nodemailer
 TiDB     (file     (email OTP    (fee payments,   fallback / log
 (Prisma)  uploads)  + mail)       webhook)         in dev)
```

- The browser talks to the API **directly** over HTTPS using `NEXT_PUBLIC_API_URL`
  (e.g. `https://<api>.onrender.com/api/v1`). The API allows only the origins listed in `CORS_ORIGIN`.
- The web app keeps the JWT access/refresh tokens and user info in `localStorage`.
- Razorpay calls the API's webhook endpoint directly (server to server).
- **Redis**: it is in `docker-compose.yml` and the README, but **no application code uses it** (no Redis
  client in the API). It is currently an unused extra. Treat it as optional / removable.

## 3. Repository layout

The Git repo is `tensorbytes0202/Irisine-ERP` (outer folder `schoolERP`, project in `irisine-classrooms/`).

```
irisine-classrooms/
  package.json, turbo.json        Turborepo + npm workspaces (packages/*)
  docker-compose.yml              local MySQL 8 (3308), Redis 7 (6381), MinIO (9000/9011)
  .env.example                    placeholders only (see security note, section 12)
  README.md
  PAYMENT_AND_EMAIL_SETUP.md      Razorpay + Resend step-by-step
  PROJECT_OVERVIEW.md             this file
  packages/
    api/      NestJS backend
      prisma/schema.prisma        the whole database (131 models)
      prisma/seed.ts              creates the first admin (needs ADMIN_SEED_PASSWORD)
      prisma/sql/                 hand-written, additive production SQL (see section 9)
      src/main.ts                 bootstrap: prefix /api/v1, validation, CORS, Swagger, rawBody
      src/app.module.ts           registers all modules
      src/modules/<name>/         controller + service + module + dto per feature
    web/      Next.js frontend
      src/app/(marketing)/        landing page, pricing, features
      src/app/login, signup, forgot-password
      src/app/(dashboard)/<feature>/page.tsx    one page per feature
      src/components/             auth-shell, otp-form, brand-logo, theme-toggle, ui/*
      src/lib/brand.ts            name, tagline, copyright text
      src/lib/features.ts         feature flags (show/hide modules)
      public/                     logo.svg, logo-icon.svg, hero-student.jpg
    shared/   shared constants, types, validators (@mis-ilsms/shared)
```

## 4. Tech stack and versions

| Area | Technology |
|---|---|
| API | NestJS 10, TypeScript 5, Prisma 5.22, class-validator, Swagger, Passport JWT, bcrypt, `@nestjs/throttler` 6 |
| Web | Next.js 14.2, React 18, Tailwind 3, Radix UI primitives, lucide-react, `next/font`, `next/image` |
| Database | MySQL 8 locally; TiDB Cloud (MySQL compatible) in production. Schema pushed with `prisma db push` (no migration history) |
| Files | MinIO via the `minio` SDK (S3 compatible), bucket `mis-uploads` |
| Email | Resend REST API (no SDK), falls back to `nodemailer` SMTP, then to console log in dev |
| Payments | Razorpay Orders API + Checkout JS (`https://checkout.razorpay.com/v1/checkout.js`) |
| Monorepo | Turborepo + npm workspaces, Node 20+ |
| Tests | API: Jest (40 tests). Web: Vitest + Testing Library (4 tests) |

## 5. Backend modules (grouped)

All routes live under `/api/v1`. Most are protected by `JwtAuthGuard` + `RolesGuard` with `@Roles(...)`.

- **Core:** auth, users, school-data, settings, audit, activity-log, search, dashboard
- **Students and admission:** students, admission, attendance, period-attendance, promotions,
  transfer-certificate, certificates, documents, discipline, health, student-leaves, academic-transition, alumni, id-cards
- **Academics:** syllabus, timetable, timetable-generator, substitutes, assignments, assessments, grading,
  exam-schedule, result-workflow, grace-marks, remedial, rubrics, teaching, performance-report, calendar, diary
- **LMS:** lms-content, course-modules, live-classes, learning-paths, discussions, gamification
- **Finance:** fees, fee-automation, concessions, expenses, payroll, transport-billing, **payments (Razorpay)**
- **Staff:** teacher-attendance, staff-directory, payroll
- **Communication:** communication, announcements, notifications, notification-triggers, message-log, email,
  meetings, surveys, feedback, grievances, events, gallery
- **Campus:** hostel, bus, library, inventory, visitors, room-booking, hobby
- **Infrastructure:** file-upload (MinIO), email, prisma
- **Reports and tools:** reports, analytics, compliance, bulk-operations, parent-portal

### Roles
`SUPER_ADMIN`, `ADMIN`, `IT_ADMIN`, `DIRECTOR`, `PRINCIPAL`, `ACADEMIC_COORDINATOR`, `CLASS_TEACHER`,
`SUBJECT_TEACHER`, `ACCOUNTANT`, `PARENT`, `STUDENT` (stored as a string in `users.role`, checked in code).
A school's first signup account is `SUPER_ADMIN` for **its own school only** (data is scoped by `schoolId`).

## 6. Web app (frontend)

- **Public:** `/` (landing with hero image), `/pricing`, `/features`, `/login`, `/signup`, `/forgot-password`.
- **Dashboard** (after login): sidebar built from role + feature flags, with pages for every module.
- **Feature flags** (`packages/web/src/lib/features.ts`): a module set to `false` disappears from the
  sidebar and its URL redirects to `/dashboard`. No code is deleted; flip to `true` to bring it back.
  Currently **ON**: dashboard, announcements, calendar, notifications, events, students, admission,
  attendance, classes, promotions, syllabus, timetable, assignments, assessments, exam-schedule, grading,
  report-cards, lms, course-modules, live-classes, learning-paths, discussions, fees, concessions, expenses,
  users, staff-directory, teacher-attendance, leaves, communication, diary, feedback, settings, audit.
  Currently **OFF**: hostel, bus, library, inventory, visitors, room-booking, id-cards, alumni, gallery, hobbies,
  payroll, reports, bulk-operations, compliance, surveys, meetings, grievances, and a few more.
  Keys not listed in the file default to ON (this is how My Fees and Online Payments are shown).
- **New pages in this phase:** `/my-fees` (parents/students pay), `/online-payments` (staff see transactions),
  `/receipt/[id]` (printable receipt).
- **Theme:** CSS variables in `globals.css` (emerald primary, mint accents, dark mode). Change colours there only.

## 7. Authentication and security design

1. **Login** (`POST /auth/login`): bcrypt check, returns an access JWT and a 7-day refresh token (stored in `refresh_tokens`).
   Refresh tokens are single use (rotated). Logout deletes them.
2. **Signup** (`POST /auth/register`): works only when `ALLOW_SIGNUP=true` (default **off**, fail closed).
   Step 1 stores nothing as an account: school name and names are saved with the emailed code. **The password is not stored.**
3. **Email OTP** (`POST /auth/verify-otp`): the password is sent together with the code. Only when the
   code is correct is the school + `SUPER_ADMIN` user created (inside one transaction), and tokens are returned.
   This blocks "pre-registration" takeover: whoever controls the inbox sets the password.
4. **OTP rules:** 6 digits from `crypto.randomInt`; only an HMAC-SHA256 is stored (key `OTP_SECRET` or `JWT_SECRET`);
   expires in 5 min; 5 wrong tries then locked; a new code cancels the old one; 60 s resend cooldown;
   the response never reveals whether an email exists (except signup, which returns 409 for an existing account).
5. **Forgot password:** code -> `resetToken` (10 min, single use) -> `POST /auth/reset-password`; all refresh tokens are revoked.
6. **Rate limits:** `@nestjs/throttler` globally 60/min on auth routes, stricter on OTP routes (e.g. verify 10/min).
7. **Validation:** global `ValidationPipe` with whitelist + forbidNonWhitelisted. Passwords: min 8, max 72.
8. **Webhook security:** Razorpay webhook uses the raw request body and an HMAC SHA256 signature compared in constant time.
9. **Email in production** never logs email bodies/codes.

## 8. Payments (Razorpay) flow

1. Parent/student opens **My Fees** -> **Pay Now** (full or part amount).
2. `POST /payments/create-order`: server recalculates the outstanding amount (fee head - concessions - already paid),
   in integer paise, creates a Razorpay order and a `payment_orders` row (`CREATED`).
3. Razorpay Checkout opens in the browser.
4. `POST /payments/verify`: signature of `order_id|payment_id` is checked, then the order becomes `PAID` and a normal
   `payments` receipt row (method `ONLINE`) is created. This is idempotent (conditional update, unique ids).
5. `POST /payments/webhook`: signature-checked, de-duplicated by `payment_webhook_events.eventId`; handles
   `payment.captured`, `payment.failed`, `order.paid`. If verify and webhook both arrive, money is counted once.
6. Read endpoints: `GET /payments/dues`, `/history`, `/receipt/:id`, `/:id`.
7. Access: only `PARENT`/`STUDENT` can create/verify, and only for their own linked student (via `guardians.userId`).

Status: built and unit-tested; **real checkout and webhooks have not been tested** (no keys were available).

## 9. Database

- Local: MySQL 8 in Docker, database `mis_ilsms`, port **3308**.
- Production: **TiDB Cloud**, schema `irisine` (MySQL protocol, port 4000).
- The project has **no `prisma/migrations` folder**. Schema changes are applied with `prisma db push`, which was
  never re-run on TiDB, so production lacks what was added later.
- Added in this phase (additive only):
  `users.emailVerified` (default true), tables `email_otps` (with `payload`), `payment_orders`, `payment_webhook_events`.
  Old `password_reset_tokens` is unused but kept.
- Production SQL: `packages/api/prisma/sql/2026-11-23_email_verified_and_payments.sql`
  (idempotent: `IF NOT EXISTS`, no DROP, no data change).
- Database was emptied locally earlier at the owner's request (no demo data). The local DB currently has no
  students/parents, which is why My Fees could not be tried with real data.

## 10. Environment variables

**API** (Render service / local `packages/api/.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | token signing, use long random values |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | server port, `production`, allowed web origin(s), comma separated |
| `ALLOW_SIGNUP` | `true` enables public signup (default off) |
| `ADMIN_SEED_PASSWORD` | needed only to run `prisma/seed.ts` |
| `RESEND_API_KEY`, `EMAIL_FROM` | email through Resend (sender must be on a verified domain) |
| `OTP_EXPIRY_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_SECRET` | OTP tuning (defaults 5 / 60 / 5 / JWT_SECRET) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | payments (test keys first) |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | MinIO/S3 uploads |
| SMTP settings | optional fallback if no Resend key |

**Web:** only `NEXT_PUBLIC_API_URL` (API base including `/api/v1`). It is baked in at build time, so changing it needs a rebuild.

## 11. Deployment: what is where

| Part | Location | State |
|---|---|---|
| Source code | GitHub `tensorbytes0202/Irisine-ERP`, branch `main`. Last pushed commit: "payment integration and email verification" | **Signup fix, OTP-at-verify flow, theme and docs after that are local only (not committed)** |
| Web | Render, `https://irisine-web.onrender.com` | Live; older build. Must redeploy |
| API | Render (own service; URL **(not confirmed)**) | Live; needs the latest code + env vars |
| Database | TiDB Cloud, schema `irisine` | Missing `emailVerified` + new tables (cause of the signup/login error) |
| File storage | **(not confirmed)** whether MinIO/S3 exists in production | Uploads may not work there |
| Redis | not used by code | nothing to deploy |
| Email | Resend | account/key/domain **not set up yet** on Render |
| Payments | Razorpay | keys and webhook **not set up yet** on Render |

Known production symptoms and their causes:
- `Sign up is disabled` -> `ALLOW_SIGNUP` not set on the API service.
- `column irisine.users.emailverified does not exist` -> TiDB migration not applied (section 9).
- `Password must be at least 8 characters` on the OTP screen -> old web build with new API (web must be redeployed too),
  or the page was refreshed on the OTP step (the form state with the password is gone; the screen now says so).

### Go-live checklist (in order)
1. Back up TiDB, run the SQL file from section 9 (SQL Editor, or `mysql` client). Verify with
   `SHOW COLUMNS FROM users LIKE 'emailVerified';`. Do **not** run `prisma db push` on production.
2. Clean `.env.example` (section 12), then commit and push (no tool attribution lines).
3. Set the API env vars (section 10) on Render; set `NEXT_PUBLIC_API_URL` on the web service.
4. Redeploy **API and web together**.
5. Resend: create account, API key, verify a domain, set `EMAIL_FROM`.
6. Razorpay (test mode): keys, webhook `https://<api>/api/v1/payments/webhook`, events
   `payment.captured`, `payment.failed`, `order.paid`, same secret as `RAZORPAY_WEBHOOK_SECRET`.
7. Test: signup -> email code -> verify -> login -> forgot password -> a test payment (Razorpay test cards).
8. For real money later: KYC, live keys, a new live webhook, and replace the three Razorpay variables (details in
   `PAYMENT_AND_EMAIL_SETUP.md`, sections 7 and 8).

## 12. Security notes and risks

- **`.env.example` holds real-looking Razorpay values** and the Razorpay lines are duplicated. The file is tracked by git.
  Empty them before committing; if they were ever pushed, regenerate the key in the Razorpay dashboard.
- Never commit `.env` files. Never mix `rzp_test_` and `rzp_live_` keys.
- `ALLOW_SIGNUP=true` lets anyone on the internet create a school. Switch it off when not needed.
- The web `next.config.js` has `ignoreBuildErrors: true`: the web has some existing TypeScript errors
  (fees, lms, promotions, users pages) that do not block the build but should be fixed.
- Behind a proxy (Render) the client IP must be forwarded, or rate limits apply per proxy rather than per user.
- AGPL-3.0: if you offer the modified software over a network, you must offer its source to the users.

## 13. Run and test locally

```bash
docker compose up -d mysql redis minio
cd packages/api && npx prisma db push && npx nest build && node dist/main.js     # http://localhost:4000, docs at /api/docs
cd packages/web && npx next dev --port 3000                                       # http://localhost:3000
```
- Local `.env` has `ALLOW_SIGNUP=true`. Without `RESEND_API_KEY` the OTP code is printed in the API console.
- Tests: `cd packages/api && npx jest`, `cd packages/web && npm test`.
- First admin without signup: set `ADMIN_SEED_PASSWORD` and run `npm run db:seed` (not run in this work).
- MinIO container currently restarts with "file access denied" locally (affects uploads only).

## 14. What is verified and what is not

Verified: API TypeScript build, 40 API unit tests, web production build, 4 web tests, and (before the last
signup change) an end-to-end local run of signup, OTP, login, forgot/reset password.

Not verified: real Razorpay checkout/webhooks, a real Resend email, the My Fees Pay Now screen with real data,
and the **new** OTP-at-verify signup flow in a real browser end to end.

## 15. Open decisions

- Which modules to remove for good (hostel, bus, library, etc. are only hidden by flags; Redis is unused).
- Whether public signup stays on in production.
- The teacher password in `seed.ts` is still hardcoded.
- Commit and push the pending work.
