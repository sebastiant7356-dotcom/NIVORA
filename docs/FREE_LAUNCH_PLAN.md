# NIVORA Free Kerala Launch Plan

## Product decision

NIVORA will be prepared as a free-to-use Kerala matchmaking MVP. No paid match credits, Razorpay checkout, voice/video calls, or TURN configuration are required for this launch.

### Member experience
- Google sign-in.
- Complete an adult profile (current product age range is 21–40; confirm before public launch).
- Receive up to five eligible match recommendations per local calendar day, subject to actual compatible member availability.
- Text chat with a mutual match.
- Voice messages in chat (not live calls).
- Report and block controls, account export/deletion, and clear privacy/consent notices.

### Matching rules
- Never promise five matches when fewer than five eligible profiles exist.
- Do not repeat a person already shown/matched to the same member unless a deliberate product rule is later approved.
- Respect gender/preference, age range, relationship intention, district/values scoring, blocks, suspensions, and mutual eligibility.
- Enforce the daily quota server-side in Asia/Kolkata time; client-side counters are not authoritative.
- Avoid concurrent duplicate assignments and race conditions.

### Moderation and trust
- Do not make profile or photo approval blindly automatic.
- Use automated checks only as triage; suspicious, reported, underage, impersonation, or policy-flagged profiles/photos remain held for human review.
- Keep report, block, suspension, audit, and account-deletion workflows.
- Clearly disclose that identity is not government-verified unless a real verification process is implemented.

### Voice messages
- Use a private Supabase Storage bucket.
- Authorize upload/download only for the two members of an active, unexpired match.
- Validate audio MIME type, file signature where practical, duration, and byte size; rate-limit uploads.
- Store voice metadata on the chat message row and use short-lived signed URLs.
- The feature branch now adds a private bucket, 2 MB upload cap, per-user upload rate limit, match-membership checks, and chat UI recording/playback. Client-side recording stops at 60 seconds; the submitted duration value is not independently verified by the server yet.
- Add orphan cleanup and retention/deletion behavior before public launch.
- Do not expose storage object paths or permanent public URLs.

### Remove from launch scope
- Live voice/video call UI and call signalling endpoints.
- Razorpay checkout, paid credits, and payment-required matching.
- TURN/ICE configuration.

## Audit findings from 2026-11-01

- GitHub repository: `sebastiant7356-dotcom/NIVORA`; default branch `main`.
- Existing Render frontend and backend services are deployed from `main`; changes in this branch must not be merged/deployed until reviewed.
- Supabase project `nivora` is active.
- Existing text-chat route and UI exist.
- Existing call signalling route and WebRTC UI exist.
- Existing profile creation defaults to `approval_status = pending`; staff review currently gates matching.
- Existing profile-photo uploads default to `approval_status = pending`.
- Existing AI profile moderation is explicitly advisory and does not approve profiles automatically.
- Existing matching RPC created one proposed match at a time and enforced one live match per member. The feature branch now adds a database-enforced quota of five successful recommendations per member per Asia/Kolkata calendar day, plus a composite (user_id, match_id) membership key so members can hold multiple live conversations. The portal now returns and displays a switchable inbox of current conversations. This is implemented in migrations/code but not yet applied to Supabase or verified with two real accounts.
- The deployed matching RPC currently sets the proposal response deadline to 48 hours. The desired product decision mentions the existing 72-hour conversation window; proposal and active-chat timing must be reconciled before implementation.
- Existing chat messages are text-only in the `messages` table.
- Existing frontend still contains old payment and voice-call UI copy.
- README contains stale local-demo/phone-OTP information and must be rewritten before public launch.

## Implementation sequence

1. Reconcile product rules and database state (especially proposal vs active chat timing).
2. [Feature branch implementation added] Enforce five successful recommendations per member per Asia/Kolkata day and allow multiple concurrent matches using a composite membership key, transactional candidate row locking, no-repeat rules, and a switchable inbox. Apply and verify both migrations in a non-production Supabase environment before any production rollout.
3. [Feature branch implementation added; not yet applied to Supabase] Add private voice-message storage, message metadata, match authorization, upload rate/size limits, signed URLs, and chat recording/playback UI. Verify MIME handling, real media duration limits, retention/deletion, and two-account access before launch.
4. Remove call signalling/WebRTC from public member experience and disable public call API routes.
5. Implement safe auto-approval only for low-risk profiles; retain human review for flags and all photo risk cases.
6. Remove payment/paid-credit requirements from the free launch path without deleting payment history or secrets.
7. Update Malayalam/English product copy, privacy/terms/consent, README, and launch instructions.
8. Add/maintain static regression checks for quota and multi-chat schema/UI; still add live database concurrency tests, media authorization/file-signature tests, report/block interactions, and disabled-call integration tests.
9. Run syntax/tests, inspect Supabase security/performance advisors, then prepare a reviewed pull request. Production database changes and deployment remain separate explicit steps.

## Non-goals / safeguards

- Do not delete or recreate GitHub, Supabase, or Render projects/services.
- Do not alter existing member records or bulk-approve current profiles as part of the code change.
- Do not expose or transfer member profiles, photos, chats, or personal data to prospective buyers.
- Do not claim a feature is complete until automated tests and a real two-account end-to-end check pass.
