/* NIVORA staff screen. All authorisation happens on the server (/api/admin/* checks staff_roles). */
(function () {
  "use strict";
  const { api, client, session, authPanel, esc } = window.NV;
  const $ = (s) => document.querySelector(s);
  let tab = "pending", role = null;
  const TABS = [["pending", "Pending"], ["changes_requested", "Changes requested"], ["approved", "Approved"], ["rejected", "Rejected"], ["reports", "Open reports"], ["history", "Moderation history"], ["audit", "Audit log"]];
  const msg = (t, ok) => { const m = $("#msg"); m.textContent = t || ""; m.className = "nv-msg" + (ok ? " ok" : ""); };
  const fmt = (i) => (i ? new Date(i).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

  async function boot() {
    $("#signOut").onclick = async () => { await client().auth.signOut(); location.reload(); };
    if (!(await session())) {
      $("#auth").style.display = "block";
      try { await authPanel($("#auth")); } catch { return; }
    }
    try { role = (await api("/api/admin/me")).role; }
    catch (e) {
      $("#auth").style.display = "block";
      $("#auth").innerHTML = `<div class="card"><h3>Not authorised</h3><p>${e.status === 403 ? "This account is not a staff member." : esc(e.message)}</p><a class="outline-btn" href="index.html">Back to NIVORA</a></div>`;
      $("#signOut").style.display = "inline-block"; return;
    }
    $("#auth").style.display = "none"; $("#app").style.display = "block";
    $("#who").style.display = "inline-block"; $("#who").textContent = role; $("#signOut").style.display = "inline-block";
    $("#tabs").innerHTML = TABS.map(([k, l]) => `<button class="tab" data-t="${k}" type="button">${l}</button>`).join("");
    $("#tabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { tab = b.dataset.t; load(); } };
    load();
  }

  async function load() {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.t === tab));
    msg(""); $("#list").innerHTML = `<p>Loading…</p>`;
    try {
      if (tab === "reports") return renderReports((await api("/api/admin/reports?status=open")).reports);
      if (tab === "history") return renderHistory((await api("/api/admin/moderation-history?limit=100")).events);
      if (tab === "audit") return renderAudit((await api("/api/admin/audit?limit=100")).entries);
      const r = await api(`/api/admin/profiles?status=${tab}&limit=50`);
      renderProfiles(r.profiles, r.total);
    } catch (e) { $("#list").innerHTML = ""; msg(e.message); }
  }

  const flags = (p) => `${(p.ai_flags || []).map((f) => `<span class="flag ${esc(f.severity)}" title="${esc(f.detail)}">${esc(f.code)}</span>`).join("") || "<small>No flags</small>"}
    <div class="advisory">AI-assisted screening (${esc(p.ai_source || "none")}) · risk ${p.ai_risk_score ?? "—"}/100 · advisory only — a human makes the decision.</div>`;

  function renderProfiles(list, total) {
    if (!list.length) { $("#list").innerHTML = `<p>Nothing here.</p>`; return; }
    $("#list").innerHTML = `<small>${total} total</small>` + list.map((p) => `
      <div class="card" data-id="${esc(p.id)}">
        <h3>${esc(p.full_name)}, ${esc(p.age)} <small>· ${esc(p.district || "—")} · ${esc(p.gender || "—")}</small></h3>
        <small>${esc(p.job_title || "—")} · seeks ${esc(p.looking_for || "—")} · ${esc(p.relationship_intention || "—")} · partner age ${esc(p.min_partner_age)}–${esc(p.max_partner_age)} · values: ${esc((p.core_values || []).join(", ") || "—")}</small>
        <p>${esc(p.bio || "")}</p>
        <div>${flags(p)}</div>
        <small>Submitted ${fmt(p.created_at)} · consent ${fmt(p.consent_privacy_at)} (v ${esc(p.consent_version || "—")}) · status <b>${esc(p.approval_status)}</b>${p.suspended_at ? " · <b>SUSPENDED</b>" : ""}${p.review_reason ? ` · note: ${esc(p.review_reason)}` : ""}</small>
        <div class="admin-actions">
          <textarea placeholder="Reason (required for reject / request changes)" rows="2" maxlength="500"></textarea>
          <button data-d="approved" type="button">Approve</button>
          <button data-d="changes_requested" class="alt" type="button">Request changes</button>
          <button data-d="rejected" class="bad" type="button">Reject</button>
          <button data-ai class="alt" type="button">Re-run screening</button>
          <button data-hist class="alt" type="button">History</button>
          ${role === "admin" ? (p.suspended_at ? `<button data-un class="alt" type="button">Reinstate</button>` : `<button data-su class="bad" type="button">Suspend</button>`) : ""}
        </div><div class="hist"></div>
      </div>`).join("");
    $("#list").onclick = async (e) => {
      const card = e.target.closest(".card"); if (!card) return;
      const id = card.dataset.id, reason = card.querySelector("textarea")?.value || "";
      const run = async (fn, okMsg) => { try { await fn(); msg(okMsg, true); load(); } catch (er) { msg(er.message); } };
      if (e.target.dataset.d) { if (!confirm(`Confirm: ${e.target.dataset.d}?`)) return; run(() => api(`/api/admin/profiles/${id}/decision`, { method: "POST", body: { decision: e.target.dataset.d, reason } }), "Decision saved."); }
      else if (e.target.dataset.ai !== undefined) run(() => api(`/api/admin/profiles/${id}/rerun-ai`, { method: "POST" }), "Screening refreshed.");
      else if (e.target.dataset.su !== undefined) { if (!confirm("Suspend this user? Their live match ends.")) return; run(() => api(`/api/admin/users/${id}/suspend`, { method: "POST", body: { reason } }), "User suspended."); }
      else if (e.target.dataset.un !== undefined) run(() => api(`/api/admin/users/${id}/reinstate`, { method: "POST", body: { reason } }), "User reinstated.");
      else if (e.target.dataset.hist !== undefined) {
        try { const r = await api(`/api/admin/profiles/${id}`); card.querySelector(".hist").innerHTML = `<table class="audit"><tr><th>When</th><th>Decision</th><th>Reason</th></tr>${r.history.map((h) => `<tr><td>${fmt(h.created_at)}</td><td>${esc(h.decision)}</td><td>${esc(h.reason || "")}</td></tr>`).join("") || "<tr><td colspan=3>No decisions yet.</td></tr>"}</table><small>${r.reports.length} report(s) against this user</small>`; } catch (er) { msg(er.message); }
      }
    };
  }

  function renderReports(list) {
    if (!list.length) { $("#list").innerHTML = `<p>No open reports.</p>`; return; }
    $("#list").innerHTML = list.map((r) => `<div class="card" data-id="${esc(r.id)}"><h3>${esc(r.reason)}</h3><small>Filed ${fmt(r.created_at)} · reported user ${esc(r.reported_id || "deleted")}</small><p>${esc(r.details || "(no details)")}</p>
      <div class="admin-actions"><textarea placeholder="Resolution note (required)" rows="2" maxlength="500"></textarea>
      <button data-r="actioned" type="button">Mark actioned</button><button data-r="dismissed" class="alt" type="button">Dismiss</button>
      ${role === "admin" ? `<button data-r="actioned" data-s="1" class="bad" type="button">Action + suspend user</button>` : ""}
      ${r.match_id ? `<button data-chat class="alt" type="button">View reported chat (audit-logged)</button>` : ""}</div><div class="hist"></div></div>`).join("");
    $("#list").onclick = async (e) => {
      const card = e.target.closest(".card"); if (!card) return; const id = card.dataset.id;
      if (e.target.dataset.r) {
        try { await api(`/api/admin/reports/${id}/resolve`, { method: "POST", body: { status: e.target.dataset.r, resolution: card.querySelector("textarea").value, suspend_user: e.target.dataset.s === "1" } }); msg("Report resolved.", true); load(); } catch (er) { msg(er.message); }
      } else if (e.target.dataset.chat !== undefined) {
        if (!confirm("Reading a private conversation is logged in the audit trail. Continue?")) return;
        try { const r = await api(`/api/admin/reports/${id}/messages`); card.querySelector(".hist").innerHTML = r.messages.map((m) => `<div class="bubble theirs">${esc(m.body)}</div>`).join("") || "<small>No messages.</small>"; } catch (er) { msg(er.message); }
      }
    };
  }

  const renderHistory = (ev) => ($("#list").innerHTML = `<table class="audit"><tr><th>When</th><th>Profile</th><th>Decision</th><th>Reason</th></tr>${ev.map((h) => `<tr><td>${fmt(h.created_at)}</td><td>${esc(h.profile_id)}</td><td>${esc(h.decision)}</td><td>${esc(h.reason || "")}</td></tr>`).join("")}</table>`);
  const renderAudit = (en) => ($("#list").innerHTML = `<table class="audit"><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>${en.map((a) => `<tr><td>${fmt(a.created_at)}</td><td>${esc(a.actor_id || "system")}</td><td>${esc(a.action)}</td><td>${esc(a.target_type || "")} ${esc(a.target_id || "")}</td></tr>`).join("")}</table>`);

  boot();
})();
