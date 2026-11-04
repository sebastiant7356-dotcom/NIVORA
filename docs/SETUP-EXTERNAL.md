# Remaining manual launch checks

The current public configuration is Google OAuth only, free matching, text chat and voice messages. Phone OTP, Razorpay payments and live voice/video calling are not part of the current launch. Do not configure an SMS provider, payment gateway or TURN service for this version.

## A. Google OAuth

1. In Supabase Authentication, confirm Google is the only sign-in method exposed by NIVORA.
2. Confirm the Google OAuth client has the current Supabase callback URL.
3. Confirm the Supabase Site URL and redirect allow-list include the deployed NIVORA frontend and any approved local development URL.
4. Test sign-in and sign-out using two separate customer Google accounts. Never share passwords or OTPs.

## B. Two-customer end-to-end test

Use two real test accounts and verify:
- First login and customer profile creation.
- Dashboard redirect on later login.
- Daily five recommendation quota and Kerala-day reset.
- More than one active match conversation.
- 72-hour chat window, text messages and voice messages.
- Shake & Chat location permission on/off, 50 km discovery, mutual interest and anonymous chat.
- One-sided reveal consent keeps both profiles hidden; both-sided consent reveals; withdrawal before mutual reveal works.
- Block, report, account export and account deletion.

Do not use staff accounts as customer test profiles.

## C. Legal and grievance review

Privacy Notice and Terms in Malayalam and English are drafts. Ask an Indian lawyer to review the applicable DPDP Act/Rules, IT Rules, grievance handling, data retention, cross-border processing, consent language and account-deletion process before broad public promotion.

Public support / grievance contact currently listed: nivora.helpdesk@gmail.com. The operator is an individual; there is no registered company at launch.

## D. Free-tier and security limitations

- Render and Supabase free-tier limits, sleep/cold-start behaviour and quotas apply.
- Supabase Security Advisor currently warns that leaked-password protection is disabled and unavailable on the current Free plan. Google OAuth is the only NIVORA login method, but do not describe this provider warning as resolved.
- Keep the Supabase service-role key in Render backend environment variables only.
- External AI screening remains off by default.
