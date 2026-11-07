/* BEYOND account restriction appeal form. */
(function () {
  "use strict";
  const { api, client, session, authPanel, esc } = window.NV;
  const $ = (s) => document.querySelector(s);
  const msg = (t, ok) => { const m = $("#msg"); m.textContent = t || ""; m.className = "nv-msg" + (ok ? " ok" : ""); };
  async function boot() {
    $("#signOut").onclick = async () => { await client().auth.signOut(); location.reload(); };
    if (!(await session())) {
      $("#auth").hidden = false;
      try { await authPanel($("#auth")); } catch { return; }
    }
    if (await session()) {
      $("#auth").hidden = true;
      $("#appealForm").hidden = false;
      $("#signOut").hidden = false;
    }
    $("#appealForm").onsubmit = async (e) => {
      e.preventDefault();
      const reason = $("#reason").value.trim();
      if (reason.length < 5) { msg("Explain why the restriction should be reviewed."); return; }
      $("#submit").disabled = true; msg("Submitting appeal…");
      try {
        await api("/api/account/appeal", { method: "POST", body: { reason } });
        $("#appealForm").hidden = true;
        msg("Your appeal has been submitted. The moderation team will review it.", true);
      } catch (er) { msg(er.message); }
      finally { $("#submit").disabled = false; }
    };
  }
  boot();
})();