"use strict";
const express = require("express");
const crypto = require("node:crypto");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { assertChatMatch } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);
const sendLimit = createLimiter({ windowMs: 60_000, max: 40, keyFn: byUser });
const voiceLimit = createLimiter({ windowMs: 10 * 60_000, max: 8, keyFn: byUser });
const VOICE_BUCKET = "nivora-voice";
const VOICE_MIMES = new Set(["audio/webm", "audio/ogg", "audio/mp4"]);
const MAX_VOICE_BYTES = 2 * 1024 * 1024;

async function messageView(db, m, userId) {
  const out = { id: m.id, mine: m.sender_id === userId, type: m.message_type || "text", body: m.body, created_at: m.created_at };
  if (m.message_type === "voice" && m.voice_object_path) {
    const { data } = await db.storage.from(VOICE_BUCKET).createSignedUrl(m.voice_object_path, 600);
    if (data?.signedUrl) {
      out.voice_url = data.signedUrl;
      out.duration_seconds = m.voice_duration_seconds;
    }
  }
  return out;
}

router.get("/:matchId/messages", async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  let q = serviceClient().from("messages")
    .select("id, sender_id, body, message_type, voice_object_path, voice_duration_seconds, created_at")
    .eq("match_id", req.params.matchId).order("created_at", { ascending: true }).limit(limit);
  if (req.query.after && !Number.isNaN(Date.parse(req.query.after))) q = q.gt("created_at", new Date(req.query.after).toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load messages." });
  const db = serviceClient();
  const messages = await Promise.all((data || []).map((m) => messageView(db, m, req.user.id)));
  res.json({ success: true, expires_at: gate.match.expires_at, messages });
});

router.post("/:matchId/messages", sendLimit, async (req, res) => {
  if (!isUuid(req.params.matchId) || typeof req.body?.body !== "string") {
    return res.status(400).json({ success: false, message: "Invalid message." });
  }
  const body = clean(req.body.body);
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ success: false, message: "Message must be 1–2000 characters." });
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const { data, error } = await serviceClient().from("messages")
    .insert({ match_id: req.params.matchId, sender_id: req.user.id, body, message_type: "text" })
    .select("id, body, created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Message could not be sent." });
  res.status(201).json({ success: true, message: { id: data.id, mine: true, type: "text", body: data.body, created_at: data.created_at } });
});

router.post("/:matchId/voice", voiceLimit, express.raw({ type: "audio/*", limit: "2mb" }), async (req, res) => {
  if (!isUuid(req.params.matchId) || !Buffer.isBuffer(req.body) || req.body.length < 100) {
    return res.status(400).json({ success: false, message: "Invalid voice recording." });
  }
  const mime = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!VOICE_MIMES.has(mime) || req.body.length > MAX_VOICE_BYTES) {
    return res.status(415).json({ success: false, message: "Use a supported audio recording under 2 MB." });
  }
  const duration = Number.parseInt(req.get("x-voice-duration") || "", 10);
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
    return res.status(400).json({ success: false, message: "Voice messages must be 1–60 seconds." });
  }
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });

  const db = serviceClient();
  const ext = mime === "audio/ogg" ? "ogg" : mime === "audio/mp4" ? "m4a" : "webm";
  const objectPath = `${req.user.id}/${req.params.matchId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage.from(VOICE_BUCKET).upload(objectPath, req.body, {
    contentType: mime, upsert: false
  });
  if (uploadError) return res.status(500).json({ success: false, message: "Voice message upload failed." });

  const { data, error } = await db.from("messages").insert({
    match_id: req.params.matchId, sender_id: req.user.id, body: "[Voice message]",
    message_type: "voice", voice_object_path: objectPath, voice_duration_seconds: duration
  }).select("id, sender_id, body, message_type, voice_object_path, voice_duration_seconds, created_at").single();

  if (error) {
    await db.storage.from(VOICE_BUCKET).remove([objectPath]);
    return res.status(500).json({ success: false, message: "Voice message could not be saved." });
  }
  res.status(201).json({ success: true, message: await messageView(db, data, req.user.id) });
});

module.exports = router;
