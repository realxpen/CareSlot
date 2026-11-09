# CareSlot — Koya Academy Cohort 4 clinic booking assessment

A full-stack Next.js + TypeScript + Neon PostgreSQL application implementing the [official assessment API specification](https://koyaacademy.com/assessment-api).

## Features

- **Level 1:** `POST /reset`, `GET /slots`, `POST /bookings`, and `GET /bookings/{id}`; available slots and a patient-facing web page.
- **Level 2:** `X-API-Key` authentication on *every API request*, trimming/lowercasing/validating booking details, rejecting past slots.
- **Level 3:** atomic slot booking with `SELECT ... FOR UPDATE` and a **PostgreSQL partial unique index** to guarantee at most one confirmed booking for each slot; cancellation frees the slot.
- **Level 4:** `Idempotency-Key` with request-body fingerprinting and transaction-level locks, cursor pagination for patient bookings.
- **Level 5:** email-scoped rolling one-minute rate limiting, counting failed attempts and sending `Retry-After` on HTTP 429.

> Review requirements against the official OpenAPI spec before submission. This project has not been integration-tested against your Neon database or deployed until you complete the steps below.

## Setup on Windows (PowerShell)

1. Create a **new, isolated Neon PostgreSQL database** at https://console.neon.tech. Do not reuse any production Hustle database or credentials.
2. In Neon's SQL Editor, run the contents of **`db/schema.sql`**. This sets up persistence and the database-level double-booking safety constraint.
3. In this project folder:
   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```
   Replace the placeholder database connection string and `BOOKING_API_KEY` (generate a long random value; use a different key from Positionstack).
4. Install dependencies and run the app:
   ```powershell
   npm install
   npm run dev
   ```
5. Open http://localhost:3000, paste your assessment booking API key in the **Booking API key** field and click **Connect**. Then choose **Create demo slots** (this calls `/reset` and clears all existing bookings), book a slot and verify the confirmation.

## Six-doctor demo schedule

CareSlot's demo generator now creates **36 appointments** (six doctors × two times × three future days), with 30-minute slots shown in Lagos time (WAT). The timing intentionally includes overlapping appointments across doctors.

| Doctor | Daily WAT times |
|---|---|
| Dr Ade | 09:00, 13:00 |
| Dr Okafor | 09:15, 13:15 |
| Dr Hassan | 09:30, 13:30 |
| Dr Balogun | 10:00, 14:00 |
| Dr Nwosu | 10:30, 14:30 |
| Dr Ibrahim | 11:00, 15:00 |

The website now has a doctor filter. This affects demo data only; the assessment API contract is unchanged.

**Pulling the code does not automatically change existing database slots.** Clicking "Reset demo slots" calls Koya's mandatory `POST /reset`, which deletes all bookings. To add the new doctor times without resetting existing bookings, use the optional **add-only** script *only on an isolated development database*:

```powershell
node --experimental-strip-types --env-file=.env.local scripts/add-demo-doctors.mjs --yes
```

It inserts missing `demo-v2-...` slots without deleting or overwriting existing data. Refresh CareSlot afterward. Do not run this against a real clinic or production database.

## Patient appointment overlap advisory (assessment-safe)

The website checks whether an email already has a **confirmed** appointment whose time interval overlaps a selected slot. It uses the existing authenticated `GET /bookings?email=...` API (including cursor pagination) and compares its confirmed booking slot times against `GET /slots`. Two appointments that meet exactly at the boundary (e.g. 09:00–09:30 and 09:30–10:00) are permitted; cancelled bookings do not count.

The website shows a warning rather than silently booking a conflicting slot. For assessment compatibility, it also offers **Continue anyway (assessment)**. **No server-side behavior or endpoint is changed.** Koya's automated tests can continue to book different slot IDs, and PostgreSQL still blocks double-booking the same slot. This client-side preflight is advisory, not concurrency-safe enforcement: another booking can happen between the lookup and the POST.

For a manual overlap demo, use **only an isolated development Neon database**, then run:

```powershell
node --env-file=.env.local scripts/seed-conflict-demo.mjs --yes
```

The script adds three uniquely identified demonstration slots **without resetting or deleting existing bookings**: 09:00–09:30, 09:15–09:45 (overlapping), and 09:30–10:00 (back-to-back), all on a future date in Lagos time. Book the first with a test email; try the second with that same email to see the warning, then the third to confirm adjacent slots are allowed. The warning includes an explicit assessment-only override. Do not run this against production or a real patient database.

## Manual booking persistence and history test (no reset)

**Use the development database, not production.** Unlike the destructive smoke test, these steps preserve existing bookings:

1. Start the local app with `npm run dev` and connect using `BOOKING_API_KEY` on http://localhost:3000.
2. Create a booking using a test email and note its slot, status, and reference.
3. Find **Step 04 — My appointments**, enter the same email, and click **Find my appointments**. Confirm the record appears as **confirmed**.
4. Stop Next.js with **Ctrl+C**, then restart using `npm run dev`. Reload the page, reconnect if necessary, and search the same email.
5. Verify that the booking **still exists**. It is in PostgreSQL, not browser memory.
6. Click **Cancel appointment** on the history item, confirm the action, and check the status becomes **cancelled** and its slot is available again.
7. Restart the server again and search the same email; the cancelled history record should still be listed.
8. Optional: create six bookings for the same email across different slots to test **Load more appointments** (five per page).

This is an assessment demonstration. Because the API uses a shared reviewer key and email-only lookup, **do not treat it as patient authentication or use real patient records**. Koya does not ask for a reschedule endpoint, so use cancellation followed by a new booking if you need to change slots.

## Manual API check (PowerShell)

```powershell
$apiKey = "PASTE_YOUR_OWN_BOOKING_API_KEY"   # Do not commit it
$headers = @{ "X-API-Key" = $apiKey }
$start = (Get-Date).ToUniversalTime().AddDays(3).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().AddDays(3).AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
$body = @{ slots = @(@{ id="s1"; provider="Dr Ade"; start=$start; end=$end }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:3000/reset -Method Post -Headers $headers -ContentType "application/json" -Body $body
Invoke-RestMethod http://localhost:3000/slots -Headers $headers
$booking = @{slot_id="s1"; name="  Ada Obi  "; email="  ADA@EXAMPLE.COM "} | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/bookings -Method Post -Headers $headers -ContentType "application/json" -Body $booking
```

**Warning:** `/reset` deletes all bookings. It exists because the Koya assessment contract explicitly requires it. Do not click the demo reset after final submission unless the reviewer instructs you to.

## Deploy to Vercel

1. Push the project to a new GitHub repository (e.g. `realxpen/koya-clinic-booking`). Confirm `.env.local` is not staged.
2. Import that GitHub repository on Vercel and use the **Next.js** framework preset.
3. Configure environment variables `DATABASE_URL` and `BOOKING_API_KEY` for Production (use the same dedicated Neon database and a unique key).
4. Deploy. Your submission **API base URL** and **webpage URL** can both be the root URL of the deployment, e.g. `https://your-project.vercel.app`. API paths are directly under the root (`/slots`, `/bookings`, `/reset`).
5. Open the live site, enter your booking API key, seed demo slots once, book and cancel, verify the booking persists after refresh.
6. Submit your API URL, API key, webpage URL, GitHub URL and **actual Loom recording** (5 minutes max). Keep it running and unchanged after submission.

## Security notes

- `BOOKING_API_KEY` and `DATABASE_URL` must **never** be committed to GitHub. `.env.local` is gitignored.
- The web UI asks for the API key at runtime and stores it only in browser `sessionStorage`; the key is **not** baked into publicly served JavaScript or HTML. Only give the key to Koya and to trusted reviewers.
- This is an assessment demo, **not** a production medical record system. Do not collect real patient health information.

## API and test overview

The server implements: `POST /reset`, `GET /slots`, `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `DELETE /bookings/:id`. The browser UI is at `/`.

For a final check, try: missing/wrong key → 401; invalid input → 400; missing slot → 404; occupied slot → 409; past slot → 400; cancelled slot rebook → 201; reused idempotency key with changed body → 422; pagination with next_cursor; sixth same-email booking attempt inside 60 seconds → 429. Test simultaneous booking requests to verify only one confirms.

## Loom outline (4–5 minutes)

1. (0:00–0:30) Explain what the app solves and show the deployed URL.
2. (0:30–1:30) Enter key, view slots, book and show confirmation; cancel to free a slot.
3. (1:30–2:30) Show `/slots` and `/bookings` in the API, including authentication and validation.
4. (2:30–3:30) Explain the DB `only_one_confirmed_booking_per_slot` index, row lock and idempotency behavior.
5. (3:30–4:30) Show GitHub repo, schema, Neon persistence, and deployment; briefly mention rate limiting.
