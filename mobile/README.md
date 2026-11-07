# NIVORA frontend

The frontend is a static HTML, CSS and browser-JavaScript application.

## Main files

- `index.html` — landing page and customer profile onboarding.
- `app.js` — main application flow.
- `common.js` — shared configuration and API helpers.
- `dashboard.html` / `portal.css` — customer dashboard and portal styles.
- `admin.html` / `admin.js` — staff-only administration interface.
- `privacy_ml.html` / `terms_ml.html` — Malayalam legal-information drafts.
- `privacy_en.html` / `terms_en.html` — English legal-information drafts.
- `supabase-config.js` — public frontend Supabase configuration; never place service-role keys here.

## Authentication

NIVORA currently exposes Google OAuth through Supabase Auth. Phone OTP is not part
of the current product.

## Local preview

From this directory, run a static HTTP server, for example:

```bash
python -m http.server 3002
```

Then open http://127.0.0.1:3002. Configure the frontend API base URL and Supabase
public configuration for the local environment as required.

## Production

The current public frontend is hosted on Render. The backend API is hosted separately.
Use the root README and `docs/SETUP-EXTERNAL.md` for the current service URLs and
remaining external setup checks.

Do not commit passwords, OAuth secrets, access tokens, or Supabase service-role keys.
