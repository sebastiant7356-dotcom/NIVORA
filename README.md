# NIVORA — Oraal Mathi

A mobile-first, English-language prototype for a serious relationship / life-partner matchmaking service. This package is intended for local testing from Android Termux before deciding what to build for a public launch.

## Run on Android with Termux

1. Install/update Node.js in Termux:

   ```sh
   pkg update
   pkg install nodejs-lts unzip
   ```

2. Put `NIVORA_Demo.zip` in your phone's Downloads folder. If needed, grant Termux file access:

   ```sh
   termux-setup-storage
   ```

3. Extract and enter the project folder (adjust the ZIP path if you saved it elsewhere):

   ```sh
   cd ~/storage/downloads
   unzip NIVORA_Demo.zip -d ~/NIVORA
   cd ~/NIVORA
   ```

   If the ZIP itself contains a top-level `NIVORA` folder, use `cd ~/NIVORA/NIVORA` instead. The provided ZIP is packaged with project files at its root, so `cd ~/NIVORA` is the expected path.

4. Start the local server:

   ```sh
   npm start
   ```

5. Open Chrome on the same phone and visit:

   **http://127.0.0.1:3000**

Keep Termux open while testing. To stop the server, return to Termux and press `Ctrl+C` (volume-down + C on many Android keyboards).

## What works in this demo

- Responsive landing page, dark mode toggle, and English UI.
- Profile creation with age validation (21–40) and serious-relationship intent validation.
- Local JSON persistence across server restarts.
- Fictional sample match generation and a three-day expiry timestamp.
- Review and report demo forms.
- A clearly labelled ₹50 payment concept flow that **does not collect money**.
- Reset demo data button.

## Important: not ready for public launch

This is a product prototype, not a live matchmaking service. The sample matches are fictional. It has no real account authentication, phone OTP, private chat, voice calls, human moderation, verified payment integration, real match algorithm, or staff console. The local JSON database is for demos only and is not suitable for real personal information or multiple public users. Do not enter real or sensitive personal details.

Before public launch, implement and test secure accounts and sessions, access controls, server-side validation, real consent and safety/report workflows, staff moderation tools, abuse prevention, reliable data storage/backups, account deletion and retention rules, a real payment provider with clear refunds/expiry rules, privacy policy and terms, and applicable Indian privacy/consumer/legal compliance. Do not advertise a match as guaranteed or claim a profile is verified unless that is genuinely implemented.

## Project structure

- `server.js` — Node built-in HTTP server and local demo API
- `public/index.html` — landing page and demo profile UI
- `public/styles.css` — responsive visual design and dark mode styles
- `public/app.js` — demo interactions
- `data/demo-db.json` — generated local demo data (created on first run)

No npm dependencies are required. Node.js 18 or newer is recommended.
