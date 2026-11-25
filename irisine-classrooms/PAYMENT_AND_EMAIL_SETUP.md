# Payments (Razorpay) and Email OTP (Resend) setup

This guide covers the online fee payments and email one-time codes (OTP) in Irisine Classrooms.
Nothing here is activated for you: you create the accounts and paste the keys yourself.

**Keep test and live credentials apart.** Test keys start with `rzp_test_`, live keys with `rzp_live_`.
Never put live keys on a development machine, and never commit any `.env` file.

---

## 1. How it works

**Fees.** There is no separate "invoice" table in this project. An invoice is a *student + fee head*.
Outstanding amount = fee head amount - approved concessions - what is already paid or discounted.

1. A parent or student opens **My Fees** and presses **Pay Now** (they may type a smaller amount for a part payment).
2. `POST /api/v1/payments/create-order` recalculates the outstanding amount on the server, creates a Razorpay order and stores a `PaymentOrder` row.
3. Razorpay Checkout opens in the browser.
4. After payment, the browser calls `POST /api/v1/payments/verify`. The server checks the Razorpay signature (HMAC SHA256) and only then marks the order paid and creates the receipt (a row in the existing `payments` table, method `ONLINE`).
5. Razorpay also calls `POST /api/v1/payments/webhook`. It is signature checked and idempotent, so the same payment is never counted twice, even if verify and webhook both arrive.

**Email OTP.** Password reset uses a 6-digit code emailed through Resend (public sign-up no longer exists: schools register through an approval workflow, see MULTI_TENANT_PART1.md). Only an HMAC of the code is stored. A code lasts 5 minutes, allows 5 wrong tries, can be resent after 60 seconds, and a new code cancels the old one.

---

## 2. Razorpay (test mode)

1. Create an account at https://razorpay.com and sign in to the Dashboard.
2. Make sure the dashboard toggle (top of the page) says **Test Mode**.
3. Go to **Account & Settings -> API Keys -> Generate Test Key**.
   You get a **Key Id** (`rzp_test_...`) and a **Key Secret**. The secret is shown once, so save it now.
4. Put them in your API `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   ```
5. Payment capture: in **Account & Settings -> Payment Capture**, keep **Automatic capture** on, so successful payments are captured without manual steps.

### Webhook

1. Dashboard -> **Account & Settings -> Webhooks -> Add New Webhook**.
2. **Webhook URL:** `https://<your-api-domain>/api/v1/payments/webhook`
   (For local testing Razorpay cannot reach `localhost`. Use a tunnel such as `ngrok http 4000` and paste the `https://...ngrok...` URL.)
3. **Secret:** choose any long random string. Put the same value in `.env`:
   ```
   RAZORPAY_WEBHOOK_SECRET=the-same-random-string
   ```
4. **Active events:** enable these three:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
5. Save.

### Test payments

Use Razorpay's test cards and UPI ids from https://razorpay.com/docs/payments/payments/test-card-details/ .
No real money moves in test mode.

---

## 3. Resend (email)

1. Create an account at https://resend.com.
2. **API Keys -> Create API Key** (permission: *Sending access*). Copy it once.
3. **Domains -> Add Domain**, enter your domain (for example `yourschool.com`), then add the DNS records Resend shows you (SPF, DKIM, and optionally DMARC) at your DNS provider. Wait until the domain shows **Verified**.
4. Set in `.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=Irisine Classrooms <no-reply@yourschool.com>
   ```
   `EMAIL_FROM` must use the verified domain. For a quick first test, Resend allows `onboarding@resend.dev`, but only to your own account email.

If `RESEND_API_KEY` is empty, the app falls back to the old SMTP/log behaviour: in development the email text (with the code) is printed in the API console; in production nothing sensitive is logged and no email is sent. So **set the key before going live**.

---

## 4. Environment variables

Add to the API `.env` (see `.env.example` for the placeholders):

| Variable | Meaning |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | API keys (test or live, never mixed) |
| `RAZORPAY_WEBHOOK_SECRET` | Secret you typed into the Razorpay webhook form |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender, on a verified domain |
| `OTP_EXPIRY_MINUTES` | Default 5 |
| `OTP_RESEND_COOLDOWN_SECONDS` | Default 60 |
| `OTP_MAX_ATTEMPTS` | Default 5 |
| `OTP_SECRET` | Optional. Key for hashing codes. Defaults to `JWT_SECRET` |
| `APP_URL` | Public web address, used in invite links |

