import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse } from '../js/listen.js';
import { candidateName } from '../js/identify.js';

const SR = 48000, N = 16384, T = [40, 45, 50, 55, 59, 64];
// Synthetic plucked chord: each string a decaying harmonic tone.
function chord(frets, seed = 3) {
  let x = seed; const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647 - 0.5; };
  const b = new Float32Array(N);
  frets.forEach((f, s) => {
    if (f === null) return;
    const hz = 440 * Math.pow(2, (T[s] + f - 69) / 12);
    const amps = [1, 0.5, 0.33, 0.2, 0.12];
    for (let i = 0; i < N; i++) {
      const t = 0.3 + i / SR;
      let v = 0;
      amps.forEach((a, h) => { v += a * Math.sin(2 * Math.PI * hz * (h + 1) * t + s); });
      b[i] += 0.08 * v * Math.exp(-t / 1.5);
    }
  });
  for (let i = 0; i < N; i++) b[i] += 0.002 * rnd();
  return b;
}
const top = (frets) => { const r = analyse(chord(frets), SR); return r.candidates.map(candidateName); };

test('names common jazz voicings from sound', () => {
  for (const [want, frets] of [
    ['Cmaj7', [null, 3, 5, 4, 5, null]],
    ['Dm7', [null, 5, 7, 5, 6, null]],
    ['G7', [3, null, 3, 4, 3, null]],
    ['C', [null, 3, 2, 0, 1, 0]],
    ['Am7', [null, 0, 2, 0, 1, 0]],
  ]) {
    const names = top(frets);
    assert.equal(names[0], want, `${want}: got ${names.join(' / ')}`);
  }
});

test('silence gives no name', () => {
  const r = analyse(new Float32Array(N), SR);
  assert.equal(r.candidates.length, 0);
});
