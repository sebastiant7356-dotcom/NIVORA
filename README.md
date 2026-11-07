# BEYOND — Global Shake & Chat Android app

BEYOND is the working product name for a global, adults-only social discovery app. The brand name is provisional and must pass trademark, domain and Play Store name checks before public release. The source repository is still named NIVORA.

## Product

- Android app built with Capacitor; the frontend is bundled into the app. No separate public frontend website is being launched.
- Google OAuth only. No phone OTP, SMS login or password login.
- Adults aged 18+; age is self-declared and not independently verified.
- Shake-to-discover people anywhere in the world within a user-selected 1–100 km radius.
- Anonymous chat starts after mutual interest. Names, photos and profile details remain hidden until both members separately consent to reveal.
- Text chat and other member content exist only in volatile server memory for up to 12 hours of inactivity; restarts may erase them sooner. Either member can end or block an active conversation.
- Mutual friend requests; a friendship exists only after the other person accepts.
- Anonymous text posts can be shared globally or within a selected nearby radius; they are temporary and are not archived.
- Members control whether their profile appears in discovery; hidden profiles remain hidden.
- Temporary block and report actions, current-session export, and Google account deletion. Durable staff moderation is not enabled in this strict minimal-data version.
- Profile-photo and voice-message uploads are disabled. Persistent history, payments and durable friend lists are not available.
- Free at this stage. Payments, live voice calls and video calls are not part of the current release.

## Existing services

- Backend health: https://nivora-backend.onrender.com/api/health
- Privacy notice: https://nivora-backend.onrender.com/legal/privacy.html
- Terms: https://nivora-backend.onrender.com/legal/terms.html
- Support / grievance email currently configured: nivora.helpdesk@gmail.com

Supabase provides Google OAuth and account authentication. Render hosts the API. The current branch uses process-local volatile memory for member content; legacy Supabase tables and one legacy profile-photo object still require cleanup. The frontend is bundled inside the Android app, not deployed as a separate public website. Free-tier quotas and cold starts may apply.

## Android build

- Capacitor application ID: `in.melvo.social`
- Display name: `BEYOND`
- OAuth deep link: `in.melvo.social://auth/callback`

GitHub Actions builds a debug APK and uploads it as the `beyond-android-debug` artifact. A debug APK is for testing only.

For a local build:
1. Install Node.js 22+ and Java 21.
2. Run `npm install` at the repository root.
3. Run `npm run build:native`.
4. Run `npx cap add android` once, then `npx cap sync android`.
5. Run `node scripts/patch-android-manifest.js`.
6. Run `cd android && ./gradlew assembleDebug`.

Before Android Google sign-in works, add the exact redirect `in.melvo.social://auth/callback` to Supabase Authentication → URL Configuration → Redirect URLs. Google OAuth's provider callback remains the Supabase Auth callback URL.

## Current release blockers

- The social/global migrations are already present in Supabase: `20261107000000_social_app_foundation.sql`, `20261108000000_global_social_platform.sql`, and `20261109000000_cleanup_legacy_post_constraint.sql`.
- The additive performance migration `anonymous_posts_author_index` has been applied to the connected Supabase database; it indexes `anonymous_posts.author_id`.
- Add the Android OAuth redirect URI to Supabase Auth.
- Deploy the updated backend to the existing Render service.
- Complete two-account tests for global discovery, mutual anonymous reveal, persistent chat, friend requests, global/radius posts, blocking, reporting and account deletion.
- Test GPS permission and physical shake on real Android devices.
- Generate a signed Android App Bundle (AAB), meet Play Console testing requirements and pass Google review.
- Have the Privacy Notice and Terms reviewed by qualified counsel before launch in multiple countries.

## Important limitations

BEYOND is not yet a production-ready public service. The session-only implementation is in a draft pull request and has not been merged or deployed. Process-local memory can be lost on restart and does not support multiple backend instances consistently. Reports and blocks are not durable, and no staff moderation queue is active. Existing legacy database rows and a profile-photo object have not yet been deleted. Do not publicly launch until OAuth configuration, legacy-data cleanup, real-device tests, legal review, safety coverage and a reliable ephemeral realtime architecture are complete.

The operator is an individual, not a registered company. Keep secrets only in provider secret settings; never commit OAuth client secrets or Supabase service-role keys.
