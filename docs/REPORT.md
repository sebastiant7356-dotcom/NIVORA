# NIVORA — change report

## 1. Audit of the uploaded ZIP (what existed)
- **Frontend** (`NIVORA_Animation_Frontend`): animated landing page, 4-step wizard, ml/en toggle, local AI portraits. The final step used `prompt()` for **email + password**, `signInWithPassword`, hardcoded `http://127.0.0.1:4000`, sent only 5 fields (name, age, place, job, bio), and silently reported "saved" with the *form* values even when the server returned an already-existing profile.
- **Backend** (`NIVORA_BACKEND/src`): Express 5; `profile-routes.js` (GET/POST/PUT), `match-routes.js` (RPC `nivora_find_partner`, history), `feedback-routes.js`; each route file duplicated its own auth code and relied on Supabase RLS/RPCs **whose SQL was not in the ZIP** (no migrations existed). No admin, chat, voice, payment, block/report, deletion, CORS limits, rate limits or `.env.example`. Test files were interactive email/password scripts against localhost. Several backup folders and `server.js.backup` were included.

## 2. Bugs/risks fixed
1. Email/password `prompt()` login (contradicted the spec, exposed passwords to a browser prompt) → phone + OTP; backend rejects tokens without a confirmed phone.
2. Hardcoded localhost API → configurable `apiBase` (auto for localhost, required in production).
3. Wizard dropped gender, partner preference, age range, intention, values and consents → all persisted; server validates all.
4. "Profile saved" with stale form values / existing profile ignored → success panel renders the server's saved profile; existing profiles open "My space".
5. Malayalam dictionary contained **Tamil text** in three value labels (faith, communication, lifestyle) → fixed.
6. "Up to 3 values" and 21–40 partner range were not enforced → enforced in browser and server.
7. Matching RPC took no user argument and trusted `auth.uid()` while being callable by any signed-in user; match history returned both user ids → new service-role-only functions; responses expose no ids/phones/last names.
8. Unknown RLS state → migration replaces policies with a locked-down set + trigger blocking direct profile writes; users cannot self-approve or read AI flags.
9. Open CORS, unbounded requests, no security headers → origin allow-list, 20 kB JSON limit, rate limits, headers, token-free logging.
10. Demo-only messaging removed where the feature is now real; the landing-page portraits are labelled as sample illustrations.
11. Removed obsolete backups and email/password test scripts (superseded by `tests/`).

## 3. Implemented (code complete, see §5 for what is verified)
Phone-OTP sign-in · profile create/read/edit with consents · duplicate-profile prevention · staff approval workflow (approve/reject/request changes, reasons, history, audit log) · advisory AI-assisted screening (rules; optional LLM off by default) · reports, blocks, suspend/reinstate · mutual-eligibility matching with one-live-match constraint, accept/decline/end/expiry · private chat with server-enforced 72 h window + Realtime + polling fallback · WebRTC voice with authorised signalling · Razorpay ₹50 order/verify/webhook with idempotency · data export and account deletion · feedback · admin screen · Termux/hosting docs.

## 4. Needs external setup or a decision (not done / cannot be done in code)
SMS provider + India DLT · Supabase phone-auth config · running the migration on your project · first admin SQL · Razorpay keys + webhook (and your decision whether payment is required) · TURN server · privacy policy/terms/legal review · photo upload (not built) · refunds/GST invoices (not built) · Redis for multi-instance rate limiting · pg_cron retention schedule · decision on whether declined/expired matches should refund a credit.

## 5. Verification actually run (sandbox: Node 22, **no network, no Postgres, no npm install possible**)
| Check | Result |
|---|---|
| `node scripts/check-syntax.js` on all backend src/tests/scripts | all pass |
| `node --check` on `app.js common.js portal.js admin.js` | all pass |
| `node --test tests/*.test.js` | **40 / 40 pass** |
| ↳ pure logic (26): validation, consent, enums, AI flags, redaction, Razorpay HMAC + paymentMatches, rate limiter, config, repo scan (no secrets/.env/localhost/email-password login/service key in frontend; no token/phone logging; SQL has RLS + revoked function grants) | pass |
| ↳ route tests with **stubbed** express/supabase (14): all modules load; admin cannot self-approve; reason required; non-staff blocked; email-only & unconfirmed-phone tokens rejected; chat refused after expiry/ended/blocked/non-member; client-supplied user id ignored by matching; duplicate match → 409; profile create forces verified id + pending + consent stamps; rejected profile uneditable; approved edit forced back to pending; forged payment signature never marks paid; duplicate webhook not reprocessed | pass |
| Headless Chromium on `http://127.0.0.1:3002` with **stubbed** Supabase library and API: wizard 4 steps, consent gate, invalid-phone message, `98765 43210` → `+919876543210`, wrong/right OTP, POST payload keys, success panel; portal render (status, partner card, countdown, chat send, report), HTML in partner bio rendered as text (no XSS), admin page shows login before any staff UI | worked, 0 JS errors |

**Not verified (cannot be from here):** the SQL migration was **never executed** (no Postgres) — run it on a staging Supabase project first; real `npm install`/real Express 5 and supabase-js; real RLS/Realtime behaviour; OTP delivery; real Razorpay calls; two-device WebRTC calls; concurrency behaviour of matching under load; the admin screen after login; mobile layout beyond a 390 px screenshot of the wizard/portal.

## 6. Readiness
**Not production-ready.** Before public launch: run and review the migration on staging, configure SMS/DLT, test the full flow with two real accounts, add TURN, get the privacy policy and consent text legally reviewed, and decide the payment and photo-upload scope.
