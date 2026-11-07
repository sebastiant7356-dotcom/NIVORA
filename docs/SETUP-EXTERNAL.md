# Remaining manual launch checks — NIVORA Android

The current app direction is Google OAuth only, Kerala-only Shake & Chat, anonymous posts, mutual friendships, text chat and voice messages. The frontend is embedded in Android; no new public website is required. Phone OTP, Razorpay payments and live voice/video calling are not part of the current launch. Do not configure an SMS provider, payment gateway or TURN service for this version.

## A. Google OAuth

1. In Supabase Authentication, confirm Google is the only sign-in method exposed by NIVORA.
2. Confirm the Google OAuth client has the current Supabase callback URL.
3. Add the exact Android redirect `in.nivora.social://auth/callback` to Supabase Authentication → URL Configuration → Redirect URLs. Keep the Google provider's authorised callback as the Supabase Auth callback URL.
4. Test sign-in and sign-out using two separate customer Google accounts. Never share passwords or OTPs.

Public legal URLs on the existing backend host: `https://nivora-backend.onrender.com/legal/privacy.html` and `https://nivora-backend.onrender.com/legal/terms.html`. Use the privacy URL in the Play Store listing; no separate public frontend website is needed.

## B. Two-customer end-to-end test

Use two real test accounts and verify:
- First login and customer profile creation.
- Dashboard redirect on later login.
- Shake discovery within selected 1–100 km radius and Kerala-only member eligibility.
- More than one active match conversation.
- Persistent Shake and friend chats with no automatic time limit; text and voice messages.
- Location permission on/off, physical Shake, mutual interest, anonymous chat and profile visibility.
- One-sided reveal consent keeps identity hidden; both-sided consent reveals a public profile; hidden profiles remain hidden.
- Mutual friend acceptance, anonymous posts, post report/block, staff removal, account export and account deletion.

Do not use staff accounts as customer test profiles.

## C. Legal and grievance review

Privacy Notice and Terms in Malayalam and English are drafts. Ask an Indian lawyer to review the applicable DPDP Act/Rules, IT Rules, grievance handling, data retention, cross-border processing, consent language and account-deletion process before broad public promotion.

Public support / grievance contact currently listed: nivora.helpdesk@gmail.com. The operator is an individual; there is no registered company at launch. Play Store release also requires a signed Android App Bundle, developer account, applicable closed testing and Google review.

## D. Free-tier and security limitations

- Render and Supabase free-tier limits, sleep/cold-start behaviour and quotas apply.
- Supabase Security Advisor currently warns that leaked-password protection is disabled and unavailable on the current Free plan. Google OAuth is the only NIVORA login method, but do not describe this provider warning as resolved.
- Keep the Supabase service-role key in Render backend environment variables only.
- External AI screening remains off by default.
