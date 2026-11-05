# NIVORA — Controlled User Test Plan

Last updated: 2026-11-05

This is a manual release-gate plan for a small, consent-based pilot. It is not evidence that the checks have passed. Record each result as PASS, FAIL, or NOT TESTED, with date, browser/device, and a short bug reference. Never include passwords, OAuth tokens, service-role keys, exact location coordinates, or unnecessary personal data in bug reports.

## 1. Pilot limits and safety

- Start with a small, invited group of adults aged 21+ in Kerala. Do not run a broad public campaign until the release gates below pass.
- Use two or more independent customer Google accounts for matching tests. Staff accounts must never be used as customer profiles.
- Tell testers clearly that NIVORA is an early pilot, has no guaranteed number of members or matches, and that profiles/messages are user-generated.
- Keep Shake & Chat location sharing off by default. Testers must actively opt in and may turn it off at any time.
- Have the operator ready to review reports and respond through nivora.helpdesk@gmail.com before inviting real users. Do not promise continuous moderation or response times that cannot be met.
- Do not ask testers to upload identity documents or share private conversations for debugging. Ask for the screen, approximate time, browser/device, and steps to reproduce; redact names and personal details.
- Do not use paid ads until critical/high-severity issues are resolved and the privacy notice, terms, grievance contact, and account-deletion flow have been reviewed.

## 2. Release gates

A pilot must not proceed if any of these checks fail:

1. A user can access another member's private profile, email, exact location, photos awaiting approval, or conversation without authorization.
2. A non-member or blocked user can read or send chat/voice messages.
3. Shake & Chat reveals either person's identity before both members consent.
4. Account deletion reports success while profile, chat, photo, or voice data remains accessible.
5. Google sign-in, profile creation, matching, or report/block flow is broken.
6. The operator cannot access and act on reports.

## 3. Two-account end-to-end checks

Record Account A and Account B as test aliases only.

| Area | Test | Expected result |
|---|---|---|
| Google OAuth | Sign in with two separate Google accounts; sign out and sign back in | Both accounts authenticate; later sign-in returns to the correct member dashboard |
| Profile | Create and save each profile | Required fields validate; no duplicate profile is created on refresh/re-login |
| Staff separation | Sign in with a staff account | Staff console only; no customer profile or matching |
| Daily 5 | Request recommendations repeatedly | No more than five recommendations per user per Kerala calendar day; quota shown accurately |
| Multiple matches | Create more than one valid conversation where available | Each conversation appears separately and opens the correct chat |
| 72-hour window | Check start/end timestamps and expiry handling | Chat opens only for eligible live matches and closes after the 72-hour window or when ended |
| Continue / Stop | Test both choices on both accounts | The match state changes consistently; no user is silently treated as having consented |
| Text chat | Send, reload, and retrieve messages | Only the two match members can read/send; messages persist and are ordered |
| Voice message | Record, send, play, and reject invalid/oversized audio | Valid recordings up to 60 seconds / 2 MB work; invalid payloads are rejected; storage remains private |
| Photo approval | Upload valid/invalid photos; inspect as staff and as another member | Up to four allowed formats/sizes; pending/rejected photos are not visible to other members |
| Shake location | Deny permission, opt in, refresh, then switch off | No discovery without opt-in; off removes stored location and stops discovery |
| 50 km discovery | Test a consenting compatible account inside and outside radius | Only eligible compatible accounts within 50 km are returned; only approximate distance is shown |
| Anonymous reveal | Mutual interest; consent on A only; then B; withdraw before B consents | Identity stays hidden until both consent; one-sided consent can be withdrawn |
| Block | A blocks B | Match ends; neither account is recommended to the other again |
| Report | Submit a report and inspect staff workflow | Report is stored; only authorized staff can inspect the relevant reported account/evidence |
| Data export | Request export from each test account | Export belongs only to requesting account and is usable |
| Account deletion | Delete a dedicated test account | Customer profile, matches, chats, photos and voice files are no longer accessible; any legally retained registration record follows the disclosed 180-day policy |

For the 72-hour expiry test, use a controlled test environment or a documented test record. Do not alter production users' timestamps to simulate expiry.

## 4. Security and configuration checks

- Confirm only Google OAuth is exposed to customers.
- Confirm SUPABASE_SERVICE_ROLE_KEY exists only in the backend host's secret environment and is never placed in frontend files or Git.
- Confirm Supabase storage buckets for profile photos and voice messages are private and signed URLs expire.
- Confirm backend CORS allows only the intended production frontend origin(s).
- Confirm staff routes require server-side admin/moderator authorization.
- Confirm a blocked member cannot use an old match URL or cached page to continue chat.
- Confirm location is optional, disabled by default, and never returned as coordinates or address to another member.
- Run from backend/: npm ci, npm run check, and npm test. Also run node --check on all frontend JavaScript files.
- Apply database migrations in order in a non-production project first. Verify migration status before applying any new migration to production.

## 5. Bug report format

Send bug reports to nivora.helpdesk@gmail.com with:

- Subject: NIVORA Pilot Bug — [short issue]
- Test alias (A/B), not the person's full name
- Date/time (IST)
- Device and browser
- Page/feature
- Steps to reproduce
- Expected result
- Actual result
- Screenshot with names, email addresses, messages, and other personal data hidden

Do not send passwords, Google login codes, tokens, exact location, or unredacted private chats.

Severity:
- Critical: privacy breach, account takeover, unauthorized access, identity/location exposure, or data loss. Stop the pilot immediately.
- High: login, matching, chat, block/report, or deletion is unusable. Pause promotion until fixed.
- Medium: a core flow has a workaround or a display/data issue without privacy impact.
- Low: cosmetic or wording issue.

## 6. Small Instagram pilot measurement

Paid advertising for an online dating/matchmaking service on Meta platforms (including Instagram) requires Meta's prior written permission. Submit the dating-service advertiser application and wait for written approval before creating or boosting a paid ad. Do not try to disguise the service category or bypass review. Organic posts are a separate route, but must still be truthful and follow platform rules.\n\nDo not judge the campaign by reach or likes alone. Track aggregate counts only:

- Ad spend and impressions
- Link clicks / landing-page visits
- Google sign-ins started and completed
- Profiles successfully completed
- Members who receive at least one recommendation
- Matches accepted and first messages sent
- Reports, blocks, and support requests
- Bugs by severity and whether fixed

Use a small capped budget and a short run. Stop the ad if critical/high issues appear, if reports cannot be handled, or if the app is not reliably onboarding users. Do not upload member lists, sensitive profile details, or private conversations to advertising platforms. Avoid third-party tracking pixels until the privacy notice and consent implications have been reviewed.

A small pilot can reveal usability and reliability problems; it does not establish product-market fit, safety certification, revenue, or buyer valuation.
