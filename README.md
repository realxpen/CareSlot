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
