/* MELVO shared browser helpers: config, Google OAuth, Supabase client and API calls. */
(function () {
  "use strict";
  const cfg = window.MELVO_CONFIG || {};
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const API = String(cfg.apiBase || (isLocal ? `${location.protocol}//${location.hostname}:4000` : "")).replace(/\/+$/, "");

  const S = {
    en: {
      noApi: "The server address is not configured. Set apiBase in supabase-config.js.",
      network: "Could not reach the server. Check your connection and try again.",
      generic: "Something went wrong. Please try again.",
      sessionExpired: "Your session expired. Please sign in again.",
      signInTitle: "Sign in", cancel: "Cancel"
    },
    ml: {
      noApi: "Server address configure cheythittilla. supabase-config.js-ൽ apiBase നൽകുക.",
      network: "Server-ലേക്ക് എത്താൻ കഴിഞ്ഞില്ല. Connection പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
      generic: "എന്തോ പിശക് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക.",
      sessionExpired: "Session കഴിഞ്ഞു. വീണ്ടും sign in ചെയ്യുക.",
      signInTitle: "Sign in", cancel: "റദ്ദാക്കുക"
    }
  };
  const lang = () => (typeof language !== "undefined" ? language : "en");
  const t = (k) => (S[lang()] && S[lang()][k]) || S.en[k] || k;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // The Supabase library loads from a CDN <script> tag. On a slow connection it can still be
  // downloading when a button is tapped; `ready` resolves once it has actually arrived.
  const ready = new Promise((resolve) => {
    if (window.supabase?.createClient) { resolve(); return; }
    const iv = setInterval(() => { if (window.supabase?.createClient) { clearInterval(iv); resolve(); } }, 100);
  });

  let _client;
  function client() {
    if (!window.supabase?.createClient || !cfg.url || !cfg.key) throw new Error("Could not load the sign-in library. Try switching WiFi/mobile data, turn off any VPN or Private DNS, then reload the page.");
    if (!_client) _client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return _client;
  }

  async function session() {
    const { data } = await client().auth.getSession();
    return data.session || null;
  }

  async function api(path, { method = "GET", body, retry = true } = {}) {
    if (!API) throw new Error(t("noApi"));
    const s = await session();
    if (!s) { const e = new Error(t("sessionExpired")); e.status = 401; throw e; }
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch { throw new Error(t("network")); }
    if (res.status === 401 && retry) {
      const { data } = await client().auth.refreshSession();
      if (data?.session) return api(path, { method, body, retry: false });
      await client().auth.signOut();
      const e = new Error(t("sessionExpired")); e.status = 401; throw e;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(json.message || t("generic")); e.status = res.status; e.code = json.code; throw e; }
    return json;
  }

  /**
   * Renders a "Continue with Google" sign-in UI into `container`. Google sends the browser
   * away and back (OAuth redirect), so this promise does not resolve on success — callers
   * that need to resume afterwards should check `session()` again once the page reloads.
   * Rejects only if the person cancels.
   */
  function authPanel(container, { onCancel } = {}) {
    return new Promise((resolve, reject) => {
      container.innerHTML = `<h2 class="modal-title">${t("signInTitle")}</h2>
        <p class="modal-description">${lang() === "ml" ? "Google അക്കൗണ്ട് ഉപയോഗിച്ച് സുരക്ഷിതമായി തുടരുക." : "Continue securely with your Google account."}</p>
        <div class="nv-msg" id="nvMsg" role="status"></div>
        <div class="nv-row"><button class="primary-btn" id="nvGoogleAuth" type="button">Google ഉപയോഗിച്ച് തുടരുക / Continue with Google</button></div>
        <div class="nv-row"><button class="back-btn" id="nvCancel" type="button">${t("cancel")}</button></div>`;
      container.querySelector("#nvGoogleAuth").onclick = async () => {
        const btn = container.querySelector("#nvGoogleAuth");
        btn.disabled = true; btn.textContent = "Opening Google…";
        try { await signInWithGoogle(); }
        catch (e) {
          container.querySelector("#nvMsg").textContent = e.message || t("generic");
          btn.disabled = false; btn.textContent = "Google ഉപയോഗിച്ച് തുടരുക / Continue with Google";
        }
      };
      container.querySelector("#nvCancel").onclick = () => { onCancel && onCancel(); reject(new Error("cancelled")); };
    });
  }

  async function signInWithGoogle() {
    if (window.NivoraNative?.isNative?.()) return window.NivoraNative.signInWithGoogle();
    const { data, error } = await client().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
    return data;
  }

  window.NV = { API, cfg, client, session, api, authPanel, signInWithGoogle, t, esc, lang, isLocal, ready };
  window.NivoraNative?.handlePending?.();
})();
