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
- Store metadata in a dedicated table; use short-lived signed URLs.
- Delete orphaned media and define retention/deletion behavior.
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
- Existing matching RPC created one proposed match at a time, enforced one live match per member, and excluded previously paired member pairs. The feature branch now adds a database-enforced quota of five successful recommendations per member per Asia/Kolkata calendar day. Recommendations are sequential: a member must finish, decline, or expire the current proposal/conversation before requesting another. This does not yet support five simultaneous chats.
- The deployed matching RPC currently sets the proposal response deadline to 48 hours. The desired product decision mentions the existing 72-hour conversation window; proposal and active-chat timing must be reconciled before implementation.
- Existing chat messages are text-only in the `messages` table.
- Existing frontend still contains old payment and voice-call UI copy.
- README contains stale local-demo/phone-OTP information and must be rewritten before public launch.

## Implementation sequence

1. Reconcile product rules and database state (especially proposal vs active chat timing).
2. [Feature branch implementation added] Enforce five successful recommendations per member per Asia/Kolkata day in the database, with per-member transaction locking, RLS on the quota table, no-repeat rules, and a visible quota counter. It remains sequential (one live match at a time); multiple simultaneous chats require a separate schema and portal redesign. Apply and verify the migration in a non-production Supabase branch before any production rollout.
3. Add private voice-message storage, metadata, authorization, limits, retention, and chat UI.
4. Remove call signalling/WebRTC from public member experience and disable public call API routes.
5. Implement safe auto-approval only for low-risk profiles; retain human review for flags and all photo risk cases.
6. Remove payment/paid-credit requirements from the free launch path without deleting payment history or secrets.
7. Update Malayalam/English product copy, privacy/terms/consent, README, and launch instructions.
8. Add tests for quota boundaries, timezone, duplicate prevention, concurrency, media authorization, file limits, report/block interactions, and disabled calls.
9. Run syntax/tests, inspect Supabase security/performance advisors, then prepare a reviewed pull request. Production database changes and deployment remain separate explicit steps.

## Non-goals / safeguards

- Do not delete or recreate GitHub, Supabase, or Render projects/services.
- Do not alter existing member records or bulk-approve current profiles as part of the code change.
- Do not expose or transfer member profiles, photos, chats, or personal data to prospective buyers.
- Do not claim a feature is complete until automated tests and a real two-account end-to-end check pass.
