// Listen: hear a strummed chord through the microphone and name it.
// 1. FFT of ~0.34 s of sound (Hann window).
// 2. Find the notes one at a time: the note whose harmonics carry the most
//    energy wins, then its harmonics are damped so its overtones don't show
//    up as extra notes (iterative harmonic-sum, after Klapuri).
// 3. Name the note set with the Finder's engine; if nothing fits, drop the
//    weakest note and try again.
import { identifyPitches } from './identify.js';
import { QUALITIES, degreePc, spellDegree } from './theory.js';
import { inversionName } from './voicings.js';

const PC_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const FFT_SIZE = 16384;
const MIDI_LO = 40; // E2, the low E
const MIDI_HI = 84; // C6
const HARM_W = [1, 0.8, 0.6, 0.45, 0.35];
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// FFT (radix-2, in place)
// ---------------------------------------------------------------------------
const hann = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
const re = new Float64Array(FFT_SIZE);
const im = new Float64Array(FFT_SIZE);

function fft() {
  const n = FFT_SIZE;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// Magnitude spectrum (first half) of the last FFT_SIZE samples.
export function spectrum(buf) {
  const off = buf.length - FFT_SIZE;
  for (let i = 0; i < FFT_SIZE; i++) { re[i] = buf[off + i] * hann[i]; im[i] = 0; }
  fft();
  const mag = new Float32Array(FFT_SIZE / 2);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

// ---------------------------------------------------------------------------
// Notes from a spectrum
// ---------------------------------------------------------------------------
function binRange(f, df) {
  return [Math.max(1, Math.floor((f * 0.9857) / df)), Math.ceil((f * 1.0145) / df)]; // ±25 cents
}
function peakAt(A, f, df) {
  const [lo, hi] = binRange(f, df);
  let m = 0;
  for (let b = lo; b <= hi && b < A.length; b++) if (A[b] > m) m = A[b];
  return m;
}

// Tuned on strummed chords built from real guitar recordings (jazz electric,
// nylon, steel): STRICT finds few phantom notes, LOOSE misses few real ones.
export const SETTINGS = { weights: HARM_W, hi: 76, rel: 0.16, fundMin: 0.2, damp: 0.2, overtoneRatio: 0.5 };
export const LOOSE = { hi: 76, rel: 0.06, fundMin: 0.1, damp: 0.5, overtoneRatio: 0 };

export function findNotes(mag, sampleRate, opts = {}) {
  const { weights, hi, rel: relThreshold, fundMin, damp, overtoneRatio } = { ...SETTINGS, ...opts };
  const maxNotes = 6;
  const df = sampleRate / FFT_SIZE;
  const A = Float32Array.from(mag);
  const notes = [];
  let first = 0;
  for (let k = 0; k < maxNotes; k++) {
    let best = -1, bestS = 0;
    for (let m = MIDI_LO; m <= hi; m++) {
      if (notes.some((n) => n.midi === m)) continue;
      const f = midiToFreq(m);
      let s = 0, maxH = 0;
      weights.forEach((w, h) => {
        if (f * (h + 1) < sampleRate / 2.2) { const a = peakAt(A, f * (h + 1), df); s += w * a; if (h > 0 && a > maxH) maxH = a; }
      });
      // A real note needs some energy at its own pitch (stops "phantom" notes
      // below the chord whose overtones happen to match real notes).
      if (fundMin && peakAt(A, f, df) < fundMin * maxH) continue;
      if (s > bestS) { bestS = s; best = m; }
    }
    if (best < 0) break;
    if (k === 0) first = bestS;
    else if (bestS < relThreshold * first) break;
    notes.push({ midi: best, salience: bestS });
    // Damp this note's harmonics so they aren't counted again.
    const f = midiToFreq(best);
    for (let h = 1; h <= 8; h++) {
      // Damp at least ±3 bins: low notes spill into the next semitone otherwise.
      let [lo, hi] = binRange(f * h, df);
      const c = Math.round((f * h) / df);
      lo = Math.min(lo, c - 3); hi = Math.max(hi, c + 3);
      for (let b = Math.max(1, lo); b <= hi && b < A.length; b++) A[b] *= damp;
    }
  }
  // A quiet note exactly an octave, octave+5th, two octaves, two octaves+3rd
  // or two octaves+5th above a much louder note is most likely its overtone.
  const OVERTONE = [12, 19, 24, 28, 31];
  const kept = notes.filter((n) => !notes.some((s) => s !== n && OVERTONE.includes(n.midi - s.midi) && n.salience < overtoneRatio * s.salience));
  return kept;
}

// ---------------------------------------------------------------------------
// Names from notes (drop the weakest non-bass note if nothing fits)
// ---------------------------------------------------------------------------
export function nameNotes(notes) {
  let set = [...notes].sort((a, b) => b.salience - a.salience);
  for (let drop = 0; drop <= 2 && set.length >= 2; drop++) {
    const res = identifyPitches(set.map((n) => n.midi));
    const plain = res.candidates.filter((c) => !c.rootless);
    if (plain.length) return { ...res, candidates: plain, notes: set };
    // remove the weakest note that isn't the bass
    const bass = Math.min(...set.map((n) => n.midi));
    const idx = set.map((n) => n.midi !== bass).lastIndexOf(true);
    if (idx < 0) break;
    set = set.filter((_, i) => i !== idx);
  }
  return { candidates: [], notes };
}

// ---------------------------------------------------------------------------
// Template scoring: compare the energy heard in each of the 12 note names with
// every chord in the library. One quiet or one phantom note costs a little
// instead of breaking the name.
// ---------------------------------------------------------------------------
export const TEMPLATE = { present: 0.15, sat: 0.3, missPenalty: 0.5, fifthMiss: 0.1, extraPenalty: 0.6, cx: 0.2, bassRoot: 0.5, bassOther: 0.05, bassOut: 0.8 };

export function pitchClassEnergy(notes) {
  const e = new Array(12).fill(0);
  for (const n of notes) e[n.midi % 12] += n.salience;
  const max = Math.max(...e) || 1;
  return e.map((v) => v / max);
}

const isExt = (t) => /^[#b]*(9|11|13)$/.test(t);
// Extra cost for richer chords, so faint overtones don't turn C into Cadd9.
function complexity(q, cx) {
  let c = 0;
  if (q.tones.length >= 4) c += cx;
  c += q.tones.filter(isExt).length * cx * 1.5;
  if (/[#b]5/.test(q.tones.join(' ')) && q.id !== 'm7b5' && q.id !== 'dim' && q.id !== 'dim7') c += cx * 0.5;
  return c;
}

export function templateNames(notes, opts = {}) {
  const P = { ...TEMPLATE, ...opts };
  if (notes.length < 2) return [];
  const e = pitchClassEnergy(notes);
  const strong = Math.max(...notes.map((n) => n.salience));
  const bassNote = notes.filter((n) => n.salience >= 0.25 * strong).reduce((a, b) => (b.midi < a.midi ? b : a));
  const bassPc = bassNote.midi % 12;
  const out = [];
  for (let root = 0; root < 12; root++) {
    for (const q of QUALITIES) {
      if (q.tones.length > 5) continue;
      const map = new Map();
      for (const t of q.tones) map.set((root + degreePc(t)) % 12, t);
      let score = 0;
      const missing = [];
      for (const [pc, t] of map) {
        if (e[pc] < P.present) { missing.push(t); score -= t === '5' ? P.fifthMiss : P.missPenalty; } else score += Math.min(1, e[pc] / P.sat);
      }
      if (missing.includes('1') || missing.length > 1 || missing.some(isExt)) continue;
      for (let pc = 0; pc < 12; pc++) if (!map.has(pc) && e[pc] >= P.present) score -= P.extraPenalty * Math.min(1, e[pc] / P.sat);
      score -= complexity(q, P.cx);
      const bassTok = map.get(bassPc);
      if (bassPc === root) score += P.bassRoot; else if (bassTok) score += P.bassOther; else score -= P.bassOut;
      const rootName = PC_NAME[root];
      out.push({
        root: rootName, quality: q, degrees: map, missing, rootless: false,
        bassName: bassTok ? spellDegree(rootName, bassTok) : PC_NAME[bassPc], bassTok,
        slash: bassPc !== root, inversion: bassPc === root ? 'Root position' : bassTok ? inversionName(q, bassTok) : 'Other bass note',
        score,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 6);
}

// Best guess: the strict note set named exactly, if it has a name; then the
// template ranking of the loose note set as alternatives.
export function analyseSpectrum(mag, sampleRate) {
  const strict = findNotes(mag, sampleRate);
  const exact = nameNotes(strict);
  const loose = findNotes(mag, sampleRate, LOOSE);
  const ranked = templateNames(loose);
  const first = exact.candidates.length ? [exact.candidates[0]] : [];
  // A note an octave+5th, two octaves+3rd or two octaves+5th above another
  // played note may be that note's overtone. If leaving such notes out still
  // gives a chord name, show that simpler name first.
  const suspects = strict.filter((n) => [...strict, ...loose].some((s) => [19, 28, 31].includes(n.midi - s.midi)));
  if (suspects.length && first.length) {
    const simpler = nameNotes(strict.filter((n) => !suspects.includes(n)));
    const c = simpler.candidates[0];
    if (c && c.quality.tones.length < first[0].quality.tones.length) first.unshift(c);
  }
  const key = (c) => `${c.root}|${c.quality.id}|${c.slash ? c.bassName : ''}`;
  const seen = new Set(first.map(key));
  const candidates = [...first, ...ranked.filter((c) => !seen.has(key(c)) && seen.add(key(c)))].slice(0, 4);
  return { notes: strict, candidates };
}

export function analyse(buf, sampleRate) {
  return analyseSpectrum(spectrum(buf), sampleRate);
}

// Average several spectra (taken while the chord rings) for stability.
export function averageSpectra(list) {
  const out = new Float32Array(list[0].length);
  for (const m of list) for (let i = 0; i < out.length; i++) out[i] += m[i] / list.length;
  return out;
}

// ---------------------------------------------------------------------------
// Microphone listener: waits for a strum, then analyses the ringing chord.
// ---------------------------------------------------------------------------
export class ChordListener {
  constructor(onResult, onLevel) {
    this.onResult = onResult; // ({ notes, candidates }) after each strum
    this.onLevel = onLevel; // 'waiting' | 'hearing'
    this.prevRms = 0;
    this.capture = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    src.connect(this.analyser);
    this.buf = new Float32Array(FFT_SIZE);
    this.timer = setInterval(() => this.tick(), 100);
  }

  tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    // Loudness of the most recent ~40 ms, to spot a new strum.
    let rms = 0;
    for (let i = FFT_SIZE - 2048; i < FFT_SIZE; i++) rms += this.buf[i] * this.buf[i];
    rms = Math.sqrt(rms / 2048);
    const now = performance.now();
    if (rms > 0.006 && rms > this.prevRms * 1.8 && !this.capture) {
      this.capture = { t0: now, spectra: [] };
      this.onLevel && this.onLevel('hearing');
    }
    this.prevRms = rms;
    if (this.capture) {
      const dt = now - this.capture.t0;
      // Skip the pick attack, then average ~0.3 s of the ringing chord.
      if (dt >= 250) this.capture.spectra.push(spectrum(this.buf));
      if ((dt >= 550 && this.capture.spectra.length) || this.capture.spectra.length >= 4) {
        const mag = averageSpectra(this.capture.spectra);
        this.capture = null;
        this.onResult(analyseSpectrum(mag, this.ctx.sampleRate));
        this.onLevel && this.onLevel('waiting');
      }
    }
  }

  stop() {
    clearInterval(this.timer);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.capture = null;
  }
}
