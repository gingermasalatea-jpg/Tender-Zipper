# Tender Zipper — Phase 1 (MVP)

**Post once. Get verified quotes. Compare side by side. Zero commission.**

Buyers (flats, societies, offices) post a *tender card*. Matching vendors in that area get notified and send structured quotes. The buyer compares them line by line, shortlists up to 3 (which unlocks contact details on both sides) and awards one. A work order PDF is generated, and buyer and vendor then deal directly.

## What's in Phase 1

| Area | Included |
|---|---|
| Auth | Mobile OTP (+ email OTP fallback) via Supabase Auth |
| Onboarding | Buyer or vendor; vendors pick services + city + pincodes; switch roles any time |
| Buyer | Post-a-tender wizard with smart category forms, photos, hidden budget, deadline · My tenders · Side-by-side comparison · Shortlist (max 3) · Award · Close early / cancel |
| Vendor | Tender feed (only matching category + area) · Quote builder pre-filled from the buyer's answers (e.g. 1,200 sq ft) · Drafts, revise until deadline, withdraw · My quotes with quoted → shortlisted → won stats · Profile & KYC uploads |
| Work order | Web view + downloadable PDF, "mark job complete" |
| Admin (`/admin`) | Dashboard numbers · KYC review (verify/reject → "Verified" badge) · Suspend vendors · Flag/cancel tenders · Category on/off · Template editor with live preview · Add sub-categories |
| Notifications | In-app bell for every event + optional email via Resend (cron) |
| Categories live at launch | Flat & House Painting, Electrical & Wiring, Plumbing, Housekeeping, Security Guards, Furniture Supply (10 more seeded, hidden until you add templates) |

Privacy rules are enforced in the database, not just the UI. Vendors never see the buyer's identity, phone or exact address until shortlisted. Vendors never see each other's quotes. Totals are always recomputed on the server. A tender stops at its quote cap.

## Tech stack

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS · Supabase (Postgres + RLS, Auth, Storage) · pdf-lib · Resend · Vercel (hosting + cron).

```
app/
  page.tsx                     Landing page
  login/                       OTP login
  (app)/onboarding/            Buyer / vendor setup
  (app)/buyer/                 My tenders, post tender wizard, compare & award
  (app)/vendor/                Feed, quote builder, my quotes, profile & KYC
  (app)/work-orders/[id]/      Work order view
  (app)/notifications/
  (app)/admin/                 Overview, KYC, tenders, categories & template editor
  actions/                     Server actions (tenders, quotes, vendor, admin, profile)
  api/work-orders/[id]/pdf/    PDF download
  api/cron/                    close-tenders, send-emails
components/                    UI kit, DynamicForm, CompareTable, AppShell …
lib/                           Supabase clients, types, validation, formatting
supabase/
  migrations/                  Schema, RLS policies, business-logic functions, storage
  seed.sql                     Cities, categories, 6 launch templates
  tests/phase1_flow_test.sql   End-to-end database test (44 checks)
```

## Setup (about 20 minutes)

### 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → New project → choose the **Mumbai (ap-south-1)** region.
2. Open **SQL Editor** and run these files in order (copy, paste, Run):
   1. `supabase/migrations/20261113000001_phase1_core.sql`
   2. `supabase/migrations/20261113000002_storage.sql`
   3. `supabase/seed.sql`

   (Or with the Supabase CLI: `supabase link` → `supabase db push` → run `seed.sql`.)

### 2. Turn on login
**Authentication → Providers**
- **Phone:** enable it and connect an SMS provider. Built-in options are Twilio, MessageBird, Vonage and Textlocal. To use **MSG91**, enable a *Send SMS hook* (Authentication → Hooks) that calls MSG91's OTP API. Indian SMS needs DLT-registered templates.
- **Email:** keep it enabled (useful for testing). In *Email Templates → Magic Link*, make sure the template contains `{{ .Token }}` so users get a 6-digit code.
- For local testing without SMS, add test numbers under *Phone → Test OTPs* (e.g. `919800000001=123456`).

**Authentication → URL Configuration:** set Site URL to your domain (e.g. `https://tenderzipper.in`).

### 3. Run locally
```bash
npm install
cp .env.example .env.local      # fill in the Supabase URL + keys
npm run dev                     # http://localhost:3000
```

### 4. Make yourself admin
Log in once, then run in the SQL Editor:
```sql
update public.profiles set is_admin = true where phone = '91XXXXXXXXXX';   -- Supabase stores phone without "+"
```

### 5. Deploy to Vercel
1. Push the folder to GitHub → import it in Vercel.
2. Add the environment variables from `.env.example` (including `SUPABASE_SERVICE_ROLE_KEY` and a long random `CRON_SECRET`).
3. `vercel.json` schedules the crons: close expired tenders every 15 minutes, send emails every 5 minutes. On the Vercel Hobby plan crons can run only once a day, so either use the Pro plan or call the two `/api/cron/*` URLs from an external scheduler (e.g. cron-job.org) with the header `Authorization: Bearer <CRON_SECRET>`.
4. Optional: add `RESEND_API_KEY` and verify your sending domain in Resend for email alerts.

## Testing the database logic
The test script needs a disposable Postgres with Supabase-like `auth`/`storage` stubs. On a local Supabase (`supabase start`), run the migrations + seed, then:
```bash
psql "$DB_URL" -f supabase/tests/phase1_flow_test.sql   # prints "ALL PHASE 1 TESTS PASSED"
```
It covers posting, vendor matching by category and pincode, hidden budget and contact details, drafts vs submissions, server-side totals, quote cap, shortlist contact reveal, award (other vendors rejected and notified), work-order access, deadline closing, admin KYC, and blocked privilege escalation.

## Adding a new category (no code)
Admin → Categories & templates → *Add a sub-category* → edit the template JSON (live preview on the right) → *Make live*.

- **Buyer form field:** `{ "key": "area_sqft", "label": "Area", "type": "number", "unit": "sq ft", "required": true }`
  Field types: `text, textarea, number, select, multiselect, boolean, date, items`
- **Quote line item:** `{ "key": "paint", "label": "Paint 2 coats", "unit": "sq ft", "qty_from": "area_sqft" }`. `qty_from` pre-fills the quantity from the buyer's answer.
- `period_label: "per month"` turns it into a monthly-rate contract (housekeeping, security); `items_from: "items"` turns the buyer's item list into quote lines (supply tenders).

## Known limits / next phases
- Work-order PDF uses standard fonts, so Hindi/Gujarati text appears as "?" in the PDF (fine on screen). Phase 2: embed Noto fonts.
- UI is English only; translations come in Phase 2.
- **Phase 2:** Razorpay subscriptions + quote credits, WhatsApp alerts, KYC auto-verification (Surepass/IDfy), reviews & vendor score, Q&A on tenders, chat, search.
- **Phase 3:** Society/office organisation accounts with committee approval & voting, recurring-contract tracking & re-tender, milestones, live tracking.
- **Phase 4:** AI tender assistant, price benchmarks, tender guarantee, SEO city pages, mobile app.

---
Tender Zipper is an intermediary platform and is not a party to agreements between buyers and vendors. Zero commission.
