# NIVORA frontend (static)

Files: `index.html` (landing + profile wizard), `portal.js` ("My space": status, edit, match, chat, voice, payment, account), `admin.html` + `admin.js` (staff), `common.js` (config, API calls, phone-OTP panel), `supabase-config.js` (public config), `styles.css` (original design) + `portal.css`, `privacy.html` (DRAFT).

Local: `python -m http.server 3002` → http://127.0.0.1:3002 (API auto-resolves to http://127.0.0.1:4000).
Production: set `apiBase` in `supabase-config.js` to your HTTPS API.
The AI-generated portraits on the landing page are illustrations, labelled as samples — never real members.
