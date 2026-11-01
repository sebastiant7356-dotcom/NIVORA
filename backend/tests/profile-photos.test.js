"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { detectImage } = require("../src/routes/profile-photos");

test("accepts JPEG signature", () => {
  const data = Buffer.alloc(20);
  data.set([0xff, 0xd8, 0xff]);
  assert.deepEqual(detectImage(data), { mime: "image/jpeg", ext: "jpg" });
});

test("accepts PNG signature", () => {
  const data = Buffer.alloc(20);
  data.set([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(detectImage(data), { mime: "image/png", ext: "png" });
});

test("accepts WebP signature", () => {
  const data = Buffer.alloc(20);
  data.write("RIFF", 0, "ascii");
  data.write("WEBP", 8, "ascii");
  assert.deepEqual(detectImage(data), { mime: "image/webp", ext: "webp" });
});

test("rejects spoofed, short and oversized files", () => {
  assert.equal(detectImage(Buffer.from("not an image file")), null);
  assert.equal(detectImage(Buffer.alloc(15)), null);
  assert.equal(detectImage(Buffer.alloc(5 * 1024 * 1024 + 1)), null);
  assert.equal(detectImage(null), null);
});
