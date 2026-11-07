/* BEYOND member portal: profile, matching, chat, voice messages, safety and account. Depends on common.js */
(function () {
  "use strict";
  const { api, client, session, signInWithGoogle, esc } = window.NV;
  const L = () => (typeof language !== "undefined" ? language : "en");

  const P = {
    en: {
      myspace: "My space", messagesTab: "Messages", matchTab: "Chat", shakeTab: "Shake & Chat", profileTab: "Profile", inboxIntro: "Your active conversations appear here.", noConversations: "No conversations yet. Shake to discover someone nearby.", shakeIntro: "Choose your distance, shake your phone, and meet people around the world.", shakeComing: "Shake & Chat is coming soon", shakePrivacy: "Your exact location is private. Only an approximate distance is shown.", shakeEnable: "Enable nearby discovery", shakeDisable: "Turn off location sharing", shakeRefresh: "Find people nearby", shakeLoading: "Finding people within your selected radius…", shakeNoPeople: "No members are available within your radius right now.", shakePermission: "Allow location access in BEYOND to continue.", shakeEnabled: "Nearby discovery is enabled. Your exact location stays private.", shakeLike: "Interested", shakeLikeBack: "Like back", shakeWaiting: "Interest sent. Waiting for a mutual interest.", shakeMatched: "It’s a mutual interest! Your chat is ready in Messages.", shakeAnonymousTitle: "You are chatting anonymously", shakeAnonymousInfo: "Your name, photos and profile details stay hidden until both of you choose to reveal.", shakeReveal: "I am comfortable revealing my profile", shakeWaitingReveal: "Your choice is saved. Waiting for the other person to consent.", shakeRevealDone: "Both of you agreed. Profiles are now visible.", shakeRevealCheck: "Check reveal status", shakeWithdraw: "Withdraw my consent", shakeDistance: "km away", shakeError: "Could not load Shake & Chat. Please try again.", shakeConsent: "Choose a search radius from 1 to 100 km. You can turn discovery off at any time.", signIn: "Sign in", signOut: "Sign out", loading: "Loading…", close: "Close",
      noProfile: "You have not created a profile yet.", staffAccount: "This is a BEYOND staff account. Customer profiles and matching are disabled for staff.", staffConsole: "Open staff console", createProfile: "Create my profile",
      status_pending: "Awaiting staff review", status_approved: "Approved", status_rejected: "Not approved", status_changes_requested: "Changes requested",
      suspended: "Your account is suspended. Please contact support.", incomplete: "Your profile is missing a few details. Please edit it before using Shake & Chat.",
      reason: "Staff note", editProfile: "Edit profile", save: "Save changes", saving: "Saving…", saved: "Saved.", reviewNote: "Your profile changes are saved immediately. Keep your details accurate and use Report or Block if needed.",
      rejectedNote: "This profile was not approved and cannot be edited here.",
      matching: "Conversations", findMatch: "Find my match", finding: "Searching…", noMatchNow: "No suitable profile is available right now. Please check again later.",
      dailyMatchesUsed: "Conversations", activeConversations: "Active conversations", dailyLimitReached: "", chatTab: "Chat",
      needApproval: "Save your profile details to activate matching.",
      accept: "Accept", decline: "Decline", continueMatch: "Continue", stopMatch: "Stop", waitingPartner: "You chose Continue. Waiting for the other person.", waitingYou: "Choose Continue or Stop to proceed.",
      proposalEnds: "Respond before", endMatch: "End match", endConfirm: "End this match? Chat and voice messages will close.",
      timeLeft: "Chat window left", closed: "Closed", chat: "Chat", typeMsg: "Write a message…", send: "Send", live: "Live", reconnecting: "Reconnecting…",
      chatClosed: "This conversation is unavailable or has been ended.", voiceRecord: "Record voice message", voiceStop: "Stop recording", voiceUploading: "Uploading voice message…", voiceSent: "Voice message sent.", voiceError: "Voice message could not be sent.", voiceUnsupported: "Voice recording is not supported in this browser.",
      report: "Report", block: "Block", blockConfirm: "Block this person? The match ends and you will never be matched again.",
      reportTitle: "Report this person", reportSend: "Send report", reportThanks: "Report received. Our team will review it.",
      r_harassment: "Harassment", r_fake_profile: "Fake profile", r_scam: "Scam / money request", r_inappropriate_content: "Inappropriate content", r_underage: "Looks underage", r_other: "Other",
      details: "Details (optional)", feedback: "Feedback", wantContinue: "I would like to continue getting to know them", dontContinue: "I do not want to continue", sendFeedback: "Send feedback", feedbackThanks: "Thank you for your feedback.",
      pastMatches: "Past matches", none: "None yet.", from: "Started",
      
      account: "Account & privacy", export: "Download my data", del: "Delete my account", delWarn: "This permanently deletes your profile, matches and chats. Type DELETE to confirm.", delDone: "Your account was deleted.",
      photos: "Profile photos", photoHelp: "Upload up to 4 clear photos (JPEG, PNG or WebP, max 5 MB each). Photos become visible to other members only after staff approval. Account reviews are otherwise report-led.", addPhoto: "Choose photo", photoPending: "Awaiting review", photoApproved: "Approved", photoRejected: "Not approved", photoDelete: "Remove", photoLimit: "You have reached the 4-photo limit.", photoUpload: "Uploading…", photoError: "Photo upload failed.", values: "Interests", intention: "Interests", sharedValues: "Shared interests",
      v_music: "Music", v_movies: "Movies", v_gaming: "Gaming", v_sports: "Sports", v_travel: "Travel", v_food: "Food", v_art: "Art", v_books: "Books", v_technology: "Technology", v_fitness: "Fitness", v_nature: "Nature", v_languages: "Languages", v_photography: "Photography", v_culture: "Culture", v_learning: "Learning", v_family: "Family", v_kindness: "Kindness & respect", v_career: "Career", v_faith: "Culture / faith", v_communication: "Communication", v_lifestyle: "Lifestyle",
      marriage: "Marriage", longterm: "Long-term relationship", woman: "Woman", man: "Man", other: "Other", any: "Open to possibilities",
      name: "Name", age: "Age", place: "Location", job: "Work / study", about: "About you", lookingFor: "I'm looking for", relationship: "Relationship intention", minAge: "Partner min age", maxAge: "Partner max age"
    },
    ml: {
      myspace: "എന്റെ ഇടം", messagesTab: "Messages", matchTab: "Chat", shakeTab: "Shake & Chat", profileTab: "Profile", inboxIntro: "നിങ്ങളുടെ സജീവ സംഭാഷണങ്ങൾ ഇവിടെ കാണാം.", noConversations: "ഇതുവരെ സംഭാഷണങ്ങളില്ല. സമീപത്തുള്ളവരെ കണ്ടെത്താൻ Shake ചെയ്യൂ.", shakeIntro: "നിങ്ങൾക്ക് ഇഷ്ടമുള്ള ദൂരം തിരഞ്ഞെടുക്കൂ. ഫോൺ Shake ചെയ്ത് ലോകമെമ്പാടുമുള്ളവരെ പരിചയപ്പെടാം.", shakeComing: "Shake & Chat ഉടൻ വരുന്നു", shakePrivacy: "നിങ്ങളുടെ കൃത്യമായ Location മറ്റുള്ളവർക്ക് കാണിക്കില്ല. ഏകദേശ ദൂരം മാത്രമേ കാണൂ.", shakeEnable: "സമീപത്തുള്ളവരെ കണ്ടെത്തുക", shakeDisable: "Location പങ്കിടൽ നിർത്തുക", shakeRefresh: "സമീപത്തുള്ളവരെ തിരയുക", shakeLoading: "നിങ്ങൾ തിരഞ്ഞെടുത്ത Radius-ൽ തിരയുന്നു…", shakeNoPeople: "നിങ്ങളുടെ Radius-ൽ ഇപ്പോൾ അംഗങ്ങളെ കണ്ടെത്താനായില്ല.", shakePermission: "BEYOND-യിൽ തുടരാൻ Location permission നൽകുക.", shakeEnabled: "Nearby discovery പ്രവർത്തനക്ഷമമാണ്. കൃത്യമായ സ്ഥലം സ്വകാര്യമാണ്.", shakeLike: "താൽപര്യമുണ്ട്", shakeLikeBack: "തിരിച്ചും താൽപര്യമുണ്ട്", shakeWaiting: "താൽപര്യം അയച്ചു. മറുവശത്തുനിന്നുള്ള താൽപര്യം കാത്തിരിക്കുന്നു.", shakeMatched: "പരസ്പര താൽപര്യം ലഭിച്ചു! Messages-ൽ chat തുടങ്ങാം.", shakeAnonymousTitle: "നിങ്ങൾ ഇപ്പോൾ അജ്ഞാതരായി chat ചെയ്യുന്നു", shakeAnonymousInfo: "നിങ്ങൾ രണ്ടുപേരും സമ്മതിക്കുന്നതുവരെ പേര്, ഫോട്ടോ, profile വിവരങ്ങൾ മറച്ചുവെക്കും.", shakeReveal: "എന്റെ profile വെളിപ്പെടുത്താൻ എനിക്ക് സമ്മതമാണ്", shakeWaitingReveal: "നിങ്ങളുടെ സമ്മതം സേവ് ചെയ്തു. മറ്റേയാളുടെ സമ്മതം കാത്തിരിക്കുന്നു.", shakeRevealDone: "രണ്ടുപേരും സമ്മതിച്ചു. ഇപ്പോൾ profile കാണാം.", shakeRevealCheck: "Reveal നില പരിശോധിക്കുക", shakeWithdraw: "എന്റെ സമ്മതം പിൻവലിക്കുക", shakeDistance: "km അകലെ", shakeError: "Shake & Chat തുറക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.", shakeConsent: "1 മുതൽ 100 km വരെ നിങ്ങൾക്ക് ഇഷ്ടമുള്ള Radius തിരഞ്ഞെടുക്കാം. എപ്പോൾ വേണമെങ്കിലും Discovery നിർത്താം.", signIn: "Sign in", signOut: "Sign out", loading: "ലോഡ് ചെയ്യുന്നു…", close: "അടയ്ക്കുക",
      noProfile: "നിങ്ങൾ ഇതുവരെ profile ഉണ്ടാക്കിയിട്ടില്ല.", staffAccount: "ഇത് BEYOND staff account ആണ്. Staff അംഗങ്ങൾക്ക് customer profile അല്ലെങ്കിൽ matching ലഭ്യമല്ല.", staffConsole: "Staff console തുറക്കുക", createProfile: "എന്റെ profile ഉണ്ടാക്കാം",
      status_pending: "Staff review കാത്തിരിക്കുന്നു", status_approved: "അംഗീകരിച്ചു", status_rejected: "അംഗീകരിച്ചില്ല", status_changes_requested: "മാറ്റങ്ങൾ ആവശ്യപ്പെട്ടിട്ടുണ്ട്",
      suspended: "നിങ്ങളുടെ account suspend ചെയ്തിരിക്കുന്നു. Support-നെ ബന്ധപ്പെടുക.", incomplete: "Profile-ൽ കുറച്ച് വിവരങ്ങൾ കുറവാണ്. Shake & Chat ഉപയോഗിക്കുന്നതിന് മുമ്പ് edit ചെയ്യുക.",
      reason: "Staff കുറിപ്പ്", editProfile: "Profile edit ചെയ്യുക", save: "സേവ് ചെയ്യുക", saving: "സേവ് ചെയ്യുന്നു…", saved: "സേവ് ചെയ്തു.", reviewNote: "Profile-ലെ മാറ്റങ്ങൾ ഉടൻ save ആകും. വിവരങ്ങൾ ശരിയായി നൽകുക; ആവശ്യമെങ്കിൽ Report / Block ഉപയോഗിക്കുക.",
      rejectedNote: "ഈ profile അംഗീകരിച്ചിട്ടില്ല; ഇവിടെ edit ചെയ്യാനാകില്ല.",
      matching: "സംഭാഷണങ്ങൾ", findMatch: "എന്റെ match കണ്ടെത്തുക", finding: "തിരയുന്നു…", noMatchNow: "ഇപ്പോൾ അനുയോജ്യമായ profile ഇല്ല. പിന്നീട് നോക്കുക.",
      dailyMatchesUsed: "സംഭാഷണങ്ങൾ", activeConversations: "സജീവ സംഭാഷണങ്ങൾ", dailyLimitReached: "", chatTab: "Chat",
      needApproval: "Matching തുടങ്ങാൻ profile details save ചെയ്യുക.",
      accept: "സ്വീകരിക്കുക", decline: "നിരസിക്കുക", continueMatch: "തുടരാം", stopMatch: "നിർത്താം", waitingPartner: "നിങ്ങൾ Continue തിരഞ്ഞെടുത്തു. മറ്റേയാളുടെ തീരുമാനം കാത്തിരിക്കുന്നു.", waitingYou: "തുടരാൻ Continue അല്ലെങ്കിൽ Stop തിരഞ്ഞെടുക്കുക.",
      proposalEnds: "ഇതിനുമുമ്പ് മറുപടി നൽകുക", endMatch: "Match അവസാനിപ്പിക്കുക", endConfirm: "ഈ match അവസാനിപ്പിക്കണോ? Chat, voice messages അടയും.",
      timeLeft: "Chat സമയം ബാക്കി", closed: "അടച്ചു", chat: "Chat", typeMsg: "സന്ദേശം എഴുതുക…", send: "അയയ്ക്കുക", live: "ലൈവ്", reconnecting: "വീണ്ടും ബന്ധിപ്പിക്കുന്നു…",
      chatClosed: "ഈ സംഭാഷണം ലഭ്യമല്ല അല്ലെങ്കിൽ അവസാനിപ്പിച്ചു.", voiceRecord: "Voice message റെക്കോർഡ് ചെയ്യുക", voiceStop: "റെക്കോർഡിംഗ് നിർത്തുക", voiceUploading: "Voice message upload ചെയ്യുന്നു…", voiceSent: "Voice message അയച്ചു.", voiceError: "Voice message അയയ്ക്കാനായില്ല.", voiceUnsupported: "ഈ browser-ൽ voice recording ലഭ്യമല്ല.",
      report: "Report", block: "Block", blockConfirm: "ഇവരെ block ചെയ്യണോ? Match അവസാനിക്കും, വീണ്ടും match ചെയ്യില്ല.",
      reportTitle: "ഇവരെ report ചെയ്യുക", reportSend: "Report അയയ്ക്കുക", reportThanks: "Report ലഭിച്ചു. ഞങ്ങളുടെ ടീം പരിശോധിക്കും.",
      r_harassment: "ശല്യപ്പെടുത്തൽ", r_fake_profile: "വ്യാജ profile", r_scam: "തട്ടിപ്പ് / പണം ആവശ്യപ്പെടൽ", r_inappropriate_content: "അനുചിതമായ ഉള്ളടക്കം", r_underage: "പ്രായപൂർത്തിയായില്ലെന്ന് തോന്നുന്നു", r_other: "മറ്റുള്ളവ",
      details: "വിശദാംശങ്ങൾ (ഓപ്ഷണൽ)", feedback: "Feedback", wantContinue: "കൂടുതൽ പരിചയപ്പെടാൻ താൽപര്യമുണ്ട്", dontContinue: "തുടരാൻ താൽപര്യമില്ല", sendFeedback: "Feedback അയയ്ക്കുക", feedbackThanks: "Feedback-ന് നന്ദി.",
      pastMatches: "മുൻ match-കൾ", none: "ഇതുവരെ ഇല്ല.", from: "തുടങ്ങിയത്",
      
      account: "Account & സ്വകാര്യത", export: "എന്റെ data download ചെയ്യുക", del: "എന്റെ account delete ചെയ്യുക", delWarn: "Profile, match, chat എല്ലാം സ്ഥിരമായി മായും. സ്ഥിരീകരിക്കാൻ DELETE എന്ന് ടൈപ്പ് ചെയ്യുക.", delDone: "നിങ്ങളുടെ account delete ചെയ്തു.",
      photos: "Profile photos", photoHelp: "പരമാവധി 4 വ്യക്തമായ ഫോട്ടോകൾ ചേർക്കാം (JPEG, PNG, WebP; ഓരോന്നും 5 MB വരെ). Staff അംഗീകരിച്ച ശേഷമേ മറ്റുള്ളവർക്ക് ഫോട്ടോകൾ കാണാനാകൂ. മറ്റ് account പരിശോധനകൾ Report ലഭിക്കുമ്പോൾ മാത്രമായിരിക്കും.", addPhoto: "ഫോട്ടോ തിരഞ്ഞെടുക്കുക", photoPending: "Review കാത്തിരിക്കുന്നു", photoApproved: "അംഗീകരിച്ചു", photoRejected: "അംഗീകരിച്ചില്ല", photoDelete: "നീക്കം ചെയ്യുക", photoLimit: "4 ഫോട്ടോ പരിധി കഴിഞ്ഞു.", photoUpload: "Upload ചെയ്യുന്നു…", photoError: "ഫോട്ടോ upload ചെയ്യാനായില്ല.", values: "താൽപര്യങ്ങൾ", intention: "താൽപര്യങ്ങൾ", sharedValues: "പൊതുവായ താൽപര്യങ്ങൾ",
      v_music: "സംഗീതം", v_movies: "സിനിമ", v_gaming: "ഗെയിമിംഗ്", v_sports: "കായികം", v_travel: "യാത്ര", v_food: "ഭക്ഷണം", v_art: "കല", v_books: "പുസ്തകങ്ങൾ", v_technology: "സാങ്കേതികവിദ്യ", v_fitness: "ഫിറ്റ്നസ്", v_nature: "പ്രകൃതി", v_languages: "ഭാഷകൾ", v_photography: "ഫോട്ടോഗ്രഫി", v_culture: "സംസ്കാരം", v_learning: "പഠനം", v_family: "കുടുംബം", v_kindness: "ദയയും ബഹുമാനവും", v_career: "കരിയർ", v_faith: "സംസ്കാരം / വിശ്വാസം", v_communication: "തുറന്ന സംഭാഷണം", v_lifestyle: "ജീവിതശൈലി",
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
  function close() { stopVoiceRecording(true); stopRealtime(); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } document.body.style.overflow = ""; clearInterval(tickTimer); }

  // ---------- state ----------
  let me = null, profile = null, match = null, matches = [], selectedMatchId = null, history = [], photos = [], isStaff = false;
  let tickTimer = null, chatChannel = null, pollTimer = null, seen = new Set(), lastTs = null;
  let voiceRecorder = null, voiceStream = null, voiceChunks = [], voiceMime = "", voiceStartedAt = 0, voiceLimitTimer = null, voiceDisplayTimer = null, voiceDiscard = false, voiceSeen = new Set(), lastVoiceTs = null;
  const val = (k) => (k in (profile || {}) ? profile[k] : "");

  async function loadAll() {
    const s = await session(); me = s?.user || null;
    const [pr, m, h] = await Promise.all([
      api("/api/profile"), api("/api/match/current"), api("/api/match/history").catch(() => ({ history: [] }))
    ]);
    profile = pr.profile; matches = Array.isArray(m.matches) ? m.matches : (m.match ? [m.match] : []); match = matches.find((x) => x.id === selectedMatchId) || matches.find((x) => x.id === match?.id) || matches[0] || null; selectedMatchId = match?.id || null; history = h.history || [];
    photos = profile ? ((await api("/api/profile/photos").catch(() => ({ photos: [] }))).photos || []) : [];
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
    // Run on every homepage load, not only when a particular sign-in button set a flag.
    // This also restores the dashboard for an already-authenticated customer reopening BEYOND.
    let pending = false;
    try { pending = sessionStorage.getItem("nivora_pending_portal") === "1"; } catch (_) { /* ignore */ }
    let s;
    try { s = await session(); } catch (_) { return; }
    if (!s) return;
    if (pending) { try { sessionStorage.removeItem("nivora_pending_portal"); } catch (_) { /* ignore */ } }
    // Existing customers go straight to their dedicated dashboard. Staff remain in staff console.
    const [pr, staff] = await Promise.all([
      api("/api/profile").catch(() => ({ profile: null })),
      api("/api/admin/me").then(() => true).catch(() => false)
    ]);
    if (pr.profile && !staff) {
      window.location.replace("dashboard.html");
      return;
    }
    // Only open the profile portal after a deliberate sign-in attempt; do not interrupt
    // a visitor who simply opens the public homepage.
    if (pending) await openPortal();
  }

  // Called by the profile wizard on its final step. Returns the saved profile or {existing:true}.
  async function submitProfile(form, onNeedAuth) {
    if (!(await session())) await onNeedAuth();
    const existing = await api("/api/profile");
    if (existing.profile) return { existing: true, profile: existing.profile };
    const payload = {
      full_name: form.name.trim(), age: Number(form.age), district: form.place.trim(),
      job_title: form.job.trim(), bio: form.about.trim(), core_values: form.values,
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
      ${pt.photos && pt.photos.length ? `<div class="partner-photos">${pt.photos.map((ph) => `<img src="${esc(ph.url)}" alt="Approved profile photo" loading="lazy">`).join("")}</div>` : ""}
      
      <b>${p("values")}:</b> ${esc((pt.core_values || []).map(valName).join(", ") || "—")}<br>
      ${pt.shared_values?.length ? `<b>${p("sharedValues")}:</b> ${esc(pt.shared_values.map(valName).join(", "))}<br>` : ""}
      ${pt.bio ? `<br>${esc(pt.bio)}` : ""}</div>`;
  }

  function render() {
    clearInterval(tickTimer); stopRealtime();
    let h = `<div class="modal-topline"><span class="section-kicker">${p("myspace")}</span></div>`;
    if (!profile && isStaff) {
      h += `<p class="modal-description">${p("staffAccount")}</p><a class="primary-btn" href="admin.html">${p("staffConsole")} <span class="arrow">→</span></a>`;
    } else if (!profile) {
      h += `<p class="modal-description">${p("noProfile")}</p><button class="primary-btn" id="pCreate" type="button">${p("createProfile")} <span class="arrow">→</span></button>`;
    } else {
      const st = profile.approval_status;
      h += `<h2 class="modal-title">${esc(profile.full_name)}, ${esc(profile.age)}</h2>
        <div class="badge badge-${esc(st)}">${p("status_" + st)}</div>
        ${profile.review_reason && st !== "approved" ? `<p class="modal-description"><b>${p("reason")}:</b> ${esc(profile.review_reason)}</p>` : ""}
        ${profile.suspended ? `<p class="nv-msg">${p("suspended")}</p>` : ""}
        ${!profile.profile_complete ? `<p class="nv-msg">${p("incomplete")}</p>` : ""}
        <div class="nv-row">${st !== "rejected" ? `<button class="outline-btn" id="pEdit" type="button">${p("editProfile")}</button>` : `<small>${p("rejectedNote")}</small>`}</div>`;

      h += `<h3 class="nv-h">${p("photos")}</h3><div id="photoBox"><p class="modal-description">${p("photoHelp")}</p><div class="nv-row"><label class="outline-btn" for="photoInput">${p("addPhoto")}</label><input id="photoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden ${photos.length >= 4 ? "disabled" : ""}></div><div class="photo-grid">${photos.map((ph) => `<div class="photo-card"><img src="${esc(ph.url || "")}" alt="Your profile photo"><small>${p("photo" + ph.approval_status[0].toUpperCase() + ph.approval_status.slice(1))}</small><button class="nv-link" data-photo-delete="${esc(ph.id)}" type="button">${p("photoDelete")}</button>${ph.review_reason ? `<small>${esc(ph.review_reason)}</small>` : ""}</div>`).join("")}</div><div class="nv-msg" id="photoMsg" role="status"></div></div>`;
      h += `<h3 class="nv-h">${p("matching")}</h3><div id="matchBox"></div>`;
      if (history.length) {
        h += `<h3 class="nv-h">${p("pastMatches")}</h3><ul class="nv-list">${history.filter((x) => !["proposed", "active"].includes(x.status)).map((x) =>
          `<li>${p("from")}: ${esc(fmt(x.started_at || x.created_at))} · ${esc(x.status)} ${x.started_at ? `<button class="nv-link" data-fb="${esc(x.id)}" type="button">${p("feedback")}</button>` : ""}</li>`).join("") || `<li>${p("none")}</li>`}</ul><div id="fbBox"></div>`;
      }
    }
    h += `<h3 class="nv-h">${p("account")}</h3><div class="nv-row">
      <button class="outline-btn" id="pExport" type="button">${p("export")}</button>
      <button class="outline-btn danger" id="pDelete" type="button">${p("del")}</button>
      <button class="outline-btn" id="pSignOut" type="button">${p("signOut")}</button>
    </div><div class="nv-msg" id="pMsg" role="status"></div>`;
    body.innerHTML = h;
    if (profile && !isStaff) buildCustomerDashboard();

    const $ = (s) => body.querySelector(s);
    $("#pCreate") && ($("#pCreate").onclick = () => { close(); window.openWizard && window.openWizard(); });
    $("#pEdit") && ($("#pEdit").onclick = renderEdit);
    $("#pSignOut").onclick = async () => { await client().auth.signOut(); close(); };
    $("#pExport").onclick = exportData;
    $("#pDelete").onclick = deleteAccount;
    body.querySelectorAll("[data-fb]").forEach((b) => (b.onclick = () => feedbackForm(b.dataset.fb)));
    const photoInput = $("#photoInput");
    if (photoInput) photoInput.onchange = async () => { const file = photoInput.files?.[0]; if (!file) return; await uploadPhoto(file); };
    body.querySelectorAll("[data-photo-delete]").forEach((b) => (b.onclick = async () => { if (!confirm(p("photoDelete") + "?")) return; try { await api("/api/profile/photos/" + encodeURIComponent(b.dataset.photoDelete), { method: "DELETE" }); await loadAll(); render(); } catch (e) { const out = $("#photoMsg"); if (out) out.textContent = e.message; } }));
    if (profile) renderMatch();
  }


  function buildCustomerDashboard() {
    const q = (selector) => body.querySelector(selector);
    const profileNodes = [], matchNodes = [];
    const add = (selector, list) => { const node = q(selector); if (node && !list.includes(node)) list.push(node); };
    add(".modal-topline", profileNodes); add(".modal-title", profileNodes); add(".badge", profileNodes);
    add("#pEdit", profileNodes);
    const editRow = q("#pEdit")?.parentElement; if (editRow) profileNodes.push(editRow);
    const photoHeading = [...body.querySelectorAll(".nv-h")].find((n) => n.textContent.trim() === p("photos"));
    if (photoHeading) profileNodes.push(photoHeading);
    add("#photoBox", profileNodes);
    const matchHeading = [...body.querySelectorAll(".nv-h")].find((n) => n.textContent.trim() === p("matching"));
    if (matchHeading) matchNodes.push(matchHeading);
    add("#matchBox", matchNodes);
    const pastHeading = [...body.querySelectorAll(".nv-h")].find((n) => n.textContent.trim() === p("pastMatches"));
    if (pastHeading) matchNodes.push(pastHeading);
    add(".nv-list", matchNodes); add("#fbBox", matchNodes);
    const wrap = (id, label, list) => {
      const panel = document.createElement("section"); panel.className = "dashboard-panel"; panel.id = id; panel.setAttribute("aria-label", label);
      const first = list.find((n) => n.parentElement === body);
      if (first) body.insertBefore(panel, first);
      list.forEach((n) => { if (n.parentElement === body) panel.appendChild(n); });
      return panel;
    };
    const profilePanel = wrap("dashboard-profile", p("profileTab"), profileNodes);
    const matchPanel = wrap("dashboard-match", p("matchTab"), matchNodes);
    const welcome = document.createElement("section");
    welcome.className = "dashboard-welcome";
    const ml = L() === "ml";
    welcome.innerHTML = `
      <div class="dashboard-welcome-copy">
        <span class="dashboard-eyebrow"><i></i> GLOBAL SOCIAL DISCOVERY</span>
        <h1>${ml ? "സ്വാഗതം" : "Welcome"},<br><em>${esc((profile.full_name || "").split(" ")[0])}</em></h1>
        <p>${ml ? "പുതിയ ആളുകളെ കണ്ടെത്തൂ. സംസാരിക്കൂ. ഇരുവരും ആഗ്രഹിച്ചാൽ സുഹൃത്തുക്കളാകൂ." : "Discover people nearby. Chat freely. Become friends only when both agree."}</p>
        <div class="dashboard-hero-actions">
          <button type="button" class="dashboard-hero-primary" data-open-tab="shake">${ml ? "Shake ചെയ്യാം" : "Shake to discover"} <span>⌖</span></button>
          <button type="button" class="dashboard-hero-secondary" data-open-tab="community">${ml ? "Anonymous Posts" : "Anonymous posts"} <span>◌</span></button>
        </div>
        <div class="dashboard-hero-footnote"><span>✦</span> ${ml ? "നിങ്ങളുടെ സ്വകാര്യത, നിങ്ങളുടെ തീരുമാനം" : "Your privacy. Your choice."}</div>
      </div>
      <div class="dashboard-hero-side">
        <div class="dashboard-stat-grid">
          <div class="dashboard-stat dashboard-stat-featured"><span>✉</span><b>${matches.filter(x => ["proposed","active"].includes(x.status)).length}</b><small>${ml ? "സംഭാഷണങ്ങൾ" : "Conversations"}</small></div>
          <div class="dashboard-stat"><span>♡</span><b>∞</b><small>${ml ? "സമയപരിധിയില്ല" : "No chat timer"}</small></div>
        </div>
      </div>
      <span class="dashboard-hero-orbit" aria-hidden="true"></span><span class="dashboard-hero-spark" aria-hidden="true">✦</span>`;
    const topbar = document.createElement("header");
    topbar.className = "dashboard-topbar";
    topbar.innerHTML = `
      <a class="dashboard-brand" href="dashboard.html" aria-label="BEYOND home"><span class="dashboard-brand-mark">N</span><span><b>BEYOND</b><small>${ml ? "ബന്ധങ്ങൾ അർത്ഥവത്താകട്ടെ" : "MEANINGFUL CONNECTIONS"}</small></span></a>
      <span class="dashboard-top-note"><i></i>${ml ? "നിങ്ങളുടെ സുരക്ഷിത ഇടം" : "Your space, your pace"}</span>`;
    body.prepend(welcome);
    body.prepend(topbar);
    const inbox = document.createElement("section"); inbox.className = "dashboard-panel"; inbox.id = "dashboard-messages";
    inbox.innerHTML = "<h2 class='modal-title'>" + p("messagesTab") + "</h2><p class='modal-description'>" + p("inboxIntro") + "</p><div class='dashboard-inbox'></div>";
    const inboxList = inbox.querySelector(".dashboard-inbox");
    const active = matches.filter((item) => ["proposed", "active"].includes(item.status));
    if (!active.length) inboxList.innerHTML = "<p class='modal-description'>" + p("noConversations") + "</p>";
    active.forEach((item) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "dashboard-conversation";
      const name = item.is_shake_match && !item.reveal?.revealed ? (L() === "ml" ? "അജ്ഞാത match" : "Anonymous match") : (item.partner?.first_name || (L() === "ml" ? "പുതിയ match" : "New match"));
      const status = item.status === "proposed" ? (L() === "ml" ? "മറുപടി കാത്തിരിക്കുന്നു" : "Awaiting response") : (L() === "ml" ? "സജീവ സംഭാഷണം" : "Active conversation");
      button.innerHTML = "<span class='dashboard-avatar'>♡</span><span><b>" + esc(name) + "</b><small>" + status + "</small></span><span class='dashboard-arrow'>›</span>";
      button.onclick = () => { match = item; selectedMatchId = item.id; render(); };
      inboxList.appendChild(button);
    });
    const shake = document.createElement("section"); shake.className = "dashboard-panel"; shake.id = "dashboard-shake";
    shake.innerHTML = "<h2 class='modal-title'>" + p("shakeTab") + "</h2><p class='modal-description'>" + p("shakeIntro") + "</p><div class='shake-coming'><span>⌖</span><b>BEYOND Shake</b><small>" + p("shakePrivacy") + "</small><p class='modal-description'>" + p("shakeConsent") + "</p><div class='field'><label for='shakeRadius'>Search radius</label><select id='shakeRadius'><option value='1'>1 km</option><option value='5'>5 km</option><option value='10'>10 km</option><option value='25' selected>25 km</option><option value='50'>50 km</option><option value='75'>75 km</option><option value='100'>100 km</option></select></div><div class='nv-row'><button class='primary-btn' id='shakeEnable' type='button'>" + p("shakeEnable") + "</button><button class='outline-btn' id='shakeNow' type='button' hidden>Shake now</button><button class='outline-btn' id='shakeRefresh' type='button' hidden>" + p("shakeRefresh") + "</button><button class='outline-btn' id='shakeDisable' type='button' hidden>" + p("shakeDisable") + "</button></div><div class='nv-msg' id='shakeStatus' role='status'></div></div><div id='shakePeople' class='shake-people' aria-live='polite'></div>";
    const nav = document.createElement("nav"); nav.className = "customer-bottom-nav"; nav.setAttribute("aria-label", "Customer navigation");
    const tabData = [["messages","✉",p("messagesTab")],["match","♡",L() === "ml" ? "Chat" : "Chat"],["shake","⌖",p("shakeTab")],["community","◌",L() === "ml" ? "Posts" : "Posts"],["profile","◉",p("profileTab")]];
    nav.innerHTML = tabData.map((t) => "<button type='button' data-dashboard='" + t[0] + "' aria-pressed='false'><span>" + t[1] + "</span><small>" + t[2] + "</small></button>").join("");
    const community = document.createElement("section"); community.className = "dashboard-panel"; community.id = "dashboard-community";
    community.innerHTML = "<h2 class='modal-title'>Anonymous posts</h2><p class='modal-description'>Share thoughts without showing your profile.</p><textarea id='communityBody' maxlength='2000' rows='4' placeholder='Write an anonymous post…'></textarea><div class='field'><label for='communityAudience'>Who can see this?</label><select id='communityAudience'><option value='global'>Everyone worldwide</option><option value='radius'>People within my radius</option></select></div><div class='nv-row'><button class='primary-btn' id='communityPublish' type='button'>Post anonymously</button></div><div class='nv-msg' id='communityStatus' role='status'></div><div id='communityFeed' class='shake-people'></div>";
    body.append(inbox, shake, community, nav);
    bindMotionShake();
    const panels = [inbox, matchPanel, shake, community, profilePanel];
    const activate = (id) => {
      panels.forEach((panel) => { panel.hidden = panel.id !== "dashboard-" + id; });
      nav.querySelectorAll("button").forEach((button) => {
        const on = button.dataset.dashboard === id; button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on));
      });
      if (id === "match" && match && ["proposed", "active"].includes(match.status)) startChat(match);
      else { stopRealtime(); clearInterval(tickTimer); }
      if (id === "shake") loadShakePanel();
      if (id === "community") loadCommunityPanel();
    };
    nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => activate(button.dataset.dashboard)));
    welcome.querySelectorAll("[data-open-tab]").forEach((button) => button.addEventListener("click", () => activate(button.dataset.openTab)));
    activate("match");
    const accountHeading = [...body.querySelectorAll(".nv-h")].find((n) => n.textContent.trim() === p("account"));
    const accountRow = q("#pExport")?.parentElement, accountMsg = q("#pMsg");
    if (accountHeading) profilePanel.appendChild(accountHeading);
    if (accountRow) profilePanel.appendChild(accountRow);
    if (accountMsg) profilePanel.appendChild(accountMsg);

    const privacySettings = document.createElement("section");
    privacySettings.className = "dashboard-panel";
    privacySettings.innerHTML = L() === "ml" ? "<h3 class='nv-h'>Profile Visibility</h3><p class='modal-description'>Shake discovery-ൽ നിങ്ങളെ കണ്ടെത്താൻ അനുവദിക്കണോ എന്ന് തിരഞ്ഞെടുക്കുക. Profile വിവരങ്ങൾ ഇരുവരും സമ്മതിക്കുന്നതുവരെ മറഞ്ഞിരിക്കും.</p><select id='profileVisibility'><option value='public'>Visible</option><option value='hidden'>Hidden</option></select><div class='nv-msg' id='visibilityStatus' role='status'></div>" : "<h3 class='nv-h'>Profile visibility</h3><p class='modal-description'>Choose whether people can find you in Shake discovery. Your profile details remain hidden until both people agree to reveal.</p><select id='profileVisibility'><option value='public'>Visible in discovery</option><option value='hidden'>Hidden from discovery</option></select><div class='nv-msg' id='visibilityStatus' role='status'></div>";
    profilePanel.appendChild(privacySettings);
    const visibilitySelect = privacySettings.querySelector("#profileVisibility");
    visibilitySelect.value = profile.profile_visibility || "public";
    visibilitySelect.onchange = async () => {
      visibilitySelect.disabled = true;
      try {
        const result = await api("/api/profile/visibility", { method: "PUT", body: { visibility: visibilitySelect.value } });
        profile.profile_visibility = result.visibility;
        privacySettings.querySelector("#visibilityStatus").textContent = "Privacy setting saved.";
      } catch (e) {
        privacySettings.querySelector("#visibilityStatus").textContent = e.message || "Could not update privacy setting.";
        visibilitySelect.value = profile.profile_visibility || "public";
      } finally { visibilitySelect.disabled = false; }
    };

    const friendsPanel = document.createElement("section");
    friendsPanel.className = "dashboard-panel";
    friendsPanel.innerHTML = "<h3 class='nv-h'>Friend requests</h3><div id='friendRequests' class='shake-people'></div><h3 class='nv-h'>Friends</h3><div id='friendList' class='shake-people'></div><div class='nv-msg' id='friendsStatus'></div>";
    profilePanel.appendChild(friendsPanel);
    loadFriendsPanel();
  }

  async function loadShakePanel() {
    const status = body.querySelector("#shakeStatus"), people = body.querySelector("#shakePeople");
    const enable = body.querySelector("#shakeEnable"), refresh = body.querySelector("#shakeRefresh"), disable = body.querySelector("#shakeDisable");
    if (!status || !people) return;
    status.textContent = p("loading"); people.innerHTML = "";
    try {
      const state = await api("/api/shake/status");
      enable.hidden = state.enabled; refresh.hidden = !state.enabled; disable.hidden = !state.enabled;
      status.textContent = state.enabled ? p("shakeEnabled") : p("shakePrivacy");
      const radius = body.querySelector("#shakeRadius"); if (radius) radius.value = String(state.radius_km || 25);
      const shakeNow = body.querySelector("#shakeNow"); if (shakeNow) shakeNow.hidden = !state.enabled;
      if (state.enabled) await discoverShakePeople();
    } catch (e) { status.textContent = e.message || p("shakeError"); }
    enable.onclick = enableShakeLocation;
    const shakeNow = body.querySelector("#shakeNow"); if (shakeNow) shakeNow.onclick = () => discoverShakePeople(true);
    const radius = body.querySelector("#shakeRadius"); if (radius) radius.onchange = enableShakeLocation;
    refresh.onclick = discoverShakePeople;
    disable.onclick = disableShakeLocation;
  }

  async function enableShakeLocation() {
    const status = body.querySelector("#shakeStatus");
    if (status) status.textContent = p("loading");
    const saveLocation = async (position) => {
      try {
        await api("/api/shake/location", { method: "POST", body: {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          radius_km: Number(body.querySelector("#shakeRadius")?.value || 25)
        } });
        await loadShakePanel();
      } catch (e) { if (status) status.textContent = e.message || p("shakeError"); }
    };
    try {
      if (window.NivoraNative?.isNative?.() && window.NivoraNative.getCurrentPosition) {
        const position = await window.NivoraNative.getCurrentPosition();
        await saveLocation(position);
        return;
      }
      if (!navigator.geolocation) { if (status) status.textContent = p("shakePermission"); return; }
      navigator.geolocation.getCurrentPosition(saveLocation, () => {
        if (status) status.textContent = p("shakePermission");
      }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 });
    } catch (e) { if (status) status.textContent = e.message || p("shakePermission"); }
  }

  async function disableShakeLocation() {
    const status = body.querySelector("#shakeStatus");
    try { await api("/api/shake/location", { method: "DELETE" }); await loadShakePanel(); if (status) status.textContent = L() === "ml" ? "Location sharing നിർത്തി; nearby-radius posts-ഉം നീക്കം ചെയ്തു." : "Location sharing disabled; your nearby-radius posts were also removed."; }
    catch (e) { if (status) status.textContent = e.message || p("shakeError"); }
  }

  async function discoverShakePeople(randomOne = false) {
    const status = body.querySelector("#shakeStatus"), people = body.querySelector("#shakePeople");
    if (!people) return;
    status.textContent = p("shakeLoading"); people.innerHTML = "";
    try {
      const result = await api("/api/shake/discover");
      if (!result.people?.length) { status.textContent = p("shakeNoPeople"); return; }
      status.textContent = p("shakeEnabled");
      const peopleToShow = randomOne && result.people.length ? [result.people[Math.floor(Math.random() * result.people.length)]] : result.people;
      peopleToShow.forEach((person) => {
        const card = document.createElement("article"); card.className = "shake-person";
        const heading = document.createElement("h3");
        heading.textContent = person.display_name || "BEYOND member";
        const meta = document.createElement("p");
        meta.textContent = person.distance_km + " " + p("shakeDistance");
        const about = document.createElement("p"); about.textContent = (person.interests || []).map(valName).join(" · ");
        const action = document.createElement("button"); action.type = "button"; action.className = "primary-btn";
        action.textContent = person.interested_in_you ? p("shakeLikeBack") : p("shakeLike");
        action.onclick = async () => {
          action.disabled = true;
          try {
            const response = await api("/api/shake/interest", { method: "POST", body: { target_user_id: person.user_id } });
            if (response.mutual) {
              status.textContent = p("shakeMatched");
              selectedMatchId = response.match_id;
              await loadAll(); render();
              return;
            }
            status.textContent = p("shakeWaiting"); action.textContent = p("shakeWaiting");
          } catch (e) { status.textContent = e.message || p("shakeError"); action.disabled = false; }
        };
        card.append(heading, meta); if (about.textContent) card.appendChild(about); card.appendChild(action); people.appendChild(card);
      });
    } catch (e) { status.textContent = e.message || p("shakeError"); }
  }


  let motionShakeBound = false, lastMotionShakeAt = 0;
  function bindMotionShake() {
    if (motionShakeBound || !window.addEventListener || !("DeviceMotionEvent" in window)) return;
    motionShakeBound = true;
    window.addEventListener("devicemotion", (event) => {
      if (document.visibilityState === "hidden" || Date.now() - lastMotionShakeAt < 2500) return;
      const a = event.accelerationIncludingGravity || event.acceleration;
      if (!a) return;
      const magnitude = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const panel = body.querySelector("#dashboard-shake");
      if (magnitude > 22 && panel && !panel.hidden) {
        lastMotionShakeAt = Date.now();
        discoverShakePeople(true);
      }
    }, { passive: true });
  }

  async function loadCommunityPanel() {
    const status = body.querySelector("#communityStatus"), feed = body.querySelector("#communityFeed");
    const publish = body.querySelector("#communityPublish");
    if (!feed || !publish) return;
    publish.onclick = async () => {
      const field = body.querySelector("#communityBody");
      if (!field || !field.value.trim()) { status.textContent = "Write something first."; return; }
      publish.disabled = true; status.textContent = "Publishing anonymously…";
      try {
        await api("/api/community/posts", { method: "POST", body: {
          body: field.value, audience: body.querySelector("#communityAudience")?.value || "global",
          radius_km: Number(body.querySelector("#shakeRadius")?.value || 25)
        }});
        field.value = ""; status.textContent = "Posted anonymously."; await loadCommunityPanel();
      } catch (e) { status.textContent = e.message || "Post could not be published."; }
      finally { publish.disabled = false; }
    };
    try {
      const result = await api("/api/community/feed");
      feed.innerHTML = "";
      if (!result.posts?.length) { feed.innerHTML = "<p class='modal-description'>No posts yet. Start the conversation anonymously.</p>"; return; }
      result.posts.forEach((post) => {
        const card = document.createElement("article"); card.className = "shake-person";
        const heading = document.createElement("h3"); heading.textContent = "Anonymous · " + fmt(post.created_at);
        const textNode = document.createElement("p"); textNode.textContent = post.body;
        card.append(heading, textNode);
        if (post.mine) {
          const remove = document.createElement("button"); remove.className = "nv-link"; remove.type = "button"; remove.textContent = "Delete post";
          remove.onclick = async () => { try { await api("/api/community/posts/" + encodeURIComponent(post.id), { method: "DELETE" }); await loadCommunityPanel(); } catch (e) { status.textContent = e.message; } };
          card.appendChild(remove);
        } else {
          const report = document.createElement("button"); report.className = "nv-link"; report.type = "button"; report.textContent = "Report post";
          report.onclick = async () => {
            if (!confirm("Report this anonymous post?")) return;
            try { await api("/api/community/posts/" + encodeURIComponent(post.id) + "/report", { method: "POST", body: { reason: "inappropriate_content" } }); status.textContent = "Report received."; }
            catch (e) { status.textContent = e.message || "Report could not be submitted."; }
          };
          const block = document.createElement("button"); block.className = "nv-link"; block.type = "button"; block.textContent = "Block author";
          block.onclick = async () => {
            if (!confirm("Block this anonymous post author? Their posts and chats will no longer be shown.")) return;
            try { await api("/api/community/posts/" + encodeURIComponent(post.id) + "/block", { method: "POST" }); status.textContent = "Member blocked."; await loadCommunityPanel(); }
            catch (e) { status.textContent = e.message || "Member could not be blocked."; }
          };
          card.append(report, block);
        }
        feed.appendChild(card);
      });
    } catch (e) { status.textContent = e.message || "Community feed could not be loaded."; }
  }

  async function loadFriendsPanel() {
    const incomingBox = body.querySelector("#friendRequests"), list = body.querySelector("#friendList"), status = body.querySelector("#friendsStatus");
    if (!incomingBox || !list) return;
    try {
      const results = await Promise.all([api("/api/friends/requests"), api("/api/friends")]);
      const requests = results[0], friends = results[1];
      incomingBox.innerHTML = "";
      (requests.incoming || []).forEach((request) => {
        const row = document.createElement("article"); row.className = "shake-person";
        const label = document.createElement("p"); label.textContent = "Someone wants to become your friend.";
        const accept = document.createElement("button"); accept.className = "primary-btn"; accept.textContent = "Accept";
        const decline = document.createElement("button"); decline.className = "outline-btn"; decline.textContent = "Decline";
        accept.onclick = () => respondFriend(request.id, true);
        decline.onclick = () => respondFriend(request.id, false);
        row.append(label, accept, decline); incomingBox.appendChild(row);
      });
      list.innerHTML = "";
      if (!(friends.friends || []).length) list.innerHTML = "<p class='modal-description'>No friends yet. Start with a chat.</p>";
      (friends.friends || []).forEach((friend) => {
        const row = document.createElement("article"); row.className = "shake-person";
        const title = document.createElement("h3"); title.textContent = friend.display_name;
        const details = document.createElement("p"); details.textContent = [friend.age, friend.district].filter(Boolean).join(" · ");
        const chat = document.createElement("button"); chat.className = "primary-btn"; chat.type = "button"; chat.textContent = "Chat";
        chat.onclick = async () => {
          chat.disabled = true;
          try {
            const opened = await api("/api/friends/" + encodeURIComponent(friend.friend_id) + "/chat", { method: "POST" });
            selectedMatchId = opened.match_id; await loadAll(); render();
          } catch (e) { chat.disabled = false; if (status) status.textContent = e.message || "Friend chat could not be opened."; }
        };
        row.append(title, details, chat); list.appendChild(row);
      });
      if (!requests.incoming?.length) incomingBox.innerHTML = "<p class='modal-description'>No pending friend requests.</p>";
    } catch (e) { if (status) status.textContent = e.message || "Friends could not be loaded."; }
  }

  async function respondFriend(id, accept) {
    try {
      await api("/api/friends/requests/" + encodeURIComponent(id) + "/respond", { method: "POST", body: { accept } });
      await loadFriendsPanel();
    } catch (e) {
      const status = body.querySelector("#friendsStatus"); if (status) status.textContent = e.message || "Request could not be updated.";
    }
  }

  function msg(text, ok) { const el = body.querySelector("#pMsg"); if (el) { el.textContent = text; el.className = "nv-msg" + (ok ? " ok" : ""); } }

  async function uploadPhoto(file) {
    const out = body.querySelector("#photoMsg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      if (out) out.textContent = p("photoError") + " (JPEG/PNG/WebP, max 5 MB)";
      return;
    }
    if (out) out.textContent = p("photoUpload");
    const input = body.querySelector("#photoInput");
    if (input) input.disabled = true;
    try {
      const s = await session();
      const response = await fetch(window.NV.API + "/api/profile/photos", {
        method: "POST",
        headers: { Authorization: "Bearer " + s.access_token, "Content-Type": file.type },
        body: file
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || p("photoError"));
      await loadAll(); render();
    } catch (e) {
      if (out) out.textContent = e.message || p("photoError");
      if (input) input.disabled = false;
    }
  }


  // ----- edit profile -----
  function renderEdit() {
    const vs = ["music", "movies", "gaming", "sports", "travel", "food", "art", "books", "technology", "fitness", "nature", "languages", "photography", "culture", "learning"];
    body.innerHTML = `<h2 class="modal-title">${p("editProfile")}</h2><p class="modal-description">Update the details shown on your BEYOND profile. Your visibility is controlled separately.</p>
      <div class="field-grid"><div class="field"><label>${p("name")}</label><input id="eName" value="${esc(val("full_name"))}"></div><div class="field"><label>${p("age")}</label><input id="eAge" type="number" min="18" max="100" value="${esc(val("age"))}"></div></div>
      <div class="field"><label>City / region / country</label><input id="ePlace" maxlength="120" value="${esc(val("district"))}" placeholder="e.g. Kochi, India"></div>
      <div class="field"><label>${p("job")}</label><input id="eJob" value="${esc(val("job_title"))}"></div>
      <label class="field-label">Interests (up to 5)</label><div class="choice-grid">${vs.map((v) => `<label class="choice"><input type="checkbox" name="eVals" value="${v}" ${(profile.core_values || []).includes(v) ? "checked" : ""}> ${valName(v)}</label>`).join("")}</div>
      <div class="field"><label>${p("about")}</label><textarea id="eAbout" rows="4" maxlength="1000">${esc(val("bio"))}</textarea></div>
      <div class="nv-msg" id="pMsg"></div><div class="nv-row"><button class="primary-btn" id="eSave" type="button">${p("save")}</button><button class="back-btn" id="eBack" type="button">${p("close")}</button></div>`;
    const $ = (s) => body.querySelector(s);
    $("#eBack").onclick = render;
    $("#eSave").onclick = async () => {
      const vals = [...body.querySelectorAll("[name=eVals]:checked")].map((x) => x.value);
      if (vals.length < 1 || vals.length > 5) return msg(L() === "ml" ? "1 മുതൽ 5 വരെ താൽപര്യങ്ങൾ തിരഞ്ഞെടുക്കുക." : "Choose 1 to 5 interests.");
      $("#eSave").disabled = true; $("#eSave").textContent = p("saving");
      try {
        const r = await api("/api/profile", { method: "PUT", body: {
          full_name: $("#eName").value, age: Number($("#eAge").value), district: $("#ePlace").value,
          job_title: $("#eJob").value, bio: $("#eAbout").value, core_values: vals } });
        profile = r.profile; await loadAll(); render(); msg(r.message || p("saved"), true);
      } catch (e) { $("#eSave").disabled = false; $("#eSave").textContent = p("save"); msg(e.message); }
    };
  }

  // ----- match, chat, voice -----
  function renderMatch() {
    const box = body.querySelector("#matchBox");
    if (profile.approval_status !== "approved") { box.innerHTML = `<p class="modal-description">${p("needApproval")}</p>`; return; }

    const tabs = matches.length ? `<div class="nv-row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">${matches.map((item, i) =>
      `<button type="button" class="${match?.id === item.id ? "primary-btn" : "outline-btn"}" data-match-id="${esc(item.id)}">${p("chatTab")} ${i + 1}${item.status === "proposed" ? " · Pending" : ""}</button>`
    ).join("")}</div>` : "";
    let header = `<p class="modal-description">${matches.length} conversation(s). Chats remain open until one member ends or blocks the connection.</p>`;
    if (!match) {
      box.innerHTML = header + `<div class="nv-msg" id="mMsg"></div>`;
    } else {
      const m = match;
      const anonymousBlock = m.is_shake_match && m.status === "active" && m.reveal?.partner_hidden
        ? `<div class="summary-box"><b>${p("shakeAnonymousTitle")}</b><p>The other member has chosen to keep their profile hidden. You can continue chatting anonymously.</p></div>`
        : (m.is_shake_match && m.status === "active" && !m.reveal?.revealed
          ? `<div class="summary-box"><b>${p("shakeAnonymousTitle")}</b><p>${p("shakeAnonymousInfo")}</p><p id="shakeRevealStatus">${m.reveal?.my_consented ? p("shakeWaitingReveal") : p("shakeReveal")}</p><div class="nv-row"><button class="outline-btn" id="shakeReveal" type="button">${m.reveal?.my_consented ? p("shakeRevealCheck") : p("shakeReveal")}</button>${m.reveal?.my_consented ? `<button class="nv-link" id="shakeWithdraw" type="button">${p("shakeWithdraw")}</button>` : ""}</div></div>`
          : (m.is_shake_match && m.status === "active" && m.reveal?.revealed ? `<p class="modal-description">${p("shakeRevealDone")}</p>` : ""));
      let h = header + tabs + anonymousBlock + partnerHtml(m.partner);
      if (["proposed", "active"].includes(m.status)) {
        h += `${m.is_persistent_chat ? "" : `<div class="countdown">${p("timeLeft")}: <b id="mLeft"></b></div>`}
          <div class="chat" id="chat"><div class="chat-status" id="chatStatus">${p("live")}</div><div class="chat-log" id="chatLog" aria-live="polite"></div>
          <div class="chat-input"><input id="chatText" maxlength="2000" placeholder="${p("typeMsg")}"><button class="primary-btn" id="chatSend" type="button">${p("send")}</button></div><div class="voice-messages" id="voiceLog" aria-live="polite"></div><div class="voice-controls"><button class="outline-btn" id="voiceRecord" type="button">${p("voiceRecord")}</button><span class="nv-msg" id="voiceStatus" role="status"></span></div></div>`;
        if (m.status === "proposed") {
          h += m.i_accepted
            ? `<p class="modal-description">${p("waitingPartner")}</p>`
            : `<p class="modal-description">${p("waitingYou")}</p>`;
          h += `<div class="nv-row">${m.i_accepted ? "" : `<button class="primary-btn" id="mContinue" type="button">${p("continueMatch")}</button>`}<button class="outline-btn" id="mStop" type="button">${p("stopMatch")}</button></div>`;
        } else {
          h += `<div class="nv-row"><button class="outline-btn" id="mEnd" type="button">${p("endMatch")}</button>${m.is_shake_match ? `<button class="primary-btn" id="friendRequest" type="button">Become friends</button>` : ""}</div>`;
        }
      }
      h += `<div class="nv-row nv-links"><button class="nv-link" id="mReport" type="button">${p("report")}</button><button class="nv-link" id="mBlock" type="button">${p("block")}</button></div><div id="safeBox"></div><div class="nv-msg" id="mMsg"></div>`;
      box.innerHTML = h;
    }

    box.querySelectorAll("[data-match-id]").forEach((button) => {
      button.onclick = () => {
        const next = matches.find((item) => item.id === button.dataset.matchId);
        if (!next || next.id === match?.id) return;
        closeChat(); stopRealtime(); match = next; selectedMatchId = next.id; render();
      };
    });
    if (!match) return;
    const m = match, $ = (s) => box.querySelector(s);
    $("#shakeReveal") && ($("#shakeReveal").onclick = async () => {
      const button = $("#shakeReveal"), status = $("#shakeRevealStatus");
      button.disabled = true;
      try {
        if (!m.reveal?.my_consented) {
          await api(`/api/shake/${encodeURIComponent(m.id)}/reveal`, { method: "POST" });
        }
        await loadAll(); render();
      } catch (e) {
        if (status) status.textContent = e.message || p("shakeError");
        button.disabled = false;
      }
    });
    $("#shakeWithdraw") && ($("#shakeWithdraw").onclick = async () => {
      const button = $("#shakeWithdraw"), status = $("#shakeRevealStatus");
      button.disabled = true;
      try {
        await api(`/api/shake/${encodeURIComponent(m.id)}/reveal`, { method: "DELETE" });
        await loadAll(); render();
      } catch (e) {
        if (status) status.textContent = e.message || p("shakeError");
        button.disabled = false;
      }
    });
    const respond = async (accept) => { try { await api(`/api/match/${m.id}/respond`, { method: "POST", body: { accept } }); await loadAll(); render(); } catch (e) { $("#mMsg").textContent = e.message; } };
    $("#mContinue") && ($("#mContinue").onclick = () => respond(true));
    $("#mStop") && ($("#mStop").onclick = () => respond(false));
    $("#mEnd") && ($("#mEnd").onclick = async () => { if (!confirm(p("endConfirm"))) return; try { await api(`/api/match/${m.id}/end`, { method: "POST" }); await loadAll(); render(); } catch (e) { $("#mMsg").textContent = e.message; } });
    $("#friendRequest") && ($("#friendRequest").onclick = async () => {
      const button = $("#friendRequest"); button.disabled = true;
      try {
        const result = await api("/api/friends/request", { method: "POST", body: { match_id: m.id } });
        button.textContent = result.status === "friends" ? "You are friends" : "Friend request sent";
        if (result.status === "friends" && result.chat_id) { selectedMatchId = result.chat_id; await loadAll(); render(); }
      } catch (e) { button.disabled = false; $("#mMsg").textContent = e.message || "Could not send friend request."; }
    });
    $("#mReport") && ($("#mReport").onclick = () => reportForm(m.id));
    $("#mBlock") && ($("#mBlock").onclick = async () => { if (!confirm(p("blockConfirm"))) return; try { const r = await api("/api/safety/block", { method: "POST", body: { match_id: m.id } }); await loadAll(); render(); msg(r.message, true); } catch (e) { $("#mMsg").textContent = e.message; } });
    if (["proposed", "active"].includes(m.status)) startChat(m);
  }

  function setStatus(txt) { const el = body.querySelector("#chatStatus"); if (el) el.textContent = txt; }
  function appendMsg(m) {
    if (seen.has(m.id)) return; seen.add(m.id);
    if (!lastTs || m.created_at > lastTs) lastTs = m.created_at;
    const log = body.querySelector("#chatLog"); if (!log) return;
    const d = document.createElement("div"); d.className = "bubble " + (m.mine ? "mine" : "theirs"); d.textContent = m.body;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function appendVoice(m) {
    if (!m?.id || voiceSeen.has(m.id)) return;
    voiceSeen.add(m.id);
    if (!lastVoiceTs || m.created_at > lastVoiceTs) lastVoiceTs = m.created_at;
    const log = body.querySelector("#voiceLog"); if (!log || !m.url) return;
    const wrap = document.createElement("div");
    wrap.className = "voice-bubble " + (m.mine ? "mine" : "theirs");
    const label = document.createElement("small");
    label.textContent = (m.mine ? "You" : "Match") + " · " + Math.max(1, Number(m.duration_seconds) || 1) + "s";
    const audio = document.createElement("audio");
    audio.controls = true; audio.preload = "none"; audio.src = m.url;
    wrap.append(label, audio); log.appendChild(wrap); log.scrollTop = log.scrollHeight;
  }

  function voiceStatus(message) {
    const el = body.querySelector("#voiceStatus"); if (el) el.textContent = message || "";
  }

  async function uploadVoice(blob, duration) {
    const button = body.querySelector("#voiceRecord");
    if (blob.size < 12 || blob.size > 2 * 1024 * 1024) { voiceStatus(p("voiceError")); return; }
    if (button) button.disabled = true;
    voiceStatus(p("voiceUploading"));
    try {
      const s = await session();
      const mime = (blob.type || voiceMime || "").split(";")[0];
      const response = await fetch(window.NV.API + "/api/chat/" + encodeURIComponent(match.id) + "/voice", {
        method: "POST",
        headers: { Authorization: "Bearer " + s.access_token, "Content-Type": mime, "X-Voice-Duration": String(duration) },
        body: blob
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || p("voiceError"));
      if (result.voice_message) appendVoice(result.voice_message);
      voiceStatus(p("voiceSent"));
    } catch (e) { voiceStatus(e.message || p("voiceError")); }
    finally { if (button) button.disabled = false; }
  }

  async function startVoiceRecording() {
    const button = body.querySelector("#voiceRecord");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { voiceStatus(p("voiceUnsupported")); return; }
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const chosen = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      voiceRecorder = chosen ? new MediaRecorder(voiceStream, { mimeType: chosen }) : new MediaRecorder(voiceStream);
      voiceMime = voiceRecorder.mimeType || chosen || "";
      if (!["audio/webm", "audio/ogg", "audio/mp4"].includes(voiceMime.split(";")[0])) {
        stopVoiceRecording(true); voiceStatus(p("voiceUnsupported")); return;
      }
      voiceChunks = []; voiceDiscard = false; voiceStartedAt = Date.now();
      voiceRecorder.ondataavailable = (event) => { if (event.data && event.data.size) voiceChunks.push(event.data); };
      voiceRecorder.onstop = async () => {
        clearTimeout(voiceLimitTimer); clearInterval(voiceDisplayTimer); voiceDisplayTimer = null;
        const blob = new Blob(voiceChunks, { type: voiceMime });
        const duration = Math.min(60, Math.max(1, Math.ceil((Date.now() - voiceStartedAt) / 1000)));
        voiceChunks = [];
        if (voiceStream) voiceStream.getTracks().forEach((track) => track.stop());
        voiceStream = null; voiceRecorder = null;
        if (button) { button.textContent = p("voiceRecord"); button.disabled = false; }
        if (!voiceDiscard) await uploadVoice(blob, duration);
        voiceDiscard = false;
      };
      voiceRecorder.start(250);
      if (button) button.textContent = p("voiceStop");
      voiceStatus(L() === "ml" ? "റെക്കോർഡിംഗ്… 00:00 / 01:00" : "Recording… 00:00 / 01:00");
      voiceDisplayTimer = setInterval(() => {
        const seconds = Math.min(60, Math.floor((Date.now() - voiceStartedAt) / 1000));
        voiceStatus((L() === "ml" ? "റെക്കോർഡിംഗ്… " : "Recording… ") + "00:" + String(seconds).padStart(2, "0") + " / 01:00");
      }, 1000);
      voiceLimitTimer = setTimeout(() => { if (voiceRecorder?.state === "recording") voiceRecorder.stop(); }, 60_000);
    } catch (e) {
      if (voiceStream) voiceStream.getTracks().forEach((track) => track.stop());
      voiceStream = null; voiceRecorder = null;
      if (button) button.textContent = p("voiceRecord");
      voiceStatus(p("voiceError"));
    }
  }

  function stopVoiceRecording(discard) {
    clearTimeout(voiceLimitTimer); clearInterval(voiceDisplayTimer); voiceDisplayTimer = null;
    if (discard) voiceDiscard = true;
    if (voiceRecorder && voiceRecorder.state === "recording") voiceRecorder.stop();
    else {
      if (voiceStream) voiceStream.getTracks().forEach((track) => track.stop());
      voiceStream = null; voiceRecorder = null;
    }
  }

  function closeChat() {
    setStatus(p("chatClosed"));
    const i = body.querySelector("#chatText"), b = body.querySelector("#chatSend"); if (i) i.disabled = true; if (b) b.disabled = true;
    stopVoiceRecording(true);
    stopRealtime();
  }

  async function startChat(m) {
    if (tickTimer) clearInterval(tickTimer);
    stopRealtime();
    seen = new Set(); lastTs = null; voiceSeen = new Set(); lastVoiceTs = null;
    const left = () => Math.max(0, Math.floor((new Date(m.expires_at) - Date.now()) / 1000));
    const tick = () => {
      const s = left(), el = body.querySelector("#mLeft"); if (!el) return;
      el.textContent = s > 0 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s` : p("closed");
      if (s <= 0) { clearInterval(tickTimer); closeChat(); loadAll().then(render).catch(() => {}); }
    };
    if (!m.is_persistent_chat) { tick(); tickTimer = setInterval(tick, 1000); }

    const pull = async () => {
      try {
        const r = await api(`/api/chat/${m.id}/messages` + (lastTs ? `?after=${encodeURIComponent(lastTs)}` : ""));
        r.messages.forEach(appendMsg);
      } catch (e) { if (e.code === "match_not_live" || e.status === 403 || e.status === 404) closeChat(); }
      try {
        const v = await api(`/api/chat/${m.id}/voice` + (lastVoiceTs ? `?after=${encodeURIComponent(lastVoiceTs)}` : ""));
        (v.voice_messages || []).forEach(appendVoice);
      } catch (e) { if (e.code === "match_not_live" || e.status === 403 || e.status === 404) closeChat(); }
    };
    await pull();
    pollTimer = setInterval(pull, 5000);
    const send = async () => {
      const i = body.querySelector("#chatText"); const text = i.value.trim(); if (!text) return;
      i.value = ""; 
      try { const r = await api(`/api/chat/${m.id}/messages`, { method: "POST", body: { body: text } }); appendMsg(r.message); }
      catch (e) { i.value = text; if (e.status === 403 || e.status === 404) closeChat(); else setStatus(e.message); }
    };
    body.querySelector("#chatSend").onclick = send;
    body.querySelector("#chatText").onkeydown = (e) => { if (e.key === "Enter") send(); };
    const voiceButton = body.querySelector("#voiceRecord");
    if (voiceButton) voiceButton.onclick = () => {
      if (voiceRecorder && voiceRecorder.state === "recording") voiceRecorder.stop();
      else startVoiceRecording();
    };

    // Realtime for instant delivery; polling covers reconnects and network drops.
    const c = client();
    chatChannel = c.channel("chat:" + m.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "match_id=eq." + m.id }, (pl) => {
        const r = pl.new; appendMsg({ id: r.id, mine: r.sender_id === me.id, body: r.body, created_at: r.created_at });
      })
      .subscribe((s) => { if (s === "SUBSCRIBED") setStatus(p("live")); else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s)) setStatus(p("reconnecting")); });
  }

  function stopRealtime() {
    clearInterval(pollTimer); pollTimer = null;
    try { chatChannel && client().removeChannel(chatChannel); } catch { /* ignore */ }
    chatChannel = null;
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
