import test from 'node:test';
import assert from 'node:assert/strict';
import { SIDEngine, EFFECTS, PAL_CLOCK } from '../sid-engine.mjs';

function render(engine, seconds, blockSize = 128) {
  const count = Math.ceil(seconds * engine.rate), audio = new Float32Array(count);
  for (let offset = 0; offset < count; offset += blockSize) engine.render(audio.subarray(offset, Math.min(count, offset + blockSize)));
  return audio;
}
function peak(audio) { let max = 0; for (const sample of audio) { assert(Number.isFinite(sample)); max = Math.max(max, Math.abs(sample)); } return max; }
test('both SID models produce finite, unclipped, different output through a real three-voice chip', () => {
  const a = new SIDEngine(), b = new SIDEngine(48000, '8580');
  const first = render(a, .3), second = render(b, .3);
  assert(peak(first) > .001 && peak(first) < 1); assert(peak(second) > .001 && peak(second) < 1);
  assert.notDeepEqual(first, second); assert.equal(a.sid.voice.length, 3); assert.equal(a.stats().clock, PAL_CLOCK);
});
test('sample and PAL frame accounting is exact across browser sample rates and arbitrary block sizes', () => {
  for (const rate of [44100, 48000, 96000]) {
    const engine = new SIDEngine(rate);
    render(engine, .2, 137);
    assert.equal(engine.samples, rate / 5); assert.equal(engine.frame, 10);
    engine.reset(); render(engine, .1, 128); assert.equal(engine.frame, 5);
  }
});
test('each gameplay patch makes audible SID output with music off', () => {
  for (const name of Object.keys(EFFECTS)) {
    const engine = new SIDEngine(); engine.configure({ music: false }); engine.trigger([name]);
    assert(peak(render(engine, .7)) > .0001, name);
    assert.equal(engine.effectCount, 1); assert.equal(engine.sid.voice.length, 3);
  }
});
test('effect priority steals one voice without introducing a fourth oscillator', () => {
  const engine = new SIDEngine(); engine.trigger(['dig', 'gem', 'death']);
  assert.equal(engine.lastEffect, 'death'); engine.trigger(['dig']);
  assert.equal(engine.effectCount, 1); assert.equal(engine.lastEffect, 'death');
});
test('pause freezes synthesis and master mute produces exact silence', () => {
  const engine = new SIDEngine(); render(engine, .1); const before = engine.stats();
  engine.configure({ paused: true }); assert.equal(peak(render(engine, .1)), 0); assert.deepEqual(engine.stats(), before);
  engine.configure({ paused: false, master: 0 }); assert.equal(peak(render(engine, .1)), 0);
});
test('sequencing is deterministic and the nine-effect sound check runs to completion', () => {
  const first = new SIDEngine(), second = new SIDEngine();
  first.soundCheck(); second.soundCheck();
  assert.deepEqual(render(first, .2), render(second, .2));
  const demo = render(first, 9.1);
  assert(peak(demo) < 1); assert.equal(first.effectCount, 9); assert.equal(first.lastEffect, 'win'); assert.equal(first.demoFrame, null);
});
