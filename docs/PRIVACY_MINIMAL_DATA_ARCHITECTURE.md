# BEYOND Minimal-Data Architecture

## Product decision
BEYOND must retain only the authentication account needed to sign in. Google passwords are never collected or stored by BEYOND. Supabase Auth remains the identity provider and stores the authentication identity (provider subject/user UUID, provider metadata required for OAuth, and email only where supplied/required by Google/Supabase).

No application content is persisted in the BEYOND database or object storage:
- profile fields and profile photos
- chat text, voice notes, attachments
- precise or approximate location history
- discovery/like/match state
- friend relationships
- anonymous posts
- feedback/report payloads containing user-submitted content
- activity history and analytics tied to an account

## Runtime model
User-generated content exists only in volatile runtime memory while the relevant live session is active. Use a dedicated ephemeral realtime service with authenticated WebSocket connections. Do not use process-local memory as the production solution because Render may restart or scale instances, causing inconsistent sessions. The ephemeral service must:
- authenticate each connection by verifying the Supabase access token;
- keep profile/discovery/chat state in RAM only;
- enforce 18+ eligibility using a non-persistent client attestation/consent flow; do not persist birth date;
- enforce mutual-interest, mutual-reveal, and mutual-friend consent server-side;
- enforce radius calculations without writing coordinates to a database;
- remove all user state on disconnect, logout, explicit clear, or bounded inactivity timeout;
- avoid message bodies, tokens, coordinates, and identifiers in logs, traces, crash reports, and analytics;
- use TLS/WSS and per-user rate limits;
- make clear to users that chats and session state disappear when the session ends and cannot be recovered.

## Authentication and security
- Google OAuth only.
- Never ask for, receive, hash, or store a Google password.
- Keep Supabase Auth as the only persistent user store.
- Do not put service-role credentials in the Android app.
- Keep access tokens in the platform secure storage; never log them.
- Account deletion must delete the Supabase Auth user and associated provider identity. Since app content is ephemeral, no content export/archive exists.

## Required code changes before enabling this policy
1. Replace database-backed profile, match, shake, chat, friend, anonymous-post, voice-message, feedback, and safety routes with the ephemeral realtime service.
2. Remove profile-photo and voice-message upload endpoints and disable their Supabase Storage buckets.
3. Remove service-role database access from application routes; retain only server-side auth verification and minimal admin/security functions that do not retain member content.
4. Replace account export/deletion behavior and all UI copy to match non-persistent sessions.
5. Replace privacy policy and terms so they accurately disclose transient processing, authentication retention, legal/safety exceptions, and third-party processing by Google/Supabase/hosting providers.
6. Add automated tests proving no route writes member content to Postgres or Storage.
7. Deploy only after end-to-end tests with two separate Android accounts.

## Data deletion and rollout
Do not run destructive SQL or purge existing production records as part of code deployment. First deploy the no-new-content-write implementation, verify it, then run a separately approved deletion migration for existing content rows and objects. Preserve only the Supabase Auth users required for login. Record the deletion result without retaining deleted content or content-derived identifiers.

## Critical product trade-off
With this policy, conversations, profiles, matches, friends, posts, and discovery state do not survive a disconnect, logout, backend restart, or session expiry. There is no chat history, photo profile, persistent friend list, or cross-device profile. This is intentional and must be reflected in onboarding and Play Store disclosures.
