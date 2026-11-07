# BEYOND — session-only Android test plan

Last updated: 7 November 2026

This is a manual release-gate plan. Automated CI passing does not prove these device-level behaviours. Record each result as PASS, FAIL or NOT TESTED with date, device and a short bug reference. Never include passwords, OAuth tokens, exact coordinates or private message content in bug reports.

## 1. Pilot safety and data policy
- Use adults aged 18+ only. Age is self-declared, not independently verified.
- Google OAuth is the only sign-in method. BEYOND must never request or store Google passwords.
- Only Supabase Auth account identity is intended to persist. Member-generated content is temporary process memory, up to 12 hours of inactivity.
- Process restarts/redeploys may erase profiles, locations, chats, posts, friend state, blocks and reports earlier.
- Photos, voice messages, payments, persistent chat history and persistent friend lists are disabled.
- Reports and blocks are volatile; they are not guaranteed durable moderation records. Do not invite public users until the safety implications are accepted and support coverage exists.

## 2. Two-account end-to-end checks

| Area | Test | Expected result |
|---|---|---|
| Google OAuth | Sign in with two separate Google accounts on Android | System browser opens, OAuth returns through `in.melvo.social://auth/callback`, correct account session is restored |
| Profile | Create and edit profiles | Age below 18 is rejected; both Terms and Privacy consent are required on create; edits do not require re-consent |
| Session-only profile | Refresh the app and keep the backend running | Profile remains available in current backend memory; profile is not written to Supabase tables |
| Restart behaviour | Restart/redeploy backend in a controlled test | Profiles and social session data disappear; users must recreate temporary profile state |
| Radius | Set 1, 5, 25 and 100 km; use test accounts inside/outside | Only public members inside both selected radii appear |
| Location | Deny, grant, change radius, disable | Discovery requires opt-in; exact coordinates are not returned to another member; disabling removes current location state |
| Shake | Use physical shake and manual refresh | Candidate list refreshes; motion events are throttled |
| Anonymous discovery | View candidate cards before matching | No name, photo, exact location or profile identity is exposed |
| Mutual interest | A sends interest, then B responds | Chat is created only after mutual interest |
| Anonymous chat | Send text from both accounts | Messages are available only while the active server session exists; no history is written to Supabase |
| Mutual reveal | A consents, then B; test one-sided consent | One-sided consent keeps identity hidden; mutual consent reveals only a public profile |
| Profile visibility | Set a profile hidden | Hidden profile does not appear in discovery and stays hidden after reveal consent |
| Friend request | Send from an active chat and accept/decline | Friendship exists only after acceptance and remains temporary |
| Anonymous posts | Publish globally and to a nearby radius | Global posts are visible to current members; radius posts respect selected radius; posts are temporary |
| Delete post | Delete own post | Post disappears from active feed |
| Block/report | Block or report a member/post | Block closes active chats and hides the member for current process lifetime; report is temporary and may be lost on restart |
| Media | Attempt photo and voice upload | Uploads are disabled and return a clear disabled message |
| Logout | Explicitly sign out | Current server-side volatile state associated with that account is cleared |
| Export | Request current-session export | Only currently available session profile data is returned; no historic messages/photos are available |
| Account deletion | Delete a dedicated test account | Supabase Auth identity is removed and associated volatile state is cleared |

## 3. Automated checks
- Backend syntax check passes.
- Backend unit and static tests pass.
- Minimal-data API contains no Supabase table, RPC or Storage access.
- Server mounts the ephemeral API and does not mount legacy persistent member-content routes.
- Android debug APK build and artifact upload succeed.

## 4. Release gates
Do not launch publicly if:
1. A route writes member content to Supabase Postgres or Storage.
2. Another member can access private profile details, email, exact location or chat content without authorization.
3. Identity is revealed before mutual consent or a hidden profile is exposed.
4. A blocked user can continue discovery or chat during the current server session.
5. Global/radius posts leak outside their intended audience.
6. The Android OAuth redirect is not configured and tested.
7. Legacy profile, location, match or media records remain after the cleanup step is declared complete.
8. The product is marketed as having durable moderation/report handling while reports are only volatile.
9. Multi-instance deployment is enabled while process-local state is still used.

## 5. Before public release
- Add the Android redirect URI in Supabase Auth.
- Deploy and verify the no-new-write backend.
- Inventory and delete legacy member-content rows and stored media while preserving Auth accounts.
- Remove/disable legacy media buckets.
- Replace process-local memory with a reliable ephemeral realtime service before scaling.
- Decide whether minimal durable safety reports are allowed; if yes, revise the retention promise explicitly.
- Test on real Android devices and obtain qualified legal review for every launch market.
