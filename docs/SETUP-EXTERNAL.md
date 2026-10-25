# External configuration still required (nothing here can be done from code)

## A. Supabase Phone Auth + SMS (required for sign-in)
1. Dashboard → Authentication → Providers → **Phone**: enable. Choose an SMS provider (Twilio / Twilio Verify / MessageBird / Vonage / TextLocal) and paste its credentials in the dashboard (not in this repo).
2. **India:** commercial SMS needs TRAI DLT registration (entity, sender ID, OTP template) with your provider. Without it, delivery to Indian numbers can fail. OTP delivery was **not** tested by the author of this change.
3. Authentication → Providers → **Email**: disable sign-ups (NIVORA is phone-only).
4. Authentication → Rate Limits: review "SMS messages sent per hour" and OTP expiry/length (default 6 digits, 1 hour; consider 5–10 minutes).
5. Development without SMS: Authentication → Phone → **Test phone numbers** (fixed OTPs) so you can sign in on Termux without sending real SMS.
6. URL Configuration: set Site URL to your frontend domain in production.

## B. Razorpay ₹50 payment (optional until you want revenue)
1. Create a Razorpay account (KYC complete for live mode). Copy **Key ID** and **Key Secret** → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Dashboard → Webhooks → add `https://<api-domain>/api/payments/webhook`, events `payment.captured`, `order.paid`, `payment.failed`; set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Ensure payments auto-capture (the backend only credits `captured` payments).
4. Product decision: `PAYMENT_REQUIRED=true` makes each proposed match consume one paid credit (not refunded if declined/expired). `false` leaves payment optional/unused. Refunds and GST invoicing are not implemented.

## C. TURN server for voice calls
STUN alone fails on many mobile/NAT networks. Run coturn or use a TURN provider (Twilio NTS, Metered, Cloudflare Calls TURN) and set `ICE_SERVERS_JSON` (see `.env.example`). Static TURN credentials are served only to members of a live match; for production prefer short-lived credentials from your provider.

## D. Optional external AI review
Off by default (`AI_EXTERNAL_ENABLED=false`); the built-in rule screening needs nothing. If you enable it, your privacy policy must say redacted about-you and work/study text is sent to the AI provider. Names, IDs, phones are never sent.

## E. Legal / policy (manual)
Privacy policy, terms, grievance contact, data-retention periods, age-verification approach (the app collects a declared age only), and complaint handling. `frontend/privacy.html` is a draft.
