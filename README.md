# NIVORA — Kerala matchmaking

NIVORA is a Malayalam-first, mobile-friendly matchmaking service for adults aged 21–40 in Kerala. It is operated by an individual, Sebastian Thomas; there is no registered company at launch.

## Live services

- Frontend: https://nivora-g878.onrender.com
- Backend health: https://nivora-backend.onrender.com/api/health
- Privacy Notice: https://nivora-g878.onrender.com/privacy_ml.html
- Terms: https://nivora-g878.onrender.com/terms_ml.html
- Support / grievance contact: nivora.helpdesk@gmail.com

The app is deployed on Render and uses Supabase for Google OAuth, database and private storage. Render and Supabase free-tier quotas, sleeping/cold starts and provider limits apply.

## Current product behaviour

- Google OAuth sign-in only; no phone OTP.
- Customer profiles are auto-activated after consent. Staff accounts are excluded from matching.
- Up to five daily recommendations per user, based on the Kerala calendar day.
- Multiple concurrent match conversations are supported.
- Active conversations last up to 72 hours and include text chat and voice messages only. There are no live voice or video calls.
- Shake & Chat is optional and searches compatible opted-in members within 50 km. Exact coordinates are not shown. A mutual interest creates an anonymous chat; names, photos and profile details remain hidden until both members consent to reveal.
- Customer profile photos (up to four, JPEG/PNG/WebP, 5 MB each) remain hidden from other members until staff approval.
- Staff can review pending photos. Account investigations are limited to accounts with member reports; sensitive access is audit-logged.
- Blocking, reporting, account export and account deletion are available.
- Matching and messaging are free. Payments are not part of the current launch.

## Repository layout

- `backend/` — Node.js / Express API, SQL migrations and tests.
- `frontend/` — static HTML, CSS and browser JavaScript.
- `docs/` — setup notes and historical project reports.

## Local development

1. Install Node.js 22 or newer.
2. Configure the backend environment using `backend/.env.example`. Keep service-role keys only on the server; never put them in frontend files.
3. From `backend/`, run `npm ci`, then `npm test` and `npm run check`.
4. Run the backend with `npm start` (or the documented server start command in `backend/package.json`).
5. Serve `frontend/` with a local static HTTP server and set the frontend API configuration to the local backend URL.

GitHub Actions is configured to run backend syntax checks, backend tests and frontend JavaScript syntax checks on pushes and pull requests to `main`.

## Launch limitations — read before inviting users

- A complete end-to-end test with two independent customer Google accounts has not yet been completed. In particular, test mutual Shake & Chat interest, anonymous chat, both-sided reveal consent/withdrawal, daily matching, text chat and voice messages on real devices.
- Real-device GPS permission allow/deny behaviour still needs testing.
- Privacy Notice and Terms are drafts, not legal advice or lawyer-approved documents. Obtain an Indian legal review before broad public promotion.
- Supabase Free currently reports leaked-password protection unavailable on that plan. NIVORA uses Google OAuth only, but this remains a provider-level warning.
- The app does not verify identity, age, background or relationship status. Age is self-declared.
- No service can guarantee a match or uninterrupted availability.

Do not publish secrets, Google credentials, access tokens or Supabase service-role keys.
