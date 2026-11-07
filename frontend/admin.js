/* NIVORA staff screen. All authorisation happens on the server (/api/admin/* checks staff_roles). */
(function () {
  "use strict";
  const { api, client, session, authPanel, esc } = window.NV;
  const $ = (s) => document.querySelector(s);
  let tab = "reports", role = null;
  const TABS = [["reports", "Open reports"], ["photos", "Pending photos"], ["history", "Moderation history"], ["audit", "Audit log"]];
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
      if (tab === "photos") return renderPendingPhotos((await api("/api/admin/pending-photos")).photos || []);
      if (tab === "history") return renderHistory((await api("/api/admin/moderation-history?limit=100")).events);
      if (tab === "audit") return renderAudit((await api("/api/admin/audit?limit=100")).entries);
      const r = await api(`/api/admin/profiles?status=${tab}&limit=50`);
      renderProfiles(r.profiles, r.total);
    } catch (e) { $("#list").innerHTML = ""; msg(e.message); }
  }

  function renderPendingPhotos(photos) {
    if (!photos.length) { $("#list").innerHTML = `<p>No photos are waiting for approval.</p>`; return; }
    $("#list").innerHTML = photos.map((ph) => `
      <div class="card" data-photo-id="${esc(ph.id)}">
        <h3>Pending profile photo</h3>
        <small>Member reference: ${esc(ph.user_id)} · submitted ${fmt(ph.created_at)}</small>
        <div class="photo-review"><img src="${esc(ph.url || "")}" alt="Photo awaiting staff approval"></div>
        ${ph.url ? "" : "<small>Preview unavailable; review actions are disabled.</small>"}
        <textarea placeholder="Reason (required when rejecting)" rows="2" maxlength="500"></textarea>
        <div class="admin-actions"><button data-pending-photo-decision="approved" type="button" ${ph.url ? "" : "disabled"}>Approve photo</button>
          <button data-pending-photo-decision="rejected" class="bad" type="button" ${ph.url ? "" : "disabled"}>Reject photo</button></div>
      </div>`).join("");
    $("#list").onclick = async (e) => {
      const button = e.target.closest("[data-pending-photo-decision]");
      if (!button) return;
      const card = button.closest("[data-photo-id]");
      const photoId = card?.dataset.photoId, decision = button.dataset.pendingPhotoDecision;
      const reason = card.querySelector("textarea")?.value || "";
      if (decision === "rejected" && reason.trim().length < 5) { msg("Enter a rejection reason (at least 5 characters)."); return; }
      if (!confirm(`Confirm photo ${decision}?`)) return;
      button.disabled = true;
      try {
        await api(`/api/admin/pending-photos/${encodeURIComponent(photoId)}/decision`, { method: "POST", body: { decision, reason } });
        msg("Photo decision saved.", true);
        load();
      } catch (e) { msg(e.message); button.disabled = false; }
    };
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
          <button data-hist class="alt" type="button">History</button>\n          <button data-photos class="alt" type="button">Review photos</button>
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
      else if (e.target.dataset.photos !== undefined) {
        try {
          const r = await api(`/api/admin/profiles/${id}/photos`);
          card.querySelector(".hist").innerHTML = r.photos.map((ph) => `
            <div class="photo-review"><img src="${esc(ph.url || "")}" alt="Submitted profile photo">
              <small>Status: ${esc(ph.approval_status)} ${ph.review_reason ? "· " + esc(ph.review_reason) : ""}</small>
              <button data-photo-decision="approved" data-photo-id="${esc(ph.id)}" type="button">Approve photo</button>
              <button data-photo-decision="rejected" data-photo-id="${esc(ph.id)}" class="bad" type="button">Reject photo</button>
            </div>`).join("") || "<small>No photos submitted.</small>";
        } catch (er) { msg(er.message); }
      }
      else if (e.target.dataset.photoDecision) {
        const photoId = e.target.dataset.photoId, decision = e.target.dataset.photoDecision;
        const note = card.querySelector("textarea")?.value || "";
        if (decision === "rejected" && note.trim().length < 5) { msg("Enter a rejection reason (at least 5 characters) in the reason box."); return; }
        if (!confirm(`Confirm photo ${decision}?`)) return;
        try {
          await api(`/api/admin/profiles/${id}/photos/${photoId}/decision`, { method: "POST", body: { decision, reason: note } });
          msg("Photo decision saved.", true);
          const r = await api(`/api/admin/profiles/${id}/photos`);
          card.querySelector(".hist").innerHTML = r.photos.map((ph) => `
            <div class="photo-review"><img src="${esc(ph.url || "")}" alt="Submitted profile photo">
              <small>Status: ${esc(ph.approval_status)} ${ph.review_reason ? "· " + esc(ph.review_reason) : ""}</small>
              <button data-photo-decision="approved" data-photo-id="${esc(ph.id)}" type="button">Approve photo</button>
              <button data-photo-decision="rejected" data-photo-id="${esc(ph.id)}" class="bad" type="button">Reject photo</button>
            </div>`).join("") || "<small>No photos submitted.</small>";
        } catch (er) { msg(er.message); }
      }
      else if (e.target.dataset.hist !== undefined) {
        try { const r = await api(`/api/admin/profiles/${id}`); card.querySelector(".hist").innerHTML = `<table class="audit"><tr><th>When</th><th>Decision</th><th>Reason</th></tr>${r.history.map((h) => `<tr><td>${fmt(h.created_at)}</td><td>${esc(h.decision)}</td><td>${esc(h.reason || "")}</td></tr>`).join("") || "<tr><td colspan=3>No decisions yet.</td></tr>"}</table><small>${r.reports.length} report(s) against this user</small>`; } catch (er) { msg(er.message); }
      }
    };
  }

  const postIdFor = (report) => (String(report.details || "").match(/Anonymous post ([0-9a-f-]{36})/i) || [])[1] || null;

  function renderReports(list) {
    if (!list.length) { $("#list").innerHTML = `<p>No open reports.</p>`; return; }
    $("#list").innerHTML = list.map((r) => `<div class="card" data-id="${esc(r.id)}"><h3>${esc(r.reason)}</h3><small>Filed ${fmt(r.created_at)} · reported user ${esc(r.reported_id || "deleted")}</small><p>${esc(r.details || "(no details)")}</p>
      <div class="admin-actions"><textarea placeholder="Resolution note (required)" rows="2" maxlength="500"></textarea>
      <button data-r="actioned" type="button">Mark actioned</button><button data-r="dismissed" class="alt" type="button">Dismiss</button>
      ${role === "admin" ? `<button data-r="actioned" data-s="1" class="bad" type="button">Action + suspend user</button>` : ""}
      ${r.reported_id ? `<button data-profile="${esc(r.reported_id)}" class="alt" type="button">View reported profile</button><button data-photos="${esc(r.reported_id)}" class="alt" type="button">View reported profile photos</button>` : ""}
      ${r.match_id ? `<button data-chat class="alt" type="button">View reported chat (audit-logged)</button><button data-voice class="alt" type="button">Review reported voice (audit-logged)</button>` : ""}
      ${postIdFor(r) ? `<button data-post="${esc(postIdFor(r))}" class="alt" type="button">View anonymous post (audit-logged)</button>` : ""}</div><div class="hist"></div></div>`).join("");
    $("#list").onclick = async (e) => {
      const card = e.target.closest(".card"); if (!card) return; const id = card.dataset.id;
      if (e.target.dataset.r) {
        try { await api(`/api/admin/reports/${id}/resolve`, { method: "POST", body: { status: e.target.dataset.r, resolution: card.querySelector("textarea").value, suspend_user: e.target.dataset.s === "1" } }); msg("Report resolved.", true); load(); } catch (er) { msg(er.message); }
      } else if (e.target.dataset.chat !== undefined) {
        if (!confirm("Reading a private conversation is logged in the audit trail. Continue?")) return;
        try { const r = await api(`/api/admin/reports/${id}/messages`); card.querySelector(".hist").innerHTML = r.messages.map((m) => `<div class="bubble theirs">${esc(m.body)}</div>`).join("") || "<small>No messages.</small>"; } catch (er) { msg(er.message); }
      } else if (e.target.dataset.post) {
        if (!confirm("Viewing an anonymous post report is audit-logged. Continue?")) return;
        try {
          const r = await api(`/api/admin/reports/${id}/anonymous-post`);
          card.querySelector(".hist").innerHTML = `<h4>Reported anonymous post</h4><p>${esc(r.post.body)}</p><small>Author: ${esc(r.post.author_id)} · Audience: ${esc(r.post.audience)} · Status: ${esc(r.post.status)}</small><div class="admin-actions"><button data-remove-post="${esc(r.post.id)}" class="bad" type="button">Remove post</button></div>`;
        } catch (er) { msg(er.message); }
      } else if (e.target.dataset.removePost) {
        const reason = card.querySelector("textarea")?.value || "";
        if (reason.trim().length < 5) { msg("Enter a removal reason (at least 5 characters) in the resolution box."); return; }
        if (!confirm("Remove this anonymous post?")) return;
        try {
          await api(`/api/admin/anonymous-posts/${encodeURIComponent(e.target.dataset.removePost)}/remove`, { method: "POST", body: { reason } });
          msg("Anonymous post removed.", true);
          load();
        } catch (er) { msg(er.message); }
      } else if (e.target.dataset.profile) {
        try {
          const r = await api(`/api/admin/profiles/${e.target.dataset.profile}`), p = r.profile;
          card.querySelector(".hist").innerHTML = `<h4>${esc(p.full_name)}, ${esc(p.age)} · ${esc(p.district || "—")}</h4><p>${esc(p.job_title || "—")} · ${esc(p.gender || "—")} · ${esc(p.relationship_intention || "—")}</p><p>${esc(p.bio || "")}</p><small>Status: ${esc(p.approval_status)}${p.suspended_at ? " · SUSPENDED" : ""} · ${r.reports.length} report(s)</small>`;
        } catch (er) { msg(er.message); }
      } else if (e.target.dataset.photos) {
        if (!confirm("Viewing a reported member’s private profile photos is audit-logged. Continue?")) return;
        try {
          const r = await api(`/api/admin/profiles/${e.target.dataset.photos}/photos`);
          card.querySelector(".hist").innerHTML = r.photos.map((ph) => `<div class="photo-review"><img src="${esc(ph.url || "")}" alt="Reported profile photo"><small>${esc(ph.approval_status)}</small></div>`).join("") || "<small>No profile photos.</small>";
        } catch (er) { msg(er.message); }
      } else if (e.target.dataset.voice !== undefined) {
        if (!confirm("Reviewing private voice messages is logged in the audit trail. Continue?")) return;
        try {
          const r = await api(`/api/admin/reports/${id}/voice`);
          const box = card.querySelector(".hist"); box.innerHTML = r.voice_messages.map((v) => `<div class="voice-review"><small>${fmt(v.created_at)} · ${esc(v.sender_id)} · ${esc(v.duration_seconds)}s</small><audio controls preload="none" src="${esc(v.url)}"></audio></div>`).join("") || "<small>No voice messages in this conversation.</small>";
        } catch (er) { msg(er.message); }
      }
    };
  }

  const renderHistory = (ev) => ($("#list").innerHTML = `<table class="audit"><tr><th>When</th><th>Profile</th><th>Decision</th><th>Reason</th></tr>${ev.map((h) => `<tr><td>${fmt(h.created_at)}</td><td>${esc(h.profile_id)}</td><td>${esc(h.decision)}</td><td>${esc(h.reason || "")}</td></tr>`).join("")}</table>`);
  const renderAudit = (en) => ($("#list").innerHTML = `<table class="audit"><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>${en.map((a) => `<tr><td>${fmt(a.created_at)}</td><td>${esc(a.actor_id || "system")}</td><td>${esc(a.action)}</td><td>${esc(a.target_type || "")} ${esc(a.target_id || "")}</td></tr>`).join("")}</table>`);

  boot();
})();
