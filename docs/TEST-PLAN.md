# MELVO — Global Android Social App Test Plan

Last updated: 2026-11-07

This is a manual release-gate plan, not evidence that the checks have passed. Record each result as PASS, FAIL or NOT TESTED with date, device and a short bug reference. Never include passwords, OAuth tokens, service-role keys, exact coordinates or unnecessary personal data in bug reports.

## 1. Pilot limits and safety

- Start with a controlled pilot of adults aged 18+ in one or two countries; do not open worldwide until legal, safety and support coverage exist in each target market.
- Use two or more independent customer Google accounts. Never use staff accounts as customer profiles.
- Keep location sharing off by default. Members must opt in and may turn it off at any time.
- Have an operator ready to review reports and respond through nivora.helpdesk@gmail.com before inviting real users.
- Do not ask testers to upload identity documents or share private conversations for debugging.
- Do not promote broadly until all critical/high-severity release gates pass.

## 2. Two-account end-to-end checks

| Area | Test | Expected result |
|---|---|---|
| Google OAuth | Sign in with two separate Google accounts on Android | System browser opens, OAuth returns through the MELVO app deep link, correct account session is restored |
| Profile | Create and edit profiles using different countries | City/region/country text is accepted; age must be 18+; no dating preferences are required |
| Staff separation | Sign in with a staff account | Staff console only; no customer profile or discovery |
| Radius | Set 1, 5, 25 and 100 km; test accounts inside/outside each radius in different countries | Only public members within the selected radius appear |
| Location | Deny, grant, change radius, disable location | No discovery without opt-in; disabling removes stored location and radius-audience posts |
| Physical Shake | Shake the device and use manual fallback | A random nearby anonymous candidate is selected; sensor events are throttled |
| Anonymous discovery | View candidate cards before matching | No name, photo, exact location or profile identity is exposed |
| Mutual interest | A sends interest, then B responds | Chat is created only after mutual interest |
| Anonymous chat | Send text and voice messages | Identity remains hidden until both separately consent to reveal |
| Profile visibility | Set a profile hidden, then search from the other account | Hidden profile does not appear in discovery and remains hidden in chat |
| Reveal consent | A consents, then B; also test withdrawal before mutual consent | One-sided consent never reveals identity; mutual consent reveals only a public profile |
| Persistent chat | Keep a Shake chat open beyond 72 hours in a controlled test | No automatic expiry; either member can end or block the connection |
| Friend request | Send a request from a Shake chat and accept on the other account | Friendship exists only after acceptance |
| Friend chat | Open a friend from the Friends list; end and reopen | A persistent friend chat can be created/reopened |
| Anonymous posts | Publish globally and to a nearby radius from different countries | Global posts are visible worldwide; radius posts are visible only within their selected radius; author identity stays hidden |
| Post safety | Report and block an anonymous post author | Report reaches staff; blocked author's posts and chats are hidden for blocker |
| Staff moderation | Inspect and remove a reported anonymous post | Staff actions are audited; removed post disappears from feed |
| Block | Block a member from chat | Active chats and friendship close; users cannot discover each other |
| Data export | Request export from each test account | Export belongs only to the requesting account |
| Account deletion | Delete a dedicated test account | Profile, matches, chats, photos and voice files are no longer accessible; disclosed retention rules apply |

## 3. Release gates

Do not launch if:
1. Another member can access private profile details, email, exact location, unapproved photos or chat content without authorization.
2. A non-member or blocked user can read or send messages.
3. Identity is revealed before mutual consent or a hidden profile is exposed.
4. A chat expires automatically despite being a Shake or friend chat.
5. Anonymous posts expose author identity to members or cannot be reported/blocked.
6. Staff cannot inspect and remove reported anonymous content.
7. Account deletion reports success while user data remains accessible.
8. A global/radius audience leaks posts across its intended audience boundary.

## 4. Security and configuration

- Google OAuth is the only customer sign-in method.
- Add `in.melvo.social://auth/callback` to Supabase Auth redirect URLs. Google provider callback remains the Supabase Auth callback URL.
- Keep the Supabase service-role key in the backend host's secret environment only.
- Keep profile-photo and voice-message storage private; signed URLs must expire.
- Confirm backend CORS and staff authorization.
- Confirm location is optional, off by default, and never returned as coordinates/address to another member.
- Run backend syntax checks and tests; run frontend JavaScript syntax checks.
- Apply migrations to a non-production database first. Verify migration status before production application.

## 5. Bug reporting

Send reports to nivora.helpdesk@gmail.com with test alias, date/time and timezone, device, feature, reproduction steps, expected and actual result. Redact names, email addresses, messages and personal data. Never send passwords, login codes, tokens, exact coordinates or unredacted private chats.

Critical issues include privacy breaches, account takeover, unauthorized access, identity/location exposure or data loss. Stop the pilot immediately if any occur.
