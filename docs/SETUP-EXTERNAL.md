# Remaining manual launch checks — MELVO Android

The current product direction is Google OAuth only, global Shake & Chat, anonymous posts, mutual friendships, text chat and voice messages. The frontend is embedded in Android; no separate public frontend website is required. Phone OTP, Razorpay payments and live voice/video calling are not part of this release.

## A. Google OAuth

1. In Supabase Authentication, confirm Google is the only customer sign-in method exposed.
2. Confirm the Google OAuth client has the current Supabase callback URL.
3. Add the exact Android redirect `in.melvo.social://auth/callback` to Supabase Authentication → URL Configuration → Redirect URLs. Keep the Google provider's authorised callback as the Supabase Auth callback URL.
4. Test sign-in and sign-out using two separate customer Google accounts.

Public legal URLs on the existing backend host:
- https://nivora-backend.onrender.com/legal/privacy.html
- https://nivora-backend.onrender.com/legal/terms.html

Use the privacy URL in the Play Store listing; no separate public frontend website is required.

## B. Two-customer end-to-end test

Use two real test accounts in different locations and verify:
- First login and customer profile creation with city/region/country.
- Dashboard redirect on later login.
- Shake discovery within selected 1–100 km radius, including across national borders.
- Persistent Shake and friend chats with no automatic time limit; text and voice messages.
- Location permission on/off, physical Shake, mutual interest, anonymous chat and profile visibility.
- One-sided reveal consent keeps identity hidden; both-sided consent reveals a public profile; hidden profiles remain hidden.
- Mutual friend acceptance, global anonymous posts, radius-audience posts, post report/block, staff removal, account export and account deletion.

Do not use staff accounts as customer test profiles.

## C. Legal and grievance review

Privacy Notice and Terms in Malayalam and English are drafts. Before a public worldwide launch, obtain qualified legal review for India and each target market, including privacy, data transfers, age eligibility, user-generated content, child safety, moderation, consumer rules and grievance handling.

Public support / grievance contact currently listed: nivora.helpdesk@gmail.com. The operator is an individual; there is no registered company at launch. Play Store release also requires a signed Android App Bundle, developer account, applicable closed testing and Google review.

## D. Free-tier and security limitations

- Render and Supabase free-tier limits, sleep/cold-start behaviour and quotas apply.
- Supabase Security Advisor currently warns that leaked-password protection is disabled and unavailable on the current Free plan. Google OAuth is the only MELVO login method, but do not describe this provider warning as resolved.
- Keep the Supabase service-role key in Render backend environment variables only.
- External AI screening remains off by default.
