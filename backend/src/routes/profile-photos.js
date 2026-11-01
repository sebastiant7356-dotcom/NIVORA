"use strict";
const express = require("express");
const { randomUUID } = require("node:crypto");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid } = require("../lib/validation");
const { audit } = require("../lib/audit");

const router = express.Router();
const BUCKET = "profile-photos";
const MAX_BYTES = 5 * 1024 * 1024;
router.use(requireAuth);

const uploadLimit = createLimiter({ windowMs: 60 * 60_000, max: 12, keyFn: byUser });

function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.length > MAX_BYTES) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", ext: "png" };
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

async function signedPhoto(db, photo) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(photo.object_path, 600);
  if (error) throw error;
  return { id: photo.id, sort_order: photo.sort_order, approval_status: photo.approval_status,
    review_reason: photo.review_reason, created_at: photo.created_at, url: data.signedUrl };
}

router.get("/", async (req, res) => {
  const db = serviceClient();
  const { data: staff, error: staffError } = await db.from("staff_roles").select("user_id").eq("user_id", req.user.id).maybeSingle();
  if (staffError) return res.status(500).json({ success: false, message: "Could not verify account type." });
  if (staff) return res.json({ success: true, photos: [] });
  const { data, error } = await db.from("profile_photos")
    .select("id, object_path, sort_order, approval_status, review_reason, created_at")
    .eq("user_id", req.user.id).order("sort_order");
  // Photo approval is automatic; staff review is initiated only through user reports.
  const pendingIds = (data || []).filter((p) => p.approval_status === "pending").map((p) => p.id);
  if (pendingIds.length) {
    await db.from("profile_photos").update({ approval_status: "approved", review_reason: null })
      .in("id", pendingIds).eq("user_id", req.user.id);
    for (const p of data) if (pendingIds.includes(p.id)) { p.approval_status = "approved"; p.review_reason = null; }
  }
  if (error) return res.status(500).json({ success: false, message: "Could not load your photos." });
  try {
    const photos = await Promise.all((data || []).map((p) => signedPhoto(db, p)));
    res.json({ success: true, photos });
  } catch {
    res.status(500).json({ success: false, message: "Could not prepare photo previews." });
  }
});

router.post("/", uploadLimit, async (req, res) => {
  const image = detectImage(req.body);
  if (!image) return res.status(400).json({ success: false, message: "Upload a valid JPEG, PNG or WebP image up to 5 MB." });
  const db = serviceClient();
  const { data: staff, error: staffError } = await db.from("staff_roles").select("user_id").eq("user_id", req.user.id).maybeSingle();
  if (staffError) return res.status(500).json({ success: false, message: "Could not verify account type." });
  if (staff) return res.status(403).json({ success: false, message: "Staff accounts do not use customer photos." });
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id, approval_status, suspended_at").eq("id", req.user.id).maybeSingle();
  if (profileError) return res.status(500).json({ success: false, message: "Could not verify your profile." });
  if (!profile || profile.suspended_at || profile.approval_status === "rejected") {
    return res.status(403).json({ success: false, message: "Your profile is not eligible to upload photos." });
  }

  const { data: existing, error: listError } = await db.from("profile_photos")
    .select("id, sort_order").eq("user_id", req.user.id);
  if (listError) return res.status(500).json({ success: false, message: "Could not check your photo limit." });
  if ((existing || []).length >= 4) return res.status(409).json({ success: false, message: "You can upload up to 4 photos." });
  const used = new Set((existing || []).map((p) => p.sort_order));
  const sortOrder = [0,1,2,3].find((n) => !used.has(n));
  const objectPath = req.user.id + "/" + randomUUID() + "." + image.ext;

  const { error: uploadError } = await db.storage.from(BUCKET).upload(objectPath, req.body, {
    contentType: image.mime, upsert: false, cacheControl: "3600"
  });
  if (uploadError) return res.status(500).json({ success: false, message: "Photo upload failed." });

  const { data: photo, error: insertError } = await db.from("profile_photos").insert({
    user_id: req.user.id, object_path: objectPath, mime_type: image.mime,
    size_bytes: req.body.length, sort_order: sortOrder, approval_status: "approved"
  }).select("id, object_path, sort_order, approval_status, review_reason, created_at").single();
  if (insertError) {
    await db.storage.from(BUCKET).remove([objectPath]).catch(() => {});
    if (insertError.code === "23505") return res.status(409).json({ success: false, message: "Photo limit reached. Refresh your photos and try again." });
    return res.status(500).json({ success: false, message: "Photo record could not be saved." });
  }
  await audit(req.user.id, "profile_photo_uploaded", "profile_photo", photo.id);
  try { res.status(201).json({ success: true, photo: await signedPhoto(db, photo) }); }
  catch { res.status(201).json({ success: true, photo: { id: photo.id, approval_status: photo.approval_status, sort_order: photo.sort_order } }); }
});

router.delete("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid photo id." });
  const db = serviceClient();
  const { data: photo, error } = await db.from("profile_photos").select("id, object_path")
    .eq("id", req.params.id).eq("user_id", req.user.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, message: "Could not load photo." });
  if (!photo) return res.status(404).json({ success: false, message: "Photo not found." });
  const { error: removeError } = await db.storage.from(BUCKET).remove([photo.object_path]);
  if (removeError) return res.status(500).json({ success: false, message: "Photo file could not be removed." });
  const { error: deleteError } = await db.from("profile_photos").delete().eq("id", photo.id).eq("user_id", req.user.id);
  if (deleteError) return res.status(500).json({ success: false, message: "Photo record could not be removed." });
  await audit(req.user.id, "profile_photo_deleted", "profile_photo", photo.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.detectImage = detectImage;
