/* NIVORA member portal: profile status/edit, matching, chat, voice, payment, safety, account. Depends on common.js */
(function () {
  "use strict";
  const { api, client, session, signInWithGoogle, esc } = window.NV;
  const L = () => (typeof language !== "undefined" ? language : "en");

  const P = {
    en: {
      myspace: "My space", signIn: "Sign in", signOut: "Sign out", loading: "Loading…", close: "Close",
      noProfile: "You have not created a profile yet.", createProfile: "Create my profile",
      status_pending: "Awaiting staff review", status_approved: "Approved", status_rejected: "Not approved", status_changes_requested: "Changes requested",
      suspended: "Your account is suspended. Please contact support.", incomplete: "Your profile is missing some details (gender, preferences, values). Please edit it before matching.",
      reason: "Staff note", editProfile: "Edit profile", save: "Save changes", saving: "Saving…", saved: "Saved.", reviewNote: "Changing name, age, gender, location, work or about-you sends your profile back for staff review.",
      rejectedNote: "This profile was not approved and cannot be edited here.",
      matching: "Your match", findMatch: "Find my match", finding: "Searching…", noMatchNow: "No suitable profile is available right now. Please check again later.",
      needApproval: "Matching opens after staff approve your profile.", payNeeded: "A paid ₹50 credit is needed to get a match.",
      accept: "Accept", decline: "Decline", waitingPartner: "You accepted. Waiting for the other person to respond.", waitingYou: "A match is waiting for your response.",
      proposalEnds: "Respond before", endMatch: "End match", endConfirm: "End this match? Chat and calls will close.",
      timeLeft: "Chat window left", closed: "Closed", chat: "Chat", typeMsg: "Write a message…", send: "Send", live: "Live", reconnecting: "Reconnecting…",
      chatClosed: "This conversation is closed (match ended or 72 hours are over).", call: "Voice call", hangup: "End call", incoming: "Incoming voice call", answer: "Answer",
      calling: "Calling…", inCall: "In call", noMic: "Microphone is unavailable or permission was denied.", noWebrtc: "Voice calls need HTTPS (or localhost) and a modern browser.",
      callFailed: "Call could not connect. A TURN server may be needed on this network.",
      report: "Report", block: "Block", blockConfirm: "Block this person? The match ends and you will never be matched again.",
      reportTitle: "Report this person", reportSend: "Send report", reportThanks: "Report received. Our team will review it.",
      r_harassment: "Harassment", r_fake_profile: "Fake profile", r_scam: "Scam / money request", r_inappropriate_content: "Inappropriate content", r_underage: "Looks underage", r_other: "Other",
      details: "Details (optional)", feedback: "Feedback", wantContinue: "I would like to continue getting to know them", dontContinue: "I do not want to continue", sendFeedback: "Send feedback", feedbackThanks: "Thank you for your feedback.",
      pastMatches: "Past matches", none: "None yet.", from: "Started",
      payment: "Match credit (₹50)", payOff: "Payments are not enabled on this server yet.", pay: "Pay ₹50", hasCredit: "You have a paid credit ready.", payVerifying: "Confirming payment…", paid: "Payment confirmed.", payFail: "Payment could not be confirmed.",
      account: "Account & privacy", export: "Download my data", del: "Delete my account", delWarn: "This permanently deletes your profile, matches and chats. Type DELETE to confirm.", delDone: "Your account was deleted.",
      adminLink: "Staff review screen", values: "Values", intention: "Intention", sharedValues: "Shared values",
      v_family: "Family", v_kindness: "Kindness & respect", v_career: "Career", v_faith: "Faith / culture", v_communication: "Open communication", v_lifestyle: "Lifestyle",
      marriage: "Marriage", longterm: "Long-term relationship", woman: "Woman", man: "Man", other: "Other", any: "Open to possibilities",
      name: "Name", age: "Age", place: "Location", job: "Work / study", about: "About you", lookingFor: "I'm looking for", relationship: "Relationship intention", minAge: "Partner min age", maxAge: "Partner max age"
    },
    ml: {
      myspace: "എന്റെ ഇടം", signIn: "Sign in", signOut: "Sign out", loading: "ലോഡ് ചെയ്യുന്നു…", close: "അടയ്ക്കുക",
      noProfile: "നിങ്ങൾ ഇതുവരെ profile ഉണ്ടാക്കിയിട്ടില്ല.", createProfile: "എന്റെ profile ഉണ്ടാക്കാം",
      status_pending: "Staff review കാത്തിരിക്കുന്നു", status_approved: "അംഗീകരിച്ചു", status_rejected: "അംഗീകരിച്ചില്ല", status_changes_requested: "മാറ്റങ്ങൾ ആവശ്യപ്പെട്ടിട്ടുണ്ട്",
      suspended: "നിങ്ങളുടെ account suspend ചെയ്തിരിക്കുന്നു. Support-നെ ബന്ധപ്പെടുക.", incomplete: "Profile-ൽ ചില വിവരങ്ങൾ കുറവാണ് (gender, preferences, values). Matching-ന് മുമ്പ് edit ചെയ്യുക.",
      reason: "Staff കുറിപ്പ്", editProfile: "Profile edit ചെയ്യുക", save: "സേവ് ചെയ്യുക", saving: "സേവ് ചെയ്യുന്നു…", saved: "സേവ് ചെയ്തു.", reviewNote: "പേര്, വയസ്സ്, gender, സ്ഥലം, ജോലി, about മാറ്റിയാൽ profile വീണ്ടും staff review-ലേക്ക് പോകും.",
      rejectedNote: "ഈ profile അംഗീകരിച്ചിട്ടില്ല; ഇവിടെ edit ചെയ്യാനാകില്ല.",
      matching: "നിങ്ങളുടെ match", findMatch: "എന്റെ match കണ്ടെത്തുക", finding: "തിരയുന്നു…", noMatchNow: "ഇപ്പോൾ അനുയോജ്യമായ profile ഇല്ല. പിന്നീട് നോക്കുക.",
      needApproval: "Staff profile അംഗീകരിച്ച ശേഷം matching തുറക്കും.", payNeeded: "Match ലഭിക്കാൻ ₹50 credit ആവശ്യമാണ്.",
      accept: "സ്വീകരിക്കുക", decline: "നിരസിക്കുക", waitingPartner: "നിങ്ങൾ സ്വീകരിച്ചു. മറ്റേയാളുടെ മറുപടി കാത്തിരിക്കുന്നു.", waitingYou: "ഒരു match നിങ്ങളുടെ മറുപടി കാത്തിരിക്കുന്നു.",
      proposalEnds: "ഇതിനുമുമ്പ് മറുപടി നൽകുക", endMatch: "Match അവസാനിപ്പിക്കുക", endConfirm: "ഈ match അവസാനിപ്പിക്കണോ? Chat, call അടയും.",
      timeLeft: "Chat സമയം ബാക്കി", closed: "അടച്ചു", chat: "Chat", typeMsg: "സന്ദേശം എഴുതുക…", send: "അയയ്ക്കുക", live: "ലൈവ്", reconnecting: "വീണ്ടും ബന്ധിപ്പിക്കുന്നു…",
      chatClosed: "ഈ സംഭാഷണം അടച്ചു (match അവസാനിച്ചു / 72 മണിക്കൂർ കഴിഞ്ഞു).", call: "Voice call", hangup: "Call അവസാനിപ്പിക്കുക", incoming: "Voice call വരുന്നു", answer: "എടുക്കുക",
      calling: "വിളിക്കുന്നു…", inCall: "Call-ൽ", noMic: "Microphone ലഭ്യമല്ല അല്ലെങ്കിൽ അനുമതി നിഷേധിച്ചു.", noWebrtc: "Voice call-ന് HTTPS (അല്ലെങ്കിൽ localhost) ഉം പുതിയ browser ഉം വേണം.",
      callFailed: "Call connect ആയില്ല. ഈ network-ൽ TURN server വേണ്ടിവന്നേക്കാം.",
      report: "Report", block: "Block", blockConfirm: "ഇവരെ block ചെയ്യണോ? Match അവസാനിക്കും, വീണ്ടും match ചെയ്യില്ല.",
      reportTitle: "ഇവരെ report ചെയ്യുക", reportSend: "Report അയയ്ക്കുക", reportThanks: "Report ലഭിച്ചു. ഞങ്ങളുടെ ടീം പരിശോധിക്കും.",
      r_harassment: "ശല്യപ്പെടുത്തൽ", r_fake_profile: "വ്യാജ profile", r_scam: "തട്ടിപ്പ് / പണം ആവശ്യപ്പെടൽ", r_inappropriate_content: "അനുചിതമായ ഉള്ളടക്കം", r_underage: "പ്രായപൂർത്തിയായില്ലെന്ന് തോന്നുന്നു", r_other: "മറ്റുള്ളവ",
      details: "വിശദാംശങ്ങൾ (ഓപ്ഷണൽ)", feedback: "Feedback", wantContinue: "കൂടുതൽ പരിചയപ്പെടാൻ താൽപര്യമുണ്ട്", dontContinue: "തുടരാൻ താൽപര്യമില്ല", sendFeedback: "Feedback അയയ്ക്കുക", feedbackThanks: "Feedback-ന് നന്ദി.",
      pastMatches: "മുൻ match-കൾ", none: "ഇതുവരെ ഇല്ല.", from: "തുടങ്ങിയത്",
      payment: "Match credit (₹50)", payOff: "ഈ server-ൽ payment ഇതുവരെ enable ചെയ്തിട്ടില്ല.", pay: "₹50 അടയ്ക്കുക", hasCredit: "Paid credit തയ്യാറാണ്.", payVerifying: "Payment സ്ഥിരീകരിക്കുന്നു…", paid: "Payment സ്ഥിരീകരിച്ചു.", payFail: "Payment സ്ഥിരീകരിക്കാനായില്ല.",
      account: "Account & സ്വകാര്യത", export: "എന്റെ data download ചെയ്യുക", del: "എന്റെ account delete ചെയ്യുക", delWarn: "Profile, match, chat എല്ലാം സ്ഥിരമായി മായും. സ്ഥിരീകരിക്കാൻ DELETE എന്ന് ടൈപ്പ് ചെയ്യുക.", delDone: "നിങ്ങളുടെ account delete ചെയ്തു.",
      adminLink: "Staff review screen", values: "മൂല്യങ്ങൾ", intention: "ലക്ഷ്യം", sharedValues: "പൊതുവായ മൂല്യങ്ങൾ",
      v_family: "കുടുംബം", v_kindness: "ദയയും ബഹുമാനവും", v_career: "കരിയർ", v_faith: "വിശ്വാസം / സംസ്കാരം", v_communication: "തുറന്ന സംഭാഷണം", v_lifestyle: "ജീവിതശൈലി",
      marriage: "വിവാഹം", longterm: "ദീർഘകാല ബന്ധം", woman: "സ്ത്രീ", man: "പുരുഷൻ", other: "മറ്റൊന്ന്", any: "തുറന്ന മനസ്സോടെ",
      name: "പേര്", age: "വയസ്സ്", place: "സ്ഥലം", job: "ജോലി / പഠനം", about: "നിങ്ങളെക്കുറിച്ച്", lookingFor: "ഞാൻ അന്വേഷിക്കുന്നത്", relationship: "ബന്ധത്തിന്റെ ലക്ഷ്യം", minAge: "പങ്കാളിയുടെ കുറഞ്ഞ വയസ്സ്", maxAge: "പങ്കാളിയുടെ കൂടിയ വയസ്സ്"
    }
  };
  const p = (k) => (P[L()] && P[L()][k]) || P.en[k] || k;

  // ---------- modal shell ----------
  let modal, body;
  function ensureModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.id = "portalModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<section class="profile-modal portal-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button" aria-label="Close" id="portalClose">×</button><div id="portalBody"></div></section>`;
    document.body.appendChild(modal);
    body = modal.querySelector("#portalBody");
    modal.querySelector("#portalClose").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  }
  function open() { ensureModal(); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; }
  function close() { stopRealtime(); endCall(false); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } document.body.style.overflow = ""; clearInterval(tickTimer); }

  // ---------- state ----------
  let me = null, profile = null, match = null, payInfo = null, history = [], isStaff = false;
  let tickTimer = null, chatChannel = null, signalChannel = null, pollTimer = null, seen = new Set(), lastTs = null;
  let pc = null, localStream = null, pendingIce = [], incomingOffer = null, callState = "idle";
  const val = (k) => (k in (profile || {}) ? profile[k] : "");

  async function loadAll() {
    const s = await session(); me = s?.user || null;
    const [pr, m, pay, h] = await Promise.all([
      api("/api/profile"), api("/api/match/current").catch(() => ({ match: null })),
      api("/api/payments/status").catch(() => null), api("/api/match/history").catch(() => ({ history: [] }))
    ]);
    profile = pr.profile; match = m.match; payInfo = pay; history = h.history || [];
    isStaff = await api("/api/admin/me").then(() => true).catch(() => false);
  }

  // Shows a "Continue with Google" button and starts the OAuth redirect. Google sends the
  // browser away from the page, so this never resolves here — resumePortalLogin() below
  // picks the flow back up once the browser returns.
  function googleSignInPanel(container, { onCancel } = {}) {
    return new Promise((resolve, reject) => {
      container.innerHTML = `<h2 class="modal-title">${L() === "ml" ? "Sign in" : "Sign in"}</h2>
        <p class="modal-description">${L() === "ml" ? "Google അക്കൗണ്ട് ഉപയോഗിച്ച് സുരക്ഷിതമായി തുടരുക." : "Continue securely with your Google account."}</p>
        <div class="nv-msg" id="nvPortalErr" role="status"></div>
        <button class="primary-btn" id="nvPortalGoogle" type="button">Google ഉപയോഗിച്ച് തുടരുക / Continue with Google</button>
        <button class="back-btn" id="nvPortalCancel" type="button">${L() === "ml" ? "റദ്ദാക്കുക" : "Cancel"}</button>`;
      container.querySelector("#nvPortalGoogle").onclick = async () => {
        const btn = container.querySelector("#nvPortalGoogle");
        btn.disabled = true; btn.textContent = "Opening Google…";
        try { sessionStorage.setItem("nivora_pending_portal", "1"); await signInWithGoogle(); }
        catch (e) {
          sessionStorage.removeItem("nivora_pending_portal");
          container.querySelector("#nvPortalErr").textContent = e.message || "Google sign-in failed.";
          btn.disabled = false; btn.textContent = "Google ഉപയോഗിച്ച് തുടരുക / Continue with Google";
        }
      };
      container.querySelector("#nvPortalCancel").onclick = () => { onCancel && onCancel(); reject(new Error("cancelled")); };
    });
  }

  // ---------- entry points ----------
  async function openPortal(startWizard) {
    open();
    body.innerHTML = `<p class="modal-description">${p("loading")}</p>`;
    try {
      if (!(await session())) {
        await googleSignInPanel(body, { onCancel: close });
      }
      await loadAll();
      if (!profile && startWizard) { close(); startWizard(); return; }
      render();
    } catch (e) {
      if (e.message === "cancelled") return;
      body.innerHTML = `<p class="nv-msg">${esc(e.message)}</p><button class="outline-btn" id="pRetry" type="button">OK</button>`;
      body.querySelector("#pRetry").onclick = close;
    }
  }

  // Called after Google redirects back to the page, if a "My space" sign-in was in progress.
  async function resumePortalLogin() {
    let pending;
    try { pending = sessionStorage.getItem("nivora_pending_portal"); } catch (_) { /* ignore */ }
    if (!pending) return;
    let s;
    try { s = await session(); } catch (_) { return; }
    if (!s) return;
    try { sessionStorage.removeItem("nivora_pending_portal"); } catch (_) { /* ignore */ }
    await openPortal();
  }

  // Called by the profile wizard on its final step. Returns the saved profile or {existing:true}.
  async function submitProfile(form, onNeedAuth) {
    if (!(await session())) await onNeedAuth();
    const existing = await api("/api/profile");
    if (existing.profile) return { existing: true, profile: existing.profile };
    const payload = {
      full_name: form.name.trim(), age: Number(form.age), district: form.place.trim(), gender: form.gender,
      job_title: form.job.trim(), bio: form.about.trim(), looking_for: form.lookingFor,
      relationship_intention: form.relationship, core_values: form.values,
      min_partner_age: form.minAge ? Number(form.minAge) : 21, max_partner_age: form.maxAge ? Number(form.maxAge) : 40,
      consents: { terms: !!form.agree, privacy: !!form.privacyAgree }
    };
    return api("/api/profile", { method: "POST", body: payload });
  }

  // ---------- rendering ----------
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(L() === "ml" ? "ml-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
  const valName = (v) => p("v_" + v);

  function partnerHtml(pt) {
    if (!pt) return "";
    return `<div class="summary-box"><b>${esc(pt.first_name)}, ${esc(pt.age)}</b><br>${esc(pt.district || "—")} · ${esc(pt.job_title || "—")}<br>
      <b>${p("intention")}:</b> ${esc(p(pt.relationship_intention))}<br>
      <b>${p("values")}:</b> ${esc((pt.core_values || []).map(valName).join(", ") || "—")}<br>
      ${pt.shared_values?.length ? `<b>${p("sharedValues")}:</b> ${esc(pt.shared_values.map(valName).join(", "))}<br>` : ""}
      ${pt.bio ? `<br>${esc(pt.bio)}` : ""}</div>`;
  }

  function render() {
    clearInterval(tickTimer); stopRealtime();
    let h = `<div class="modal-topline"><span class="section-kicker">${p("myspace")}</span></div>`;
    if (!profile) {
      h += `<p class="modal-description">${p("noProfile")}</p><button class="primary-btn" id="pCreate" type="button">${p("createProfile")} <span class="arrow">→</span></button>`;
    } else {
      const st = profile.approval_status;
      h += `<h2 class="modal-title">${esc(profile.full_name)}, ${esc(profile.age)}</h2>
        <div class="badge badge-${esc(st)}">${p("status_" + st)}</div>
        ${profile.review_reason && st !== "approved" ? `<p class="modal-description"><b>${p("reason")}:</b> ${esc(profile.review_reason)}</p>` : ""}
        ${profile.suspended ? `<p class="nv-msg">${p("suspended")}</p>` : ""}
        ${!profile.profile_complete ? `<p class="nv-msg">${p("incomplete")}</p>` : ""}
        <div class="nv-row">${st !== "rejected" ? `<button class="outline-btn" id="pEdit" type="button">${p("editProfile")}</button>` : `<small>${p("rejectedNote")}</small>`}</div>`;

      h += `<h3 class="nv-h">${p("matching")}</h3><div id="matchBox"></div>`;
      h += `<h3 class="nv-h">${p("payment")}</h3><div id="payBox"></div>`;
      if (history.length) {
        h += `<h3 class="nv-h">${p("pastMatches")}</h3><ul class="nv-list">${history.filter((x) => !["proposed", "active"].includes(x.status)).map((x) =>
          `<li>${p("from")}: ${esc(fmt(x.started_at || x.created_at))} · ${esc(x.status)} ${x.started_at ? `<button class="nv-link" data-fb="${esc(x.id)}" type="button">${p("feedback")}</button>` : ""}</li>`).join("") || `<li>${p("none")}</li>`}</ul><div id="fbBox"></div>`;
      }
    }
    h += `<h3 class="nv-h">${p("account")}</h3><div class="nv-row">
      <button class="outline-btn" id="pExport" type="button">${p("export")}</button>
      <button class="outline-btn danger" id="pDelete" type="button">${p("del")}</button>
      <button class="outline-btn" id="pSignOut" type="button">${p("signOut")}</button>
      ${isStaff ? `<a class="outline-btn" href="admin.html">${p("adminLink")}</a>` : ""}</div><div class="nv-msg" id="pMsg" role="status"></div>`;
    body.innerHTML = h;

    const $ = (s) => body.querySelector(s);
    $("#pCreate") && ($("#pCreate").onclick = () => { close(); window.openWizard && window.openWizard(); });
    $("#pEdit") && ($("#pEdit").onclick = renderEdit);
    $("#pSignOut").onclick = async () => { await client().auth.signOut(); close(); };
    $("#pExport").onclick = exportData;
    $("#pDelete").onclick = deleteAccount;
    body.querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => feedbackForm(b.dataset.fb)));
    if (profile) { renderMatch(); renderPay(); }
  }

  function msg(text, ok) { const el = body.querySelector("#pMsg"); if (el) { el.textContent = text; el.className = "nv-msg" + (ok ? " ok" : ""); } }

  // ----- edit profile -----
  function renderEdit() {
    const vs = ["family", "kindness", "career", "faith", "communication", "lifestyle"];
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map((o) => `<option value="${o}" ${cur === o ? "selected" : ""}>${p(o)}</option>`).join("")}</select>`;
    body.innerHTML = `<h2 class="modal-title">${p("editProfile")}</h2><p class="modal-description">${p("reviewNote")}</p>
      <div class="field-grid"><div class="field"><label>${p("name")}</label><input id="eName" value="${esc(val("full_name"))}"></div><div class="field"><label>${p("age")}</label><input id="eAge" type="number" min="21" max="40" value="${esc(val("age"))}"></div></div>
      <div class="field"><label>${p("place")}</label><input id="ePlace" value="${esc(val("district"))}"></div>
      <div class="field"><label>${p("job")}</label><input id="eJob" value="${esc(val("job_title"))}"></div>
      <div class="field"><label>${p("lookingFor")}</label>${sel("eLook", ["woman", "man", "any"], val("looking_for"))}</div>
      <div class="field"><label>${p("relationship")}</label>${sel("eRel", ["marriage", "longterm"], val("relationship_intention"))}</div>
      <div class="field-grid"><div class="field"><label>${p("minAge")}</label><input id="eMin" type="number" min="21" max="40" value="${esc(val("min_partner_age"))}"></div><div class="field"><label>${p("maxAge")}</label><input id="eMax" type="number" min="21" max="40" value="${esc(val("max_partner_age"))}"></div></div>
      <label class="field-label">${p("values")}</label><div class="choice-grid">${vs.map((v) => `<label class="choice"><input type="checkbox" name="eVals" value="${v}" ${(profile.core_values || []).includes(v) ? "checked" : ""}> ${valName(v)}</label>`).join("")}</div>
      <div class="field"><label>${p("about")}</label><textarea id="eAbout" rows="4" maxlength="1000">${esc(val("bio"))}</textarea></div>
      <div class="nv-msg" id="pMsg"></div><div class="nv-row"><button class="primary-btn" id="eSave" type="button">${p("save")}</button><button class="back-btn" id="eBack" type="button">${p("close")}</button></div>`;
    const $ = (s) => body.querySelector(s);
    $("#eBack").onclick = render;
    $("#eSave").onclick = async () => {
      const vals = [...body.querySelectorAll("[name=eVals]:checked")].map((x) => x.value);
      if (vals.length < 1 || vals.length > 3) return msg(L() === "ml" ? "1 മുതൽ 3 വരെ മൂല്യങ്ങൾ തിരഞ്ഞെടുക്കുക." : "Choose 1 to 3 values.");
      $("#eSave").disabled = true; $("#eSave").textContent = p("saving");
      try {
        const r = await api("/api/profile", { method: "PUT", body: {
          full_name: $("#eName").value, age: Number($("#eAge").value), district: $("#ePlace").value, job_title: $("#eJob").value,
          bio: $("#eAbout").value, looking_for: $("#eLook").value, relationship_intention: $("#eRel").value,
          min_partner_age: Number($("#eMin").value), max_partner_age: Number($("#eMax").value), core_values: vals } });
        profile = r.profile; await loadAll(); render(); msg(r.message || p("saved"), true);
      } catch (e) { $("#eSave").disabled = false; $("#eSave").textContent = p("save"); msg(e.message); }
    };
  }

  // ----- match, chat, voice -----
  function renderMatch() {
    const box = body.querySelector("#matchBox");
    if (profile.approval_status !== "approved") { box.innerHTML = `<p class="modal-description">${p("needApproval")}</p>`; return; }
    if (!match) {
      const needPay = payInfo?.required && !payInfo?.has_credit;
      box.innerHTML = `${needPay ? `<p class="modal-description">${p("payNeeded")}</p>` : ""}<div class="nv-row"><button class="primary-btn" id="mFind" type="button" ${needPay || !profile.profile_complete || profile.suspended ? "disabled" : ""}>${p("findMatch")}</button></div><div class="nv-msg" id="mMsg"></div>`;
      box.querySelector("#mFind").onclick = async (ev) => {
        ev.target.disabled = true; ev.target.textContent = p("finding");
        try {
          const r = await api("/api/match/find", { method: "POST" });
          if (!r.found) { box.querySelector("#mMsg").textContent = r.message || p("noMatchNow"); ev.target.disabled = false; ev.target.textContent = p("findMatch"); return; }
          await loadAll(); render();
        } catch (e) { box.querySelector("#mMsg").textContent = e.message; ev.target.disabled = false; ev.target.textContent = p("findMatch"); }
      };
      return;
    }
    const m = match;
    let h = partnerHtml(m.partner);
    if (m.status === "proposed") {
      h += m.i_accepted ? `<p class="modal-description">${p("waitingPartner")}</p>` : `<p class="modal-description">${p("waitingYou")} · ${p("proposalEnds")} ${esc(fmt(m.proposal_expires_at))}</p>`;
      h += `<div class="nv-row">${m.i_accepted ? "" : `<button class="primary-btn" id="mAccept" type="button">${p("accept")}</button>`}<button class="outline-btn" id="mDecline" type="button">${p("decline")}</button></div>`;
    } else if (m.status === "active") {
      h += `<div class="countdown">${p("timeLeft")}: <b id="mLeft"></b></div>
        <div class="chat" id="chat"><div class="chat-status" id="chatStatus">${p("live")}</div><div class="chat-log" id="chatLog" aria-live="polite"></div>
        <div class="chat-input"><input id="chatText" maxlength="2000" placeholder="${p("typeMsg")}"><button class="primary-btn" id="chatSend" type="button">${p("send")}</button></div></div>
        <div class="nv-row"><button class="outline-btn" id="callBtn" type="button">☏ ${p("call")}</button><button class="outline-btn" id="mEnd" type="button">${p("endMatch")}</button></div>
        <div id="callBox" class="callbox" aria-live="polite"></div><audio id="remoteAudio" autoplay playsinline></audio>`;
    }
    h += `<div class="nv-row nv-links"><button class="nv-link" id="mReport" type="button">${p("report")}</button><button class="nv-link" id="mBlock" type="button">${p("block")}</button></div><div id="safeBox"></div><div class="nv-msg" id="mMsg"></div>`;
    box.innerHTML = h;
    const $ = (s) => box.querySelector(s);
    const respond = async (accept) => { try { await api(`/api/match/${m.id}/respond`, { method: "POST", body: { accept } }); await loadAll(); render(); } catch (e) { $("#mMsg").textContent = e.message; } };
    $("#mAccept") && ($("#mAccept").onclick = () => respond(true));
    $("#mDecline") && ($("#mDecline").onclick = () => respond(false));
    $("#mEnd") && ($("#mEnd").onclick = async () => { if (!confirm(p("endConfirm"))) return; try { await api(`/api/match/${m.id}/end`, { method: "POST" }); await loadAll(); render(); } catch (e) { $("#mMsg").textContent = e.message; } });
    $("#mReport").onclick = () => reportForm(m.id);
    $("#mBlock").onclick = async () => { if (!confirm(p("blockConfirm"))) return; try { const r = await api("/api/safety/block", { method: "POST", body: { match_id: m.id } }); await loadAll(); render(); msg(r.message, true); } catch (e) { $("#mMsg").textContent = e.message; } };
    if (m.status === "active") startChat(m);
  }

  function setStatus(txt) { const el = body.querySelector("#chatStatus"); if (el) el.textContent = txt; }
  function appendMsg(m) {
    if (seen.has(m.id)) return; seen.add(m.id);
    if (!lastTs || m.created_at > lastTs) lastTs = m.created_at;
    const log = body.querySelector("#chatLog"); if (!log) return;
    const d = document.createElement("div"); d.className = "bubble " + (m.mine ? "mine" : "theirs"); d.textContent = m.body;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function closeChat() {
    setStatus(p("chatClosed"));
    const i = body.querySelector("#chatText"), b = body.querySelector("#chatSend"); if (i) i.disabled = true; if (b) b.disabled = true;
    const c = body.querySelector("#callBtn"); if (c) c.disabled = true;
    endCall(false); stopRealtime();
  }

  async function startChat(m) {
    seen = new Set(); lastTs = null;
    const left = () => Math.max(0, Math.floor((new Date(m.expires_at) - Date.now()) / 1000));
    const tick = () => {
      const s = left(), el = body.querySelector("#mLeft"); if (!el) return;
      el.textContent = s > 0 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s` : p("closed");
      if (s <= 0) { clearInterval(tickTimer); closeChat(); loadAll().then(render).catch(() => {}); }
    };
    tick(); tickTimer = setInterval(tick, 1000);

    const pull = async () => {
      try {
        const r = await api(`/api/chat/${m.id}/messages` + (lastTs ? `?after=${encodeURIComponent(lastTs)}` : ""));
        r.messages.forEach(appendMsg);
      } catch (e) { if (e.code === "match_not_live" || e.status === 403 || e.status === 404) closeChat(); }
    };
    await pull();
    const send = async () => {
      const i = body.querySelector("#chatText"); const text = i.value.trim(); if (!text) return;
      i.value = ""; 
      try { const r = await api(`/api/chat/${m.id}/messages`, { method: "POST", body: { body: text } }); appendMsg(r.message); }
      catch (e) { i.value = text; if (e.status === 403 || e.status === 404) closeChat(); else setStatus(e.message); }
    };
    body.querySelector("#chatSend").onclick = send;
    body.querySelector("#chatText").onkeydown = (e) => { if (e.key === "Enter") send(); };

    // Realtime for instant delivery; polling covers reconnects and network drops.
    const c = client();
    chatChannel = c.channel("chat:" + m.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "match_id=eq." + m.id }, (pl) => {
        const r = pl.new; appendMsg({ id: r.id, mine: r.sender_id === me.id, body: r.body, created_at: r.created_at });
      })
      .subscribe((s) => { if (s === "SUBSCRIBED") setStatus(p("live")); else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s)) setStatus(p("reconnecting")); });
    signalChannel = c.channel("signals:" + m.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: "to_user=eq." + me.id }, (pl) => onSignal(m.id, pl.new))
      .subscribe();
    pollTimer = setInterval(pull, 8000);
    body.querySelector("#callBtn").onclick = () => (callState === "idle" ? startCall(m.id) : endCall(true));
  }

  function stopRealtime() {
    clearInterval(pollTimer); pollTimer = null;
    try { chatChannel && client().removeChannel(chatChannel); signalChannel && client().removeChannel(signalChannel); } catch { /* ignore */ }
    chatChannel = signalChannel = null;
  }

  // ----- voice (WebRTC, signalling through the authorised backend + Supabase Realtime) -----
  const callMsg = (t) => { const el = body.querySelector("#callBox"); if (el) el.innerHTML = t; };
  const signal = (matchId, kind, payload) => api(`/api/call/${matchId}/signal`, { method: "POST", body: { kind, payload } });

  async function makePc(matchId) {
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) throw new Error(p("noWebrtc"));
    const ice = await api(`/api/call/${matchId}/ice`);
    try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { throw new Error(p("noMic")); }
    pc = new RTCPeerConnection({ iceServers: ice.ice_servers });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => { if (e.candidate) signal(matchId, "ice", e.candidate.toJSON()).catch(() => {}); };
    pc.ontrack = (e) => { const a = body.querySelector("#remoteAudio"); if (a) { a.srcObject = e.streams[0]; a.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "connected") { callState = "connected"; callMsg(p("inCall")); setCallBtn(); }
      if (pc?.connectionState === "failed") { callMsg(p("callFailed")); endCall(true); }
    };
    return pc;
  }
  function setCallBtn() { const b = body.querySelector("#callBtn"); if (b) b.textContent = callState === "idle" ? "☏ " + p("call") : "✕ " + p("hangup"); }

  async function startCall(matchId) {
    try {
      callState = "calling"; setCallBtn(); callMsg(p("calling"));
      await makePc(matchId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await signal(matchId, "offer", { type: offer.type, sdp: offer.sdp });
    } catch (e) { callMsg(esc(e.message)); endCall(true); }
  }
  async function acceptCall(matchId) {
    try {
      callState = "connecting"; setCallBtn(); callMsg(p("calling"));
      await makePc(matchId);
      await pc.setRemoteDescription(incomingOffer); incomingOffer = null;
      for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      await signal(matchId, "answer", { type: ans.type, sdp: ans.sdp });
    } catch (e) { callMsg(esc(e.message)); endCall(true); }
  }
  async function onSignal(matchId, s) {
    if (s.match_id !== matchId) return;
    const pl = s.payload || {};
    if (s.kind === "offer") {
      if (callState !== "idle") return;
      incomingOffer = { type: pl.type, sdp: pl.sdp }; callState = "ringing";
      callMsg(`${p("incoming")} <button class="primary-btn" id="cAns" type="button">${p("answer")}</button> <button class="outline-btn" id="cDec" type="button">${p("decline")}</button>`);
      body.querySelector("#cAns").onclick = () => acceptCall(matchId);
      body.querySelector("#cDec").onclick = () => endCall(true);
    } else if (s.kind === "answer" && pc) {
      await pc.setRemoteDescription({ type: pl.type, sdp: pl.sdp }).catch(() => {});
      for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
    } else if (s.kind === "ice") {
      if (pc && pc.remoteDescription) await pc.addIceCandidate(pl).catch(() => {}); else pendingIce.push(pl);
    } else if (s.kind === "hangup") { endCall(false); callMsg(""); }
  }
  function endCall(notify) {
    const mid = match?.id;
    if (notify && mid && callState !== "idle") signal(mid, "hangup", {}).catch(() => {});
    try { pc && pc.close(); localStream && localStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    pc = null; localStream = null; pendingIce = []; incomingOffer = null; callState = "idle";
    const a = body && body.querySelector("#remoteAudio"); if (a) a.srcObject = null;
    setCallBtn(); if (notify) callMsg("");
  }

  // ----- safety, feedback -----
  function reportForm(matchId) {
    const rs = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
    body.querySelector("#safeBox").innerHTML = `<div class="summary-box"><b>${p("reportTitle")}</b>
      <div class="field"><select id="rReason">${rs.map((r) => `<option value="${r}">${p("r_" + r)}</option>`).join("")}</select></div>
      <div class="field"><label>${p("details")}</label><textarea id="rDetails" rows="3" maxlength="1000"></textarea></div>
      <button class="primary-btn" id="rSend" type="button">${p("reportSend")}</button></div>`;
    body.querySelector("#rSend").onclick = async () => {
      try { const r = await api("/api/safety/report", { method: "POST", body: { match_id: matchId, reason: body.querySelector("#rReason").value, details: body.querySelector("#rDetails").value } }); body.querySelector("#safeBox").innerHTML = `<p class="nv-msg ok">${esc(r.message || p("reportThanks"))}</p>`; }
      catch (e) { body.querySelector("#safeBox").insertAdjacentHTML("beforeend", `<p class="nv-msg">${esc(e.message)}</p>`); }
    };
  }
  function feedbackForm(matchId) {
    body.querySelector("#fbBox").innerHTML = `<div class="summary-box"><label class="checkline"><input type="radio" name="fbc" value="yes" checked> ${p("wantContinue")}</label><label class="checkline"><input type="radio" name="fbc" value="no"> ${p("dontContinue")}</label>
      <div class="field"><textarea id="fbText" rows="3" maxlength="1000"></textarea></div><button class="primary-btn" id="fbSend" type="button">${p("sendFeedback")}</button></div>`;
    body.querySelector("#fbSend").onclick = async () => {
      try { await api("/api/feedback", { method: "POST", body: { match_id: matchId, wants_to_continue: body.querySelector("[name=fbc]:checked").value === "yes", feedback_text: body.querySelector("#fbText").value || null } }); body.querySelector("#fbBox").innerHTML = `<p class="nv-msg ok">${p("feedbackThanks")}</p>`; }
      catch (e) { body.querySelector("#fbBox").insertAdjacentHTML("beforeend", `<p class="nv-msg">${esc(e.message)}</p>`); }
    };
  }

  // ----- payment -----
  function loadRazorpay() {
    return new Promise((res, rej) => {
      if (window.Razorpay) return res();
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = res; s.onerror = () => rej(new Error(window.NV.t("network"))); document.head.appendChild(s);
    });
  }
  function renderPay() {
    const box = body.querySelector("#payBox");
    if (!payInfo || !payInfo.enabled) { box.innerHTML = `<p class="modal-description">${p("payOff")}</p>`; return; }
    if (payInfo.has_credit) { box.innerHTML = `<p class="nv-msg ok">${p("hasCredit")}</p>`; return; }
    box.innerHTML = `<div class="nv-row"><button class="outline-btn" id="payBtn" type="button" ${profile.approval_status !== "approved" ? "disabled" : ""}>${p("pay")}</button></div><div class="nv-msg" id="payMsg"></div>`;
    box.querySelector("#payBtn").onclick = async () => {
      const out = box.querySelector("#payMsg");
      try {
        const o = await api("/api/payments/order", { method: "POST" });
        await loadRazorpay();
        const rz = new window.Razorpay({
          key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: "NIVORA", description: p("payment"),
          handler: async (resp) => {
            out.textContent = p("payVerifying");
            try { await api("/api/payments/verify", { method: "POST", body: resp }); await loadAll(); render(); msg(p("paid"), true); }
            catch (e) { out.textContent = e.message || p("payFail"); }
          },
          modal: { ondismiss: () => { out.textContent = ""; } }
        });
        rz.open();
      } catch (e) { out.textContent = e.message; }
    };
  }

  // ----- account -----
  async function exportData() {
    try {
      const r = await api("/api/account/export");
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nivora-my-data.json"; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { msg(e.message); }
  }
  async function deleteAccount() {
    const word = prompt(p("delWarn"));
    if (word !== "DELETE") return;
    try { await api("/api/account", { method: "DELETE", body: { confirm: "DELETE" } }); await client().auth.signOut(); close(); alert(p("delDone")); location.reload(); }
    catch (e) { msg(e.message); }
  }

  window.NivoraPortal = { openPortal, submitProfile, close, resumePortalLogin };
})();
