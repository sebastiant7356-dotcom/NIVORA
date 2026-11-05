# NIVORA — Buyer Handover Guide

Last updated: 2026-11-05

This document describes the handover package that can be prepared for a successful
acquisition. It is not confirmation that provider accounts or credentials have
already been transferred.

## 1. Source code and intellectual property

- Repository: https://github.com/sebastiant7356-dotcom/NIVORA
- Default branch: main
- Frontend: static HTML, CSS and browser JavaScript in `frontend/`.
- Backend: Node.js / Express API in `backend/`.
- Database schema and migrations: `backend/migrations/`.
- Tests and syntax checks: `backend/tests/` and `backend/scripts/`.

The repository includes a proprietary-use notice. Before signing a sale agreement,
the seller and buyer should verify authorship, any third-party contributions,
dependency licenses, fonts, images, and other asset rights. Third-party materials
are not automatically transferred by a sale of this repository.

## 2. Database and authentication

The application uses Supabase PostgreSQL and Supabase Auth with Google OAuth.
The buyer should receive:
- SQL schema and migration files in the repository.
- Guidance to create or take control of a Supabase project, subject to provider rules.
- Google OAuth callback and redirect configuration instructions.
- Storage bucket and access-policy configuration guidance.

Database contents containing personal/member data must be handled separately from
the source-code transfer. Any transfer must have a lawful basis, appropriate user
notice/consent, and a documented data migration or deletion plan. Do not assume
member data is included in an asset sale.

## 3. Hosting and environment configuration

The application is currently deployed using Render and Supabase. Provider account
ownership and service transfer are subject to each provider's current policies.

Preferred handover:
1. Buyer creates or controls their own Render and Supabase accounts/projects.
2. Buyer configures services from the source repository and documented settings.
3. Seller provides environment-variable NAMES and setup guidance, not secret values.
4. Buyer creates fresh credentials and OAuth configuration.
5. Seller/buyer validate deployment and health checks.
6. Existing seller credentials are rotated or revoked after cutover.

Never send passwords, OAuth client secrets, Supabase service-role keys, API tokens,
or recovery codes in email, chat, issue trackers, or this repository.

## 4. Backend environment variables

A placeholder template is provided at `backend/.env.example`. It contains names
and example placeholders only. Real values must be created in the buyer's accounts.

Required for normal backend startup:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` in production

Optional/configurable variables are documented in the template, including
`PORT`, `TRUST_PROXY`, `CONSENT_POLICY_VERSION`, payment placeholders and
external AI settings. Payments and external AI are not required for the current
free launch. Live voice/video calling is not part of the current product.

## 5. Deployment and verification

Before accepting final handover:
- Run `npm ci`, `npm test`, and `npm run check` from `backend/`.
- Deploy frontend and backend under buyer-controlled accounts.
- Verify `/api/health`.
- Configure Google OAuth and test with two independent customer accounts.
- Test profile creation, Daily 5, multiple matches, 72-hour chat, voice messages,
  Shake & Chat, consent/reveal, blocking, reporting, export and deletion.
- Verify privacy notice, terms, data retention and grievance process with qualified
  Indian legal counsel before broad public operation.

The repository README and `docs/SETUP-EXTERNAL.md` list known outstanding checks.

## 6. Commercial and transition terms

The proposed asking price and any transition-support period must be written into a
separate purchase agreement. The parties should define:
- Exact assets included and excluded.
- Whether any member data is excluded, migrated, or deleted.
- IP assignment date and payment conditions.
- Third-party services and licenses that remain subject to provider terms.
- Support scope, duration, and response expectations.
- Responsibility for legal compliance and service costs after transfer.

No cloud credentials are promised as a direct password handover. Infrastructure
should be transferred where supported or recreated under buyer control.