The frontend needs no payment keys. The public Key Id is sent to the browser by the server when an order is created.

---

## 5. Database

New tables are additive only (nothing is dropped or changed): `email_otps`, `payment_orders`, `payment_webhook_events`, plus one column `users.emailVerified` (default `true`, so existing users are unaffected; only new self sign-ups start unverified).

This project uses `prisma db push` (there is no migrations folder):

```bash
cd packages/api
npx prisma validate
npx prisma db push      # review the printed plan before confirming
npx prisma generate
```

Do the **local** database first. For production (TiDB Cloud) run the same `db push` yourself, once, after taking a backup. The app never runs migrations by itself.

The old `password_reset_tokens` table is no longer used by the code. It is left in place so nothing is destroyed; you can drop it later when you are sure.

---

## 6. Local testing

```bash
docker compose up -d mysql redis minio
cd packages/api && npx prisma db push && npx nest build && node dist/main.js
cd packages/web && npx next dev --port 3000
```

- Without `RESEND_API_KEY` emails (reset codes, invite links) are printed in the API console in development.
- Automated tests (no real emails or payments needed):
  ```bash
  cd packages/api && npx jest
  ```
- To try a payment end to end you need: Razorpay test keys, a class with a fee head, a student in that class, and a parent account linked to the student (a `guardians` row with `userId` set).

---

## 7. Production deployment checklist

1. Set all variables above on your host (for Render: Service -> Environment). Use **strong random** `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. Set `NODE_ENV=production`.
3. Run `npx prisma db push` against the production database once.
4. Set `CORS_ORIGIN` to your real web address.
5. Create the platform owner once with `prisma/create-platform-admin.ts` (see MULTI_TENANT_PART1.md).
6. Configure the Razorpay webhook with your public API URL and send a test event from the dashboard.
7. Verify your Resend domain and send yourself a password-reset code.

If your API runs behind a proxy (Render, Nginx), make sure it forwards the client IP so rate limits work per user, not per proxy.

## 8. Going from Razorpay Test Mode to Live Mode

1. Complete Razorpay's **KYC / account activation** in the dashboard. Live keys are not available until it is approved.
2. Switch the dashboard toggle to **Live Mode** and generate **Live API keys** (`rzp_live_...`).
3. Create a **new** webhook in Live Mode (webhooks are separate per mode), same URL and the same three events, with a new secret.
4. In production only, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` with the live values. Keep the test values only in your local `.env`.
5. Redeploy, then make one small real payment (for example Rs 1) and confirm the receipt and the transaction in **Online Payments**.
6. Never reuse a test order id or test key in production.

---

## 9. API reference

All routes are under `/api/v1`.

| Method and path | Who | Purpose |
|---|---|---|
| `POST /payments/create-order` | PARENT, STUDENT | Body `{ studentId, feeHeadId, amount? }` (amount in rupees, optional). Returns checkout data |
| `POST /payments/verify` | PARENT, STUDENT | Body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` |
| `POST /payments/webhook` | Razorpay | Signature checked, idempotent |
| `GET /payments/dues?studentId=` | any signed-in role with access | Fee breakdown: total, paid, pending, due day |
| `GET /payments/history?status=&studentId=` | parent/student: own children; staff: whole school | Transactions |
| `GET /payments/:id` | with access to that student | One order |
| `GET /payments/receipt/:id` | with access to that student | Receipt data for a paid order |
| `POST /auth/accept-invite` | public | Body `{ token, password }`. First password for an invited account |
| `POST /auth/send-otp`, `POST /auth/resend-otp` | public | Body `{ email, purpose: RESET }` |
| `POST /auth/verify-otp` | public | Body `{ email, otp, purpose: RESET }`. Returns a one-time `resetToken` |
| `POST /auth/forgot-password` | public | Same as send-otp with RESET |
| `POST /auth/reset-password` | public | Body `{ email, resetToken, newPassword }`. Signs the user out everywhere |

The OTP endpoints always answer the same way whether or not the email exists.
