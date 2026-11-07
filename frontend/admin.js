/* BEYOND safety moderation console. All permissions are verified by the backend. */
(function () {
  "use strict";
  const { api, client, session, authPanel, esc } = window.NV;
  const $ = (s) => document.querySelector(s);
  let role = null, status = "open";
  const fmt = (v) => v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const msg = (t, ok) => { const m = $("#msg"); m.textContent = t || ""; m.className = "nv-msg" + (ok ? " ok" : ""); };

  async function boot() {
    $("#signOut").onclick = async () => { await client().auth.signOut(); location.reload(); };
    if (!(await session())) {
      $("#auth").style.display = "block";
      try { await authPanel($("#auth")); } catch { return; }
    }
    try { role = (await api("/api/admin/me")).role; }
    catch (e) {
      $("#auth").style.display = "block";
      $("#auth").innerHTML = '<div class="card"><h3>Not authorised</h3><p>' + esc(e.message) + '</p><a class="outline-btn" href="index.html">Back to BEYOND</a></div>';
      $("#signOut").style.display = "inline-block"; return;
    }
    $("#auth").style.display = "none"; $("#app").style.display = "block";
    $("#who").style.display = "inline-block"; $("#who").textContent = role;
    $("#signOut").style.display = "inline-block";
    $("#tabs").innerHTML = [["open","Open reports"],["appeals","Appeals"],["actioned","Actioned"],["dismissed","Dismissed"],...(role === "admin" ? [["restricted","Restricted accounts"],["audit","Audit log"]] : [])]
      .map(([v,l]) => '<button class="tab" data-status="' + v + '" type="button">' + l + '</button>').join("");
    $("#tabs").onclick = (e) => { const b = e.target.closest("[data-status]"); if (b) { status = b.dataset.status; load(); } };
    load();
  }

  async function load() {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.status === status));
    msg(""); $("#list").innerHTML = "<p>Loading reports…</p>";
    try {
      if (status === "restricted") {
        const r = await api("/api/admin/enforcements");
        return renderEnforcements(r.accounts || []);
      }
      if (status === "appeals") {
        const r = await api("/api/admin/appeals");
        return renderAppeals(r.appeals || []);
      }
      if (status === "audit") {
        const r = await api("/api/admin/audit");
        return renderAudit(r.entries || []);
      }
      const r = await api("/api/admin/reports?status=" + encodeURIComponent(status));
      render(r.reports || []);
    } catch (e) { $("#list").innerHTML = ""; msg(e.message); }
  }

  function renderAudit(entries) {
    if (!entries.length) { $("#list").innerHTML = "<p>No moderation actions recorded.</p>"; return; }
    $("#list").innerHTML = '<table class="audit"><tr><th>When</th><th>Moderator</th><th>Action</th><th>Target</th></tr>' +
      entries.map(a => '<tr><td>' + fmt(a.created_at) + '</td><td>' + esc(a.actor_id || "system") +
        '</td><td>' + esc(a.action) + '</td><td>' + esc(a.target_type || "") + ' ' + esc(a.target_id || "") +
        '<small>' + esc(a.details?.resolution || a.details?.reason || "") + '</small></td></tr>').join("") + '</table>';
  }

  function renderAppeals(appeals) {
    if (!appeals.length) { $("#list").innerHTML = "<p>No open appeals.</p>"; return; }
    $("#list").innerHTML = appeals.map(a => `
      <section class="card" data-id="${esc(a.id)}">
        <h3>Account restriction appeal</h3>
        <small>Account ${esc(a.user_id || "deleted account")} · Filed ${fmt(a.created_at)}</small>
        <p>${esc(a.reason)}</p>
        <textarea rows="2" maxlength="500" placeholder="Required decision note (at least 5 characters)"></textarea>
        <div class="admin-actions">
          ${role === "admin" ? '<button data-appeal="approved" type="button">Approve & reinstate</button>' : ""}
          <button data-appeal="rejected" class="alt" type="button">Reject appeal</button>
        </div>
      </section>`).join("");
    $("#list").onclick = async (e) => {
      const decision = e.target.dataset.appeal;
      if (!decision) return;
      const card = e.target.closest("[data-id]");
      const resolution = card.querySelector("textarea")?.value.trim() || "";
      if (resolution.length < 5) { msg("Enter a decision note of at least 5 characters."); return; }
      if (!confirm("Confirm appeal decision: " + decision + "?")) return;
      try {
        await api("/api/admin/appeals/" + encodeURIComponent(card.dataset.id) + "/resolve", {
          method: "POST", body: { status: decision, resolution }
        });
        msg("Appeal decision saved.", true); load();
      } catch (er) { msg(er.message); }
    };
  }

  function renderEnforcements(accounts) {
    if (!accounts.length) { $("#list").innerHTML = "<p>No currently restricted accounts.</p>"; return; }
    $("#list").innerHTML = accounts.map(a => `
      <section class="card" data-user="${esc(a.user_id)}">
        <h3>${esc(a.status.toUpperCase())}</h3>
        <small>Account ${esc(a.user_id)} · Updated ${fmt(a.updated_at)} · ${a.expires_at ? "Until " + fmt(a.expires_at) : "No expiry set"}</small>
        <p>${esc(a.reason)}</p>
        <div class="admin-actions"><button data-reinstate type="button">Reinstate account</button></div>
      </section>`).join("");
    $("#list").onclick = async (e) => {
      if (e.target.dataset.reinstate === undefined) return;
      const card = e.target.closest("[data-user]");
      if (!confirm("Reinstate this account?")) return;
      try {
        await api("/api/admin/users/" + encodeURIComponent(card.dataset.user) + "/enforcement", {
          method: "POST", body: { status: "active", reason: "Restriction reviewed and lifted by an administrator." }
        });
        msg("Account reinstated.", true); load();
      } catch (er) { msg(er.message); }
    };
  }

  function render(reports) {
    if (!reports.length) { $("#list").innerHTML = "<p>No " + esc(status) + " reports.</p>"; return; }
    $("#list").innerHTML = reports.map(r => `
      <section class="card" data-id="${esc(r.id)}" data-user="${esc(r.reported_id || "")}">
        <h3>${esc(r.reason)}</h3>
        <small>Filed ${fmt(r.created_at)} · Reporter ${esc(r.reporter_id || "deleted account")} · Reported account ${esc(r.reported_id || "deleted account")} · Reports in this queue: ${esc(r.repeat_report_count || 1)}</small>
        <p>${esc(r.details || "No additional details supplied.")}</p>
        ${status === "open" ? `
          <textarea rows="2" maxlength="500" placeholder="Required moderation note (at least 5 characters)"></textarea>
          <div class="admin-actions">
            <button data-resolve="actioned" type="button">Mark actioned</button>
            <button data-resolve="dismissed" class="alt" type="button">Dismiss report</button>
            ${role === "admin" ? '<button data-enforce="suspended" class="bad" type="button">Suspend account</button><button data-enforce="banned" class="bad" type="button">Ban account</button>' : ""}
          </div>` : `<p><b>Resolution:</b> ${esc(r.resolution || "—")}</p><small>Resolved ${fmt(r.resolved_at)}</small>`}
      </section>`).join("");
    $("#list").onclick = async (e) => {
      const card = e.target.closest("[data-id]"); if (!card) return;
      const note = card.querySelector("textarea")?.value.trim() || "";
      if (e.target.dataset.resolve) {
        if (note.length < 5) { msg("Enter a moderation note of at least 5 characters."); return; }
        if (!confirm("Save this report decision?")) return;
        try {
          await api("/api/admin/reports/" + encodeURIComponent(card.dataset.id) + "/resolve", {
            method: "POST", body: { status: e.target.dataset.resolve, resolution: note }
          });
          msg("Report decision saved.", true); load();
        } catch (er) { msg(er.message); }
      } else if (e.target.dataset.enforce) {
        if (note.length < 5) { msg("Enter a reason of at least 5 characters."); return; }
        const action = e.target.dataset.enforce;
        if (!confirm("Confirm " + action + " for this account?")) return;
        try {
          await api("/api/admin/users/" + encodeURIComponent(card.dataset.user) + "/enforcement", {
            method: "POST", body: { status: action, reason: note }
          });
          await api("/api/admin/reports/" + encodeURIComponent(card.dataset.id) + "/resolve", {
            method: "POST", body: { status: "actioned", resolution: note }
          });
          msg("Account enforcement and report decision saved.", true); load();
        } catch (er) { msg(er.message); }
      }
    };
  }
  boot();
})();