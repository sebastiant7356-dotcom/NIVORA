# NIVORA — Kerala Shake & Chat Android app

NIVORA is a Malayalam-first Android social discovery app for adults aged 21–40 in Kerala. The app is built around Shake & Chat, anonymous posts, user-controlled profile visibility and friendships that require mutual acceptance. It is operated by an individual, Sebastian Thomas; there is no registered company at launch.

## Live services

- Backend health: https://nivora-backend.onrender.com/api/health
- Privacy Notice and Terms are included in the Android app.
- Support / grievance contact: nivora.helpdesk@gmail.com

The Android app embeds the frontend assets and connects to the existing Render backend. Supabase provides Google OAuth, database and private storage. The frontend is not deployed as a separate website for this new app. Render and Supabase free-tier quotas, sleeping/cold starts and provider limits apply.

## Current product behaviour

- Google OAuth sign-in only; no phone OTP.
- Customer profiles are auto-activated after consent. Staff accounts are excluded from matching.
- Shake is the main discovery action. Members choose a radius from 1 to 100 km; discovery is limited to Kerala.
- A mutual interest creates an anonymous chat. There is no 72-hour expiry; either member can end the conversation.
- Members can request friendship from a chat. A friendship exists only after the other member accepts.
- Members choose whether their profile is visible or hidden.
- Anonymous text posts can be shared with all Kerala members or within a selected nearby radius. Other members do not see the author identity; authorised staff can access it for safety investigations.
- Customer profile photos (up to four, JPEG/PNG/WebP, 5 MB each) remain hidden from other members until staff approval.
- Staff can review pending photos. Account investigations are limited to accounts with member reports; sensitive access is audit-logged.
- Blocking, reporting, account export and account deletion are available.
- Matching and messaging are free. Payments are not part of the current launch.

## Repository layout

- `backend/` — Node.js / Express API, SQL migrations and tests.
- `frontend/` — app UI source bundled into the Android application.
- `capacitor.config.json`, `package.json`, `scripts/` — Capacitor Android wrapper and native OAuth/location bridge.
- `docs/` — setup notes and historical project reports.

## Android app build

The Android app embeds the `frontend/` assets; a public frontend website is not required.

1. Install Node.js 22+ and Java 21.
2. Run `npm install` at the repository root.
3. Run `npm run build:native`.
4. Run `npx cap add android` once, then `npx cap sync android`.
5. Run `node scripts/patch-android-manifest.js`.
6. Build a local debug APK with `cd android && ./gradlew assembleDebug`.

GitHub Actions also builds a debug APK and uploads it as the `nivora-android-debug` artifact. The native Google OAuth callback is `in.nivora.social://auth/callback`; add that exact URL to Supabase Authentication → URL Configuration → Redirect URLs before testing sign-in in the Android app. Google OAuth's provider callback remains the Supabase Auth callback URL.

A debug APK is for testing only. Play Store release requires a signed Android App Bundle, a developer account, closed testing where applicable, and Google review. The existing backend host also serves the public legal pages at `https://nivora-backend.onrender.com/legal/privacy.html` and `https://nivora-backend.onrender.com/legal/terms.html`; these are legal documents only, not a separate frontend website.

## Local development

1. Install Node.js 22 or newer.
2. Configure the backend environment using `backend/.env.example`. Keep service-role keys only on the server; never put them in frontend files.
3. From `backend/`, run `npm ci`, then `npm test` and `npm run check`.
4. Run the backend with `npm start` (or the documented server start command in `backend/package.json`).
5. Serve `frontend/` with a local static HTTP server and set the frontend API configuration to the local backend URL.

GitHub Actions runs backend checks and builds a debug Android APK from the `feature/kerala-social-android-app` branch.

## Launch limitations — read before inviting users

- A complete end-to-end test with two independent customer Google accounts has not yet been completed. Test radius boundaries, physical shake discovery, mutual interest, anonymous chat, profile visibility, mutual friend acceptance, anonymous post audiences, block/report and persistent chat on real Android devices.
- Real-device Google OAuth deep-link return, GPS permission allow/deny behaviour and physical motion detection still need testing.
- Privacy Notice and Terms are drafts, not legal advice or lawyer-approved documents. Obtain an Indian legal review before broad public promotion.
- Supabase Free currently reports leaked-password protection unavailable on that plan. NIVORA uses Google OAuth only, but this remains a provider-level warning.
- The app does not verify identity, age, background or relationship status. Age is self-declared.
- No service can guarantee a match or uninterrupted availability.

Do not publish secrets, Google credentials, access tokens or Supabase service-role keys.


## Buyer due-diligence and handover

See [Buyer Handover Guide](docs/BUYER-HANDOVER.md) for the proposed source-code,
database, hosting, credential-rotation and transition process. The backend environment
variable template is [backend/.env.example](backend/.env.example). It contains
placeholders only; never commit real secrets.

The repository's [LICENSE](LICENSE) is a proprietary-use notice for evaluation.
Any acquisition or IP assignment must be documented in a separate written agreement.
Third-party dependencies and assets remain under their own licenses.

Use the [Controlled User Test Plan](docs/TEST-PLAN.md) before running an invited pilot or paid promotion. It defines safety release gates, two-account test cases, bug-reporting guidance and aggregate campaign metrics; it is a plan, not a passed test report.
