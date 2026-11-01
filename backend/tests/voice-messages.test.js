"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validAudio } = require("../src/routes/chat");

test("accepts WebM, Ogg, MP4, WAV and MPEG audio signatures", () => {
  assert.equal(validAudio(Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0,0,0,0,0]), "audio/webm"), true);
  assert.equal(validAudio(Buffer.from("OggS00000000"), "audio/ogg"), true);
  assert.equal(validAudio(Buffer.from("0000ftypM4A 0000"), "audio/mp4"), true);
  assert.equal(validAudio(Buffer.from("RIFF0000WAVE"), "audio/wav"), true);
  assert.equal(validAudio(Buffer.from("ID3000000000"), "audio/mpeg"), true);
});

test("rejects unknown, malformed and oversized audio", () => {
  assert.equal(validAudio(Buffer.from("not-audio-data"), "audio/webm"), false);
  assert.equal(validAudio(Buffer.alloc(12), "audio/unknown"), false);
  assert.equal(validAudio(Buffer.alloc(2 * 1024 * 1024 + 1), "audio/webm"), false);
});
