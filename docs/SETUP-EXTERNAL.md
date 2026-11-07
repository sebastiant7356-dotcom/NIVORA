# BEYOND — external setup and release gates

## Current implementation
The current minimal-data branch replaces persistent member-content routes with a volatile in-memory API. Google/Supabase Auth is the only intended persistent account identity store. Profile data, coordinates, interests, matches, messages, posts, friend state, blocks and reports are temporary process memory with a 12-hour inactivity TTL. Restarts/redeploys may erase them earlier. Profile photos, voice messages, payments and persistent history are disabled.

This is not yet a safe public launch. Reports and blocks are volatile, and there is no durable moderation queue. Strict login-only retention conflicts with durable safety evidence. The operator must decide this product/safety trade-off before public release.

## A. Google OAuth — manual dashboard step
1. In Supabase Authentication, confirm Google is the only customer sign-in method exposed.
2. Confirm the Google OAuth client has the current Supabase callback URL.
3. Add the exact Android redirect `in.melvo.social://auth/callback` to Supabase Authentication → URL Configuration → Redirect URLs.
4. Test sign-in, sign-out and account deletion using two separate test Google accounts.

The redirect allow-list is a Supabase Auth dashboard setting and has not been changed by the repository code.

## B. Deploy and verify
1. Wait for all backend, test and Android build workflows on the latest PR commit to pass.
2. Merge the reviewed PR to `main`; Render is configured to auto-deploy from `main`.
3. Verify the Render deployment is live and `/api/health` returns `data_mode: "ephemeral"` and `member_content_persistence: false`.
4. Confirm the app still signs in and all member-content routes use the ephemeral API.
5. Only after no-new-write behaviour is confirmed, inventory and remove legacy database rows and stored files. Preserve `auth.users` accounts. The connected project currently has legacy profile/match/location rows and one private profile-photo object. The cleanup has not yet been run.
6. The private `profile-photos` and `voice-messages` buckets remain configured in Supabase. Upload routes are disabled in the app; remove old objects and disable/remove unused buckets using Supabase Storage controls.

## C. Two-account Android test
Use two independent Google test accounts and real Android devices. Verify:
- Both accounts can sign in with Google and complete a profile with declared age 18+.
- Profile details are session-only; edits work; hidden profiles stay hidden.
- Location is opt-in, radius is constrained to 1–100 km, exact coordinates are not shown to other members, and discovery returns only members within both selected radii.
- A mutual interest opens an anonymous text chat.
- One-sided reveal does not expose identity; both-sided reveal exposes only a public profile.
- A member can end a chat, block another member, send a friend request, and accept/decline the request.
- Anonymous posts respect global/radius audience selection; a user can delete their own post.
- Profile-photo and voice uploads remain disabled.
- Explicit logout clears the user's active volatile state; account deletion removes the Supabase Auth identity.
- A controlled backend restart clears temporary data, as disclosed.
- Reports and blocks are understood to be temporary and not guaranteed to reach a durable moderation queue.

## D. Remaining release requirements
- Replace process-local memory with a reliable authenticated ephemeral realtime/presence service before scaling or multi-instance production use.
- Decide whether limited durable report evidence is permitted. If durable reports are required, the "only login details persist" policy must be revised explicitly.
- Test GPS permission and physical shake on real devices.
- Generate a signed Android App Bundle, complete Play Console testing requirements and pass Google review.
- Obtain qualified legal review for India and every intended target market, including age eligibility, privacy, cross-border processing, user-generated content and grievance handling.

## E. Known provider and plan limitations
- Render and Supabase plan quotas, sleep/cold-start behaviour and restarts apply.
- Keep the Supabase service-role key in Render backend environment variables only; never put it in the Android app.
- Leaked-password protection is not relevant to Google-only OAuth passwords, but any Supabase Security Advisor warning must still be reviewed rather than described as fixed.
- No payment processor, media upload or persistent chat-history feature is active.
