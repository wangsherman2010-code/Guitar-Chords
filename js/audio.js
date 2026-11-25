// Guitar sound: recorded samples (FluidR3 GM, CC BY 3.0) with a small room
// reverb, plus a plucked-string synth (Karplus–Strong) as a fallback while
// samples load or if they can't load.
let ctx = null;
let master = null;
let sampleBus = null;
const cache = new Map();
const active = new Set(); // sounding notes, so they can be stopped
let gen = 0; // bumps on stopAll(); cancels notes still waiting to load

export const INSTRUMENTS = [
  { id: 'electric_guitar_jazz', name: 'Jazz guitar (clean electric)', gain: 3.2 },
  { id: 'acoustic_guitar_nylon', name: 'Nylon-string guitar', gain: 3.2 },
  { id: 'acoustic_guitar_steel', name: 'Steel-string acoustic', gain: 3.0 },
  { id: 'synth', name: 'Simple synth (no download)', gain: 1 },
];
const SAMPLE_MIN = 38;
const SAMPLE_MAX = 90;
let instrument = INSTRUMENTS[0];
const samples = new Map(); // `${inst}:${midi}` -> AudioBuffer | Promise

// Short synthetic room impulse response (no extra download).
function makeImpulse(c, seconds = 1.6, decay = 3.2) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // Samples: warm low-pass + a touch of room reverb.
    sampleBus = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 7500;
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx);
    sampleBus.connect(tone);
    tone.connect(dry).connect(master);
    tone.connect(verb).connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function sampleUrl(inst, midi) {
  return new URL(`../audio/${inst}/${midi}.mp3`, import.meta.url).href;
}

function loadSample(inst, midi) {
  const key = `${inst}:${midi}`;
  if (samples.has(key)) return samples.get(key);
  const c = audio();
  const p = fetch(sampleUrl(inst, midi))
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
    .then((buf) => { samples.set(key, buf); return buf; })
    .catch(() => { samples.delete(key); return null; });
  samples.set(key, p);
  return p;
}

// Load every note of the current instrument in the background.
export function preload() {
  if (instrument.id === 'synth') return Promise.resolve();
  const inst = instrument.id;
  const jobs = [];
  for (let m = SAMPLE_MIN; m <= SAMPLE_MAX; m++) jobs.push(loadSample(inst, m));
  return Promise.all(jobs);
}

export function setInstrument(id) {
  instrument = INSTRUMENTS.find((i) => i.id === id) || INSTRUMENTS[0];
}

function sampleFor(midi) {
  if (instrument.id === 'synth' || midi < SAMPLE_MIN || midi > SAMPLE_MAX) return null;
  const v = samples.get(`${instrument.id}:${midi}`);
  return v instanceof AudioBuffer ? v : null;
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

function playAt(midi, when, gain = 0.8, dur = 2.8) {
  const c = audio();
  const sample = sampleFor(midi);
  const src = c.createBufferSource();
  const g = c.createGain();
  if (sample) {
    src.buffer = sample;
    // Slight random velocity so repeated notes don't sound mechanical.
    const v = gain * instrument.gain * (0.9 + Math.random() * 0.15);
    g.gain.setValueAtTime(v, when);
    g.gain.setValueAtTime(v, when + dur - 0.35);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    src.connect(g).connect(sampleBus);
    src.start(when);
    src.stop(when + dur + 0.05);
    track(src, g);
  } else {
    if (instrument.id !== 'synth') loadSample(instrument.id, midi); // ready next time
    src.buffer = pluckBuffer(midi);
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(when);
    track(src, g);
  }
}

function track(src, g) {
  const n = { src, g };
  active.add(n);
  src.onended = () => active.delete(n);
}

// Silence everything quickly (short fade avoids a click).
export function stopAll() {
  gen++;
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const { src, g } of active) {
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.06);
      src.stop(t + 0.08);
    } catch { /* already stopped */ }
  }
  active.clear();
}

// Wait (briefly) for the needed samples, so the first strum isn't the synth.
async function ready(pitches) {
  if (instrument.id === 'synth') return;
  const jobs = pitches.filter((p) => p >= SAMPLE_MIN && p <= SAMPLE_MAX).map((p) => loadSample(instrument.id, p));
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 1500))]);
}

export async function strum(pitches, { spread = 0.028 } = {}) {
  audio();
  const my = gen;
  await ready(pitches);
  if (my !== gen) return;
  const c = audio();
  const t = c.currentTime + 0.02;
  // Thumb/pick strum: low to high, small human timing variation, top voice a bit louder.
  const sorted = [...pitches].sort((a, b) => a - b);
  let at = t;
  sorted.forEach((p, i) => {
    playAt(p, at, i === sorted.length - 1 ? 0.75 : 0.62);
    at += spread * (0.75 + Math.random() * 0.5);
  });
}

export async function arpeggio(pitches, { step = 0.32, dur = 2.8 } = {}) {
  audio();
  const my = gen;
  await ready(pitches);
  if (my !== gen) return;
  const c = audio();
  const t = c.currentTime + 0.02;
  [...pitches].sort((a, b) => a - b).forEach((p, i) => playAt(p, t + i * step, 0.8, dur));
}

// "Hearing intervals" drill: root together with each chord tone, up then down.
export function intervalDrill(rootPitch, tonePitches, { step = 1.0 } = {}) {
  audio();
  const ups = [...tonePitches].sort((a, b) => a - b);
  const seq = [...ups, ...ups.slice(0, -1).reverse()];
  const my = gen;
  ready([rootPitch, ...tonePitches]).then(() => {
    if (my !== gen) return;
    const c = audio();
    let t = c.currentTime + 0.05;
    for (const p of seq) {
      playAt(rootPitch, t, 0.6, step + 0.3);
      if (p !== rootPitch) playAt(p, t + 0.02, 0.7, step + 0.3);
      t += step;
    }
  });
  return seq.length * step + 0.5;
}

export async function note(midi) {
  audio();
  await ready([midi]);
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
