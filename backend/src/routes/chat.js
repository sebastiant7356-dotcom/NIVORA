"use strict";
const express = require("express");
const { randomUUID } = require("node:crypto");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { assertChatMatch } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);
const sendLimit = createLimiter({ windowMs: 60_000, max: 40, keyFn: byUser });
const voiceLimit = createLimiter({ windowMs: 10 * 60_000, max: 8, keyFn: byUser });
const VOICE_BUCKET = "voice-messages";
const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const VOICE_TYPES = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav"
};

function validAudio(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > MAX_VOICE_BYTES) return false;
  if (mime === "audio/webm") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === "audio/ogg") return buffer.toString("ascii", 0, 4) === "OggS";
  if (mime === "audio/mp4") return buffer.toString("ascii", 4, 8) === "ftyp";
  if (mime === "audio/wav") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
  if (mime === "audio/mpeg") return buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  return false;
}

async function voiceView(db, row) {
  const { data, error } = await db.storage.from(VOICE_BUCKET).createSignedUrl(row.object_path, 600);
  if (error) throw error;
  return {
    id: row.id, mine: false, sender_id: row.sender_id, duration_seconds: row.duration_seconds,
    created_at: row.created_at, url: data.signedUrl
  };
}

router.get("/:matchId/messages", async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  let q = serviceClient().from("messages").select("id, sender_id, body, created_at")
    .eq("match_id", req.params.matchId).order("created_at", { ascending: true }).limit(limit);
  if (req.query.after && !Number.isNaN(Date.parse(req.query.after))) q = q.gt("created_at", new Date(req.query.after).toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load messages." });
  res.json({
    success: true,
    expires_at: gate.match.expires_at,
    messages: (data || []).map((m) => ({ id: m.id, mine: m.sender_id === req.user.id, body: m.body, created_at: m.created_at }))
  });
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
    .insert({ match_id: req.params.matchId, sender_id: req.user.id, body })
    .select("id, body, created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Message could not be sent." });
  res.status(201).json({ success: true, message: { id: data.id, mine: true, body: data.body, created_at: data.created_at } });
});

router.get("/:matchId/voice", async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 50);
  let q = serviceClient().from("voice_messages")
    .select("id, sender_id, object_path, duration_seconds, created_at")
    .eq("match_id", req.params.matchId).order("created_at", { ascending: true }).limit(limit);
  if (req.query.after && !Number.isNaN(Date.parse(req.query.after))) q = q.gt("created_at", new Date(req.query.after).toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load voice messages." });
  try {
    const voiceMessages = await Promise.all((data || []).map(async (row) => ({
      ...(await voiceView(serviceClient(), row)), mine: row.sender_id === req.user.id
    })));
    res.json({ success: true, voice_messages: voiceMessages });
  } catch {
    res.status(500).json({ success: false, message: "Voice previews could not be prepared." });
  }
});

router.post("/:matchId/voice", voiceLimit, async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const duration = Number(req.headers["x-voice-duration"]);
  if (!VOICE_TYPES[mime] || !Number.isInteger(duration) || duration < 1 || duration > 60 ||
      !validAudio(req.body, mime)) {
    return res.status(400).json({ success: false, message: "Send a valid voice recording up to 60 seconds and 2 MB." });
  }
  const gate = await assertChatMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const db = serviceClient();
  const objectPath = req.params.matchId + "/" + req.user.id + "/" + randomUUID() + "." + VOICE_TYPES[mime];
  const { error: uploadError } = await db.storage.from(VOICE_BUCKET).upload(objectPath, req.body, {
    contentType: mime, upsert: false, cacheControl: "3600"
  });
  if (uploadError) return res.status(500).json({ success: false, message: "Voice message upload failed." });
  const { data, error } = await db.from("voice_messages").insert({
    match_id: req.params.matchId, sender_id: req.user.id, object_path: objectPath,
    mime_type: mime, size_bytes: req.body.length, duration_seconds: duration
  }).select("id, sender_id, object_path, duration_seconds, created_at").single();
  if (error) {
    await db.storage.from(VOICE_BUCKET).remove([objectPath]);
    return res.status(500).json({ success: false, message: "Voice message could not be saved." });
  }
  try {
    res.status(201).json({ success: true, voice_message: { ...(await voiceView(db, data)), mine: true } });
  } catch {
    res.status(201).json({ success: true, voice_message: { id: data.id, mine: true, duration_seconds: data.duration_seconds, created_at: data.created_at } });
  }
});

module.exports = router;
module.exports.validAudio = validAudio;
