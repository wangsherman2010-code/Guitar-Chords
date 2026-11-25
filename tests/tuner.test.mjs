import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, freqToMidi } from '../js/tuner.js';

// Synthetic plucked-string-like tone: fundamental + harmonics, decaying.
function tone(freq, sr = 48000, n = 4096, harmonics = [1, 0.6, 0.4, 0.25]) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, h) => { v += a * Math.sin(2 * Math.PI * freq * (h + 1) * i / sr); });
    b[i] = 0.3 * v * Math.exp(-i / (sr * 0.8));
  }
  return b;
}

test('detects every open string within 2 cents', () => {
  for (const f of [82.41, 110, 146.83, 196, 246.94, 329.63]) {
    const r = detectPitch(tone(f), 48000);
    assert.ok(r, `no pitch for ${f}`);
    const cents = (freqToMidi(r.freq) - freqToMidi(f)) * 100;
    assert.ok(Math.abs(cents) < 2, `${f}Hz -> ${r.freq.toFixed(2)} (${cents.toFixed(1)} cents)`);
  }
});

test('detects a slightly flat string', () => {
  const f = 110 * Math.pow(2, -15 / 1200); // A, 15 cents flat
  const r = detectPitch(tone(f), 48000);
  const cents = (freqToMidi(r.freq) - 45) * 100;
  assert.ok(Math.abs(cents + 15) < 2, cents.toFixed(1));
});

test('strong 2nd harmonic does not cause an octave error', () => {
  const r = detectPitch(tone(82.41, 48000, 4096, [0.5, 1, 0.7, 0.4]), 48000);
  assert.ok(Math.abs(freqToMidi(r.freq) - 40) < 0.1, r.freq.toFixed(2));
});

test('silence returns null', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
});
