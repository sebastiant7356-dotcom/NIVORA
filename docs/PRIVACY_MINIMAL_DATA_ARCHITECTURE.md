# BEYOND Minimal-Data Architecture

## Product decision
BEYOND retains only the Google/Supabase Auth account identity needed to sign in. Google passwords are never collected or stored. Member-generated content is session-only and must not be written to Supabase Postgres or Supabase Storage.

## Current implementation on this branch
- `backend/src/routes/ephemeral-api.js` replaces the legacy profile, discovery, match, chat, friend, community, safety, feedback, and account API mounts.
- `backend/src/lib/ephemeral-store.js` holds member content in volatile process memory with a 12-hour inactivity TTL and bounded capacity.
- The old database-backed member-content route modules remain in the repository for reference but are no longer mounted by `server.js`.
- Profile photos and voice uploads return a disabled response; UI upload controls are removed.
- Chat history, match history and durable friend lists are not available.
- Google authentication continues through Supabase Auth. Account deletion removes the Supabase Auth user.
- Static CI tests assert that the mounted minimal-data API has no Supabase table, RPC or Storage access.

## Important production limitations — not launch-ready
The current adapter uses one Render process's RAM. Render restarts, redeploys, memory pressure, or scaling to multiple instances can erase or split active sessions. A dedicated authenticated ephemeral WebSocket/presence service is still required for reliable production realtime behaviour. The Render service is currently configured as a single instance; this does not eliminate restart loss.

Block and report actions are also volatile. A report may disappear on restart or TTL expiry, and this version does not provide a durable staff moderation console. This is a material user-safety limitation. Do not market or release this version as a fully moderated public social network. A durable moderation system would require retaining limited report evidence, which conflicts with the strict "login details only" retention requirement; the product owner must explicitly choose between those requirements before public launch.

## Session data lifecycle
- Profile, exact location while opted in, discovery interest, active match, chat text, friend request, post, block, report and feedback are stored only in process memory.
- Each stored item has a maximum 12-hour inactivity lifetime; capacity eviction and process restart may remove it sooner.
- No user content is intended to survive logout/session expiry, process restart, or deployment.
- Exact coordinates are used only for distance calculation and are never returned to another member or written to a database.
- No message body, access token, password, or coordinate may be written to request logs.

## Authentication and security
- Google OAuth only; provider credentials remain with Google/Supabase.
- Backend verifies Supabase access tokens and requires the Google provider.
- Service-role credentials must never be shipped in the Android app.
- Profile and discovery require a declared age of at least 18. Age is self-declared, not independently verified.
- Mutual interest creates a chat; profile reveal and friendship each require separate mutual consent.
- TLS/WSS, strict CORS, rate limits and security headers remain required.

## Existing production data and rollout
Deploying the new route mount prevents this version from creating new member-content rows through the API, but it does not delete historical rows or Storage objects created by earlier versions. The Supabase project has existing legacy content tables and at least some historical profile/match rows. Do not claim the account-only retention goal is achieved until every legacy table and Storage bucket has been inventoried, a deletion plan is reviewed, and the deletion has been executed and verified. Preserve only Auth identities needed for login and any strictly required operator access-control configuration.

## Required verification before release
1. Run backend syntax checks and all tests.
2. Run two-account Android end-to-end tests for profile setup, location opt-in, discovery, mutual interest, anonymous chat, mutual reveal, friendship, blocking and account deletion.
3. Verify no API route writes member content to Postgres or Storage.
4. Verify the production Auth redirect allow-list and Google OAuth configuration.
5. Inventory and remove legacy database rows and Storage objects only after the new no-write deployment is confirmed healthy.
6. Decide whether durable safety reports are required. If yes, revise the strict retention policy before implementing durable moderation.
7. Replace the process-local adapter with a reliable ephemeral realtime service before multi-instance production use.

## Explicit product trade-offs
There is no saved profile, photo, voice message, chat history, match history, persistent friend list, post archive, or durable safety-report record. Users may need to re-enter profile information after a backend restart. This behaviour must be disclosed in onboarding, the Privacy Notice and the Terms.
