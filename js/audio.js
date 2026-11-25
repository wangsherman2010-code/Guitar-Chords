// Small plucked-string synth (Karplus–Strong) + metronome, no samples needed.
let ctx = null;
let master = null;
const cache = new Map();

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function pluckBuffer(midi) {
  if (cache.has(midi)) return cache.get(midi);
  const c = audio();
  const sr = c.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const dur = 2.6;
  const len = Math.floor(sr * dur);
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(N);
  // Slightly low-passed noise burst = softer, more "jazz box" attack.
  let prev = 0;
  for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.5 + r * 0.5; ring[i] = prev; }
  const decay = 0.4985 + Math.min(0.0012, freq / 2_000_000);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % N;
    const v = ring[idx];
    out[i] = v;
    ring[idx] = (v + ring[next]) * decay;
    idx = next;
  }
  cache.set(midi, buf);
  return buf;
}

function playAt(midi, when, gain = 0.8) {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(midi);
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(when);
}

export function strum(pitches, { spread = 0.035 } = {}) {
  const c = audio();
  const t = c.currentTime + 0.02;
  [...pitches].sort((a, b) => a - b).forEach((p, i) => playAt(p, t + i * spread, 0.7));
}

export function arpeggio(pitches, { step = 0.32 } = {}) {
  const c = audio();
  const t = c.currentTime + 0.02;
  [...pitches].sort((a, b) => a - b).forEach((p, i) => playAt(p, t + i * step, 0.8));
}

// "Hearing intervals" drill: root together with each chord tone, up then down.
export function intervalDrill(rootPitch, tonePitches, { step = 1.0 } = {}) {
  const c = audio();
  let t = c.currentTime + 0.05;
  const ups = [...tonePitches].sort((a, b) => a - b);
  const seq = [...ups, ...ups.slice(0, -1).reverse()];
  for (const p of seq) {
    playAt(rootPitch, t, 0.6);
    if (p !== rootPitch) playAt(p, t + 0.02, 0.7);
    t += step;
  }
  return seq.length * step;
}

export function note(midi) {
  const c = audio();
  playAt(midi, c.currentTime + 0.01, 0.8);
}

// ---------------------------------------------------------------------------
// Metronome with look-ahead scheduling.
// ---------------------------------------------------------------------------
export class Metronome {
  constructor(onBeat) {
    this.bpm = 80;
    this.beats = 4;
    this.running = false;
    this.onBeat = onBeat;
    this._timer = null;
  }
  start() {
    const c = audio();
    this.running = true;
    this.beat = 0;
    this.next = c.currentTime + 0.08;
    this._timer = setInterval(() => this._tick(), 25);
  }
  stop() {
    this.running = false;
    clearInterval(this._timer);
  }
  toggle() { this.running ? this.stop() : this.start(); return this.running; }
  _tick() {
    const c = audio();
    while (this.next < c.currentTime + 0.12) {
      const accent = this.beat % this.beats === 0;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = accent ? 1600 : 1000;
      g.gain.setValueAtTime(0.0001, this.next);
      g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, this.next + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, this.next + 0.05);
      o.connect(g).connect(master);
      o.start(this.next);
      o.stop(this.next + 0.06);
      const beat = this.beat % this.beats;
      const delay = Math.max(0, (this.next - c.currentTime) * 1000);
      setTimeout(() => this.onBeat && this.onBeat(beat), delay);
      this.beat++;
      this.next += 60 / this.bpm;
    }
  }
}
