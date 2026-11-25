import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, freqToMidi, rangeAround, decimate2 } from '../js/tuner.js';

// Realistic low E through a phone mic: fundamental nearly gone, strong
// 2nd/3rd harmonics, slight inharmonicity (stretched overtones) and noise.
function lowE(cents = 0, { sr = 48000, n = 8192, fund = 0.08, noise = 0.03, seed = 1, t0 = 0 } = {}) {
  const f = 82.41 * Math.pow(2, cents / 1200);
  const amps = [fund, 1, 0.9, 0.6, 0.5, 0.35, 0.25, 0.15];
  const B = 0.00012; // inharmonicity
  let x = seed;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647 - 0.5; };
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sr;
    let v = 0;
    amps.forEach((a, k) => { const h = k + 1; v += a * Math.sin(2 * Math.PI * f * h * Math.sqrt(1 + B * h * h) * t + k); });
    b[i] = 0.12 * v * Math.exp(-t / 2) + noise * rnd();
  }
  return b;
}
const half = (b) => decimate2(b, new Float32Array(b.length / 2));
const centsOff = (r, midi) => (freqToMidi(r.freq) - midi) * 100;

test('weak-fundamental low E: full search finds E2, not an overtone', () => {
  let ok = 0;
  for (let s = 1; s <= 20; s++) {
    const r = detectPitch(half(lowE(0, { seed: s, t0: s * 0.05 })), 24000);
    if (r && Math.abs(centsOff(r, 40)) < 15) ok++;
  }
  assert.ok(ok >= 18, `only ${ok}/20 frames read E2`);
});

test('focused on the low E string: every frame accurate within 5 cents', () => {
  for (let s = 1; s <= 20; s++) {
    const r = detectPitch(half(lowE(-12, { seed: s, t0: s * 0.05 })), 24000, rangeAround(40));
    assert.ok(r, `frame ${s}: no reading`);
    const c = centsOff(r, 40);
    assert.ok(Math.abs(c + 12) < 5, `frame ${s}: ${c.toFixed(1)} cents (expected -12)`);
  }
});

test('focused search also works on the high strings', () => {
  for (const [f, midi] of [[246.94, 59], [329.63, 64]]) {
    const n = 8192, sr = 48000, b = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr; b[i] = 0.2 * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t)); }
    const r = detectPitch(half(b), 24000, rangeAround(midi));
    assert.ok(Math.abs(centsOff(r, midi)) < 3, `${midi}: ${centsOff(r, midi).toFixed(1)}`);
  }
});
