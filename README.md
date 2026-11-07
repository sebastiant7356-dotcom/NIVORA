# BEYOND — Global Shake & Chat Android app

BEYOND is the working product name for a global, adults-only social discovery app. The brand name is provisional and must pass trademark, domain and Play Store name checks before public release. The source repository is still named NIVORA.

## Product

- Android app built with Capacitor; the frontend is bundled into the app. No separate public frontend website is being launched.
- Google OAuth only. No phone OTP, SMS login or password login.
- Adults aged 18+; age is self-declared and not independently verified.
- Shake-to-discover people anywhere in the world within a user-selected 1–100 km radius.
- Anonymous chat starts after mutual interest. Names, photos and profile details remain hidden until both members separately consent to reveal.
- Shake and accepted-friend chats do not automatically expire. Either member can end or block a conversation.
- Mutual friend requests; a friendship exists only after the other person accepts.
- Anonymous text posts can be shared globally or within a selected nearby radius.
- Members control whether their profile appears in discovery; hidden profiles remain hidden.
- Report, block, staff moderation, account export and account deletion.
- Profile photos remain hidden from other members until staff approval.
- Free at this stage. Payments, live voice calls and video calls are not part of the current release.

## Existing services

- Backend health: https://nivora-backend.onrender.com/api/health
- Privacy notice: https://nivora-backend.onrender.com/legal/privacy.html
- Terms: https://nivora-backend.onrender.com/legal/terms.html
- Support / grievance email currently configured: nivora.helpdesk@gmail.com

Supabase provides Google OAuth, PostgreSQL and private storage. Render hosts the API. The frontend is bundled inside the Android app, not deployed as a separate public website. Free-tier quotas and cold starts may apply.

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

BEYOND is not yet a production-ready worldwide service. The code changes are in a draft pull request and have not been merged or deployed. A worldwide product also requires country-specific legal review, privacy and data-transfer compliance, child-safety controls, moderation coverage, and capacity planning. Do not advertise worldwide availability until the database migration, backend deployment, OAuth configuration and real-device testing are complete.

The operator is an individual, not a registered company. Keep secrets only in provider secret settings; never commit OAuth client secrets or Supabase service-role keys.
