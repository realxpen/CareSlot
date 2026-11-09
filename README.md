# CareSlot — Clinic Appointment Booking

**Koya Academy Cohort 4 · AI Automation Developer Assessment**

CareSlot is a Next.js + TypeScript web application and a PostgreSQL-backed JSON API for booking clinic appointments. It implements the Koya clinic-booking contract, including protected endpoints, persistent bookings, cancellation, concurrency protection, idempotency, pagination and rate limiting. The patient-facing website adds appointment history, doctor filtering and an **advisory** same-patient time-overlap warning.

**Repository:** https://github.com/realxpen/CareSlot  
**Official contract:** https://koyaacademy.com/assessment-api/openapi.json  
**Bundled contract:** [`docs/koya-openapi.json`](docs/koya-openapi.json)  
**Vercel project:** https://vercel.com/swifnatechnologyltd/careslot  
**Assessment submission:** https://tally.so/r/1WPoL4

> **Assessment project, not a production medical system.** Use synthetic patients and an isolated database. The shared assessment API key is not patient authentication. Never store actual health information in this demo.

## Contents

1. [What is implemented](#what-is-implemented)
2. [Requirements and project structure](#requirements-and-project-structure)
3. [Local setup (Windows / PowerShell)](#local-setup-windows--powershell)
4. [Use the website](#use-the-website)
5. [Six-doctor demo data](#six-doctor-demo-data)
6. [Patient overlap warning](#patient-overlap-warning)
7. [API contract and examples](#api-contract-and-examples)
8. [Testing](#testing)
9. [Deploy to Vercel](#deploy-to-vercel)
10. [Koya assessment handoff](#koya-assessment-handoff)
11. [Troubleshooting](#troubleshooting)
12. [Security and known limitations](#security-and-known-limitations)

## What is implemented

| Koya level | Functionality | Where |
|---|---|---|
| 1 | Reset slots; list available slots; create booking; retrieve booking; booking website | `/reset`, `/slots`, `/bookings`, `/bookings/:id` and `/` |
| 2 | `X-API-Key` required on **every** API request; input validation, trimming, lowercase email, past-slot rejection | API routes and `src/lib/http.ts` |
| 3 | Only one **confirmed** booking per slot, even under concurrent requests; cancel and free slot | `src/lib/booking.ts` and PostgreSQL unique partial index |
| 4 | `Idempotency-Key` replay/conflict handling; email-filtered booking history with cursor pagination | `/bookings` |
| 5 | Five booking attempts per email per rolling minute, including failures; sixth request gets `429` and `Retry-After` | `src/lib/booking.ts` |

**Additional website features:** search previous appointments by email, view confirmed/cancelled bookings, cancel from history after a browser/server restart, paginate history, filter slots by doctor, generate six-doctor test schedules and warn about overlapping appointments.

**Intentional compatibility decision:** the patient-overlap check is a **frontend advisory**, not a server-side rule. The Koya API must still accept two different available slot IDs for the same email, even when their times overlap; the frontend offers **Continue anyway (assessment)**. The server still strictly rejects two confirmed bookings of the **same slot**.

## Requirements and project structure

- Node.js **22 or newer**, with npm (a current LTS version is recommended). Node is needed for local Next.js, native `fetch`, test scripts and TypeScript stripping in the optional add-only seed script.
- Git, VS Code or another editor, and an internet connection for Neon.
- A **dedicated Neon PostgreSQL database** for this assessment. Prefer separate development and production branches/databases so destructive local tests cannot wipe deployed assessment data.
- A long, random booking API key of your own choosing.
- A GitHub account and Vercel account for deployment.

```text
CareSlot/
├── db/schema.sql                   # PostgreSQL tables, indexes and constraints
├── docs/koya-openapi.json          # Bundled assessment API contract
├── scripts/
│   ├── smoke.mjs                   # 37 API smoke checks (DESTRUCTIVE /reset)
│   ├── add-demo-doctors.mjs        # Adds 36 demo slots; no delete/reset
│   └── seed-conflict-demo.mjs      # Adds 3 overlap-specific test slots
├── src/
│   ├── app/
│   │   ├── page.tsx                # Booking and history UI
│   │   ├── globals.css             # Responsive styles
│   │   ├── reset/route.ts
│   │   ├── slots/route.ts
│   │   ├── bookings/route.ts
│   │   └── bookings/[id]/route.ts
│   └── lib/
│       ├── booking.ts              # Booking, idempotency and rate-limit logic
│       ├── db.ts                   # PostgreSQL connection / transactions
│       ├── http.ts                 # Authentication and JSON responses
│       ├── demo-slots.ts           # Six-doctor demo schedule generator
│       ├── patient-conflicts.ts    # UI advisory overlap calculation
│       └── types.ts
├── tests/                          # Non-destructive unit/structural tests
├── .env.example                    # Placeholder names only; safe to commit
└── .env.local                      # Your own secrets; gitignored; NEVER commit
```

## Local setup (Windows / PowerShell)

### 1. Clone or update the project

For a **new checkout**:

```powershell
git clone https://github.com/realxpen/CareSlot.git
cd CareSlot
npm.cmd ci
```

If you **already have CareSlot open**, run from its project directory:

```powershell
git switch main
git pull origin main
npm.cmd ci
```

`npm.cmd` is safe to use in PowerShell if running `npm` directly produces a PowerShell execution-policy error.

### 2. Prepare Neon PostgreSQL

1. Open https://console.neon.tech and create or select an **isolated CareSlot-only** project/database. Do **not** use a Hustle, Swifna or other production application's database.
2. For safest testing, use a dedicated development Neon branch/database distinct from production.
3. Open **SQL Editor**, choose the correct development database and run the **entire contents** of [`db/schema.sql`](db/schema.sql).
4. Verify the schema has created `slots`, `bookings`, `idempotency_results` and `booking_attempts`, together with their indexes.
5. Copy the Neon PostgreSQL connection string, preferably from the **Connect** panel with SSL enabled.

The application uses PostgreSQL for persistent state. There is no in-memory booking store and no automatic database migration on startup.

### 3. Configure local environment variables

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

If `.env.local` already exists, **do not overwrite it**. Edit it instead.

The local file must have these two variables:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_NEON_HOST/YOUR_DB?sslmode=require
BOOKING_API_KEY=YOUR_OWN_LONG_RANDOM_SECRET
```

Replace **both** placeholders with real values. The key is the same one you enter into the *local assessment website* and send privately to Koya for their API checks.

**Never** paste your real database URL or key in GitHub, screenshots, issues, README files, chat messages or public JavaScript. `.env.local` is covered by [`.gitignore`](.gitignore).

### 4. Start the website

```powershell
npm.cmd run dev
```

Open **http://localhost:3000**. Keep this terminal running. If you need to run another command, open a **second** PowerShell terminal in the same project directory.

When finished, stop Next.js with **Ctrl+C**.

## Use the website

1. **Step 01 — Connect:** Enter your `BOOKING_API_KEY` and select **Connect**. It is held in browser `sessionStorage` for that tab/session; the key is **not embedded** in the shipped frontend. The backend checks `X-API-Key` on every request.
2. **Step 02 — Choose:** Browse available appointment slots, optionally **Filter by doctor**, and select a time. Booked slots cannot be selected.
3. **Step 03 — Confirm:** Enter the patient's test name and email and select **Confirm appointment**. A successful booking creates a persistent record and confirmation reference.
4. **Step 04 — My appointments:** Enter the same email under **Find my appointments**. You can see prior confirmed and cancelled bookings, load more results (five at a time) and cancel a confirmed booking. Cancelling frees the associated slot.
5. **Refresh/restart:** A saved booking remains in Neon after a browser refresh or Next.js restart. Reconnect with the key if needed and look up the same email.

The lookup requires **the shared assessment API key and the email address**; it is **not a secure patient login**. Do not expose this to real patients or use real medical records.

### Rescheduling

There is **no reschedule API endpoint** in Koya's specification. For this demo, cancel the existing booking and then choose another available time. This is not an atomic production-grade reschedule workflow.

## Six-doctor demo data

The website's demo generator creates **36 synthetic slots**: **6 doctors × 2 daily times × 3 future dates**, with 30-minute appointments shown in **West Africa Time (WAT, UTC+01:00)**.

| Demo doctor | Daily times (WAT) |
|---|---|
| Dr Ade | 9:00 AM, 1:00 PM |
| Dr Okafor | 9:15 AM, 1:15 PM |
| Dr Hassan | 9:30 AM, 1:30 PM |
| Dr Balogun | 10:00 AM, 2:00 PM |
| Dr Nwosu | 10:30 AM, 2:30 PM |
| Dr Ibrahim | 11:00 AM, 3:00 PM |

The deliberately overlapping times allow you to demonstrate conflict warnings. The doctors are **fictional demo entries**, not a real clinic's availability.

### Safe option: add slots without deleting existing bookings

**Development database only.** With `.env.local` pointing to your isolated development database:

```powershell
node --experimental-strip-types --env-file=.env.local scripts/add-demo-doctors.mjs --yes
```

This script inserts missing `demo-v2-...` slots and uses `ON CONFLICT (id) DO NOTHING`. It does **not** delete or replace existing appointments. Refresh the page, select **Refresh** in Step 01, and choose **All doctors** in the filter. If older doctors/slots exist, the total may be **more than 36**. The script generates dates relative to when you run it; running it on later dates may add newer slots.

### Destructive option: replace all demo slots

The site's **Create demo slots / Reset demo slots** action calls the contract-required **`POST /reset`**.

**WARNING: `/reset` deletes every booking and replaces the entire slots collection, including historical demo slots.** Only use it on a disposable assessment database whose contents you intend to replace. Do not use it simply to show the new six doctors if you want to preserve past bookings.

## Patient overlap warning

Before booking through the website, CareSlot loads the test email's **entire paginated booking history** from the existing authenticated `GET /bookings?email=...` endpoint, then compares confirmed booking times against the selected slot.

Overlap means:

```text
newStart < existingEnd AND newEnd > existingStart
```

- **9:00–9:30 and 9:15–9:45:** overlap → website warns.
- **9:00–9:30 and 9:30–10:00:** back-to-back → no time overlap.
- **Cancelled appointments:** ignored for the overlap advisory.
- **Different days:** no overlap.
- If history lookup fails, the website warns that it cannot check, rather than silently treating history as empty.

The warning offers **Choose another time** and **Continue anyway (assessment)**. This is intentional: Koya's backend API rules and expected status codes must remain unchanged. The frontend warning is **not a concurrency-safe enforcement guarantee**, and it does not prevent other clients from calling the API directly.

### Optional focused conflict demo

The regular six-doctor schedule already contains overlapping times. If you need a smaller three-slot demonstration, on an **isolated development database only** run:

```powershell
node --env-file=.env.local scripts/seed-conflict-demo.mjs --yes
```

The script **adds**, without resetting, three slots around 9:00 AM, 9:15 AM and 9:30 AM WAT. Use a synthetic test email to book 9:00, try 9:15 (warning), then 9:30 (no overlap).

## API contract and examples

**API base URL:** the application root, for example `http://localhost:3000` locally or the root HTTPS hostname of your verified Vercel deployment. Routes are **not** under `/api`.

| Method | Endpoint | Purpose | Expected success |
|---|---|---|---|
| `POST` | `/reset` | Replace all slots and remove all bookings | `200` |
| `GET` | `/slots` | List slots (earliest start first); optional exact `?provider=...` | `200` |
| `POST` | `/bookings` | Create a confirmed booking | `201` |
| `GET` | `/bookings/{id}` | Retrieve booking by ID | `200` |
| `DELETE` | `/bookings/{id}` | Cancel booking, free slot | `200` |
| `GET` | `/bookings?email=...` | Email booking history; `limit` (1–50, default 10), `cursor` | `200` |

**Every endpoint requires `X-API-Key`.** Errors are JSON shaped as `{"error":"message"}`.

Important failure cases:

| Response | Meaning |
|---|---|
| `400` | Invalid/missing booking details, started slot, invalid pagination |
| `401` | Missing or incorrect API key |
| `404` | Unknown slot or booking |
| `409` | Slot already has a confirmed booking; cancelling an already cancelled booking |
| `422` | Same `Idempotency-Key` sent with a different request body |
| `429` | Sixth same-email booking attempt within a minute; includes integer `Retry-After` header |

Booking emails are trimmed and lowercased; names are trimmed. Five **attempts**, including failed attempts, are permitted per email in a rolling minute. Booking operations are transactional, and the PostgreSQL partial unique index prevents two concurrent confirmed bookings from sharing one slot. Replaying an identical request with an identical optional `Idempotency-Key` returns the original response and booking ID.

### Read-only PowerShell API checks

Keep the local server running in one terminal. In another terminal in the project folder, run:

**Unauthenticated access must return 401:**

```powershell
node -e "fetch('http://localhost:3000/slots').then(r=>console.log('HTTP:',r.status))"
```

**Authenticated slot listing (uses the key from `.env.local` without printing it):**

```powershell
node --env-file=.env.local -e "fetch('http://localhost:3000/slots',{headers:{'X-API-Key':process.env.BOOKING_API_KEY}}).then(async r=>console.log(r.status,await r.json()))"
```

**Booking history for a test email:**

```powershell
node --env-file=.env.local -e "fetch('http://localhost:3000/bookings?email=ada@example.com',{headers:{'X-API-Key':process.env.BOOKING_API_KEY}}).then(async r=>console.log(r.status,await r.json()))"
```

Replace `ada@example.com` with the test email you booked under. `200` with `bookings: []` is a successful query with **no matches**, not a failure.

## Testing

### Non-destructive checks (run anytime)

```powershell
npm.cmd test
npm.cmd run build
```

- `npm.cmd test` runs the repository's unit/structural checks, including demo-schedule and patient-overlap logic.
- `npm.cmd run build` verifies a production Next.js build and TypeScript checking.
- These checks do **not** intentionally reset the Neon database.

### Destructive 37-check API smoke test (disposable database only)

**DO NOT run this against production or a database whose bookings you wish to keep.** `scripts/smoke.mjs` starts by calling **`POST /reset`**, which deletes existing bookings and replaces slots.

1. Point `.env.local` and the running local server to a **disposable development database**.
2. Start the local server with `npm.cmd run dev`.
3. In a second terminal, run:

```powershell
node --env-file=.env.local scripts/smoke.mjs
```

The script tests authentication, reset/listing, validation, lookup, concurrency, cancellation, idempotency, pagination, email rate limiting and `Retry-After`. A successful run reports `PASS: 37 checks`. It tests the **running server** and the database configured on **that server**, not a hidden copy of the assessment grader. Restart your server after changing `.env.local`.

You can also point it at a disposable HTTPS deployment by supplying `API_BASE_URL`, **but never run the reset-based smoke test against the submission database**.

### Manual UI regression checklist

1. Book a slot and confirm its status changes from available to booked.
2. Refresh the page, then restart Next.js. Retrieve the booking from **My appointments** using the same test email.
3. Cancel it from booking history; verify **cancelled** is shown and the slot becomes available.
4. Use the same test email for different doctors at non-overlapping times; both should book.
5. Test Dr Ade at 9:00 followed by Dr Okafor at 9:15 on the same date: the UI should warn; Dr Hassan at 9:30 should not overlap the 9:00 booking.
6. Use the **Filter by doctor** control, then return to **All doctors**.
7. Check mobile layout, API-key error handling and booking history pagination.

## Deploy to Vercel

The repository is linked to the **CareSlot** Vercel project under the configured Vercel account. If rebuilding the project from scratch, import **https://github.com/realxpen/CareSlot**, set framework to **Next.js**, root directory to the repository root, and production branch to **`main`**.

1. Push committed changes to GitHub. **Do not commit `.env.local`.**
2. In the Vercel project, open **Settings → Environment Variables**.
3. Add `DATABASE_URL` and `BOOKING_API_KEY` as **sensitive** variables for **Production** (and Preview only if you have a safe separate preview database/key). Apply `db/schema.sql` to the chosen production database first.
4. Deploy or **redeploy after changing variables**; existing builds do not automatically pick up new values.
5. Wait until the latest **production** deployment is marked **Ready**, and verify the correct GitHub commit is deployed.
6. Check that the public production alias is accessible in an **incognito browser** without Vercel login. Review project Deployment Protection/SSO settings if it is blocked.
7. Open the homepage and connect using the *matching production* API key. Confirm `GET /slots` works; use test-only slots/bookings to verify booking, cancellation and persistence.
8. Verify both the **API base URL** and webpage URL, using the same root HTTPS hostname (without `/slots` or `/api` added). The actual public hostname is whatever Vercel shows as the active production domain.

**Caution:** Vercel Hobby accounts can temporarily reject redeployments after hitting a deployment quota. If a redeploy is blocked, do not assume the old Ready deployment has the latest environment settings or code. Retry when the restriction clears or use a supported alternative host. Do not submit an unverified site.

**Data safety:** the website's reset action and `scripts/smoke.mjs` are destructive. Avoid both on a live assessment database once you have prepared data for Koya to review.

## Koya assessment handoff

Before submission, confirm the currently required fields/deadline on https://tally.so/r/1WPoL4. The Cohort 4 assessment instructions previously specified a **Sunday, 15 November 2026** deadline and a **Loom video of up to 5 minutes**; follow the latest instructions shown in your own assessment form.

Submit/prepare:

- [ ] Verified public **HTTPS API base URL** (root hostname, not an individual endpoint).
- [ ] **Booking API key**, provided only through Koya's private submission field.
- [ ] Verified public **website URL** (can be the same hostname as the API).
- [ ] GitHub repository: https://github.com/realxpen/CareSlot
- [ ] Loom demonstration link with appropriate access permissions.
- [ ] Public site reachable without Vercel sign-in; correct production environment variables; no unexpected errors.
- [ ] Repository and deployed version are in sync; do not reset or break the deployment after submission.

Suggested Loom walkthrough (about 4–5 minutes):

1. **0:00–0:30:** Introduce CareSlot and show the working HTTPS page.
2. **0:30–1:30:** Connect as assessment reviewer, filter six doctors, select and confirm a booking.
3. **1:30–2:15:** Show **My appointments**, refresh/retrieve history, then cancel and show the slot freed.
4. **2:15–3:00:** Demonstrate the **overlap warning**, explaining that the override is intentional for API contract compatibility.
5. **3:00–4:00:** Show protected API responses, `Idempotency-Key`, pagination and the PostgreSQL double-booking constraint (without showing secrets).
6. **4:00–4:45:** Briefly show tests/GitHub/deployment and close.

## Troubleshooting

| Symptom | What to check |
|---|---|
| PowerShell says `npm.ps1 cannot be loaded` | Use `npm.cmd ci`, `npm.cmd test`, `npm.cmd run dev` or `npm.cmd run build`. |
| `ECONNREFUSED` / site won't open | Start `npm.cmd run dev` and ensure it is listening on the URL/port you are testing. |
| `401` from an API endpoint | Ensure the `X-API-Key` header matches the key configured on **that server**; reconnect if you changed the key. |
| `500 {"error":"internal server error"}` | Inspect the **server terminal / Vercel function logs** for `Booking API error:`. Check the connection string, Neon availability and that the schema was applied. Do not share raw secrets. |
| `200 {"bookings":[],"next_cursor":null}` | Successful request, but no booking matches that email. Verify spelling/case and whether a reset erased earlier records. |
| `409` when booking | Slot already has a confirmed booking. Select another slot or cancel the existing booking. |
| `429` when booking repeatedly | The same email has exceeded five attempts within a rolling minute. Wait for the `Retry-After` interval; failed bookings also count. |
| Only three doctors show up | The database still has older demo slots. Pull latest `main`, then add new slots using the **development-only add-only script**, refresh, and select **All doctors**. |
| Changes on GitHub are not on the website | A Git push does not update local code; run `git pull origin main`. A production website needs a successful Vercel deployment of the newest commit. |
| Vercel redeploy blocked by quota | Wait until your plan's quota permits a fresh deployment; an old Ready deployment is **not** proof the new commit or env vars are active. |
| Booking appears gone after server restart | Search **My appointments** with the same email; check that the server is connected to the same Neon database as before and that no reset ran. |
| `node` cannot import `.ts` in the add-only script | Check Node.js version (`node --version`) and run the exact documented `--experimental-strip-types` command. |

## Security and known limitations

- The **Koya API key** secures the assessment endpoints; it is not a patient-specific credential. The browser temporarily holds the key in `sessionStorage` and includes it in request headers, so enter it only in a trusted testing browser.
- The **My appointments** email lookup does **not** verify email ownership. In a real healthcare application, implement a proper patient identity and authorization system before allowing booking history access or cancellations.
- Frontend overlap warnings are **advisory**. Enforcing patient-level no-overlap across concurrent API clients would require a separate atomic server/database rule, which was deliberately **not added** because it would change Koya's expected behavior.
- The API does not implement a rescheduling endpoint, reminders, real doctor calendars, medical records or role-based clinic administration.
- Demo doctors, slots and names are synthetic. **Never store real patient medical data** in the assessment environment.
- `/reset` and the smoke test delete existing booking records; use only deliberately disposable databases for destructive checks.
- Do not commit credentials, print environment values into logs, embed `BOOKING_API_KEY` in a public bundle or publish Neon connection strings.

---

**Source of truth:** the [Koya OpenAPI specification](docs/koya-openapi.json) governs the API contract. The expanded user interface and demo tooling must not break that contract.
