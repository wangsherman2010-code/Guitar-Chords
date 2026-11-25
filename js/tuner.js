// Guitar tuner: microphone pitch detection (McLeod pitch method, simplified)
// plus reference tones. Works on HTTPS (or localhost) where the mic is allowed.

export const STRINGS = [
  { name: 'E', label: 'E (6th)', midi: 40 },
  { name: 'A', label: 'A (5th)', midi: 45 },
  { name: 'D', label: 'D (4th)', midi: 50 },
  { name: 'G', label: 'G (3rd)', midi: 55 },
  { name: 'B', label: 'B (2nd)', midi: 59 },
  { name: 'e', label: 'e (1st)', midi: 64 },
];
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (m) => `${NOTE_NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`;

// Normalised square difference function; returns { freq, clarity } or null.
// range = { minFreq, maxFreq } narrows the search (used once we know the string),
// which stops jumps to overtones on the low strings.
export function detectPitch(buf, sampleRate, range = null) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null; // too quiet

  const fMax = range ? range.maxFreq : 1100;
  const fMin = range ? range.minFreq : 65;
  const minLag = Math.max(2, Math.floor(sampleRate / fMax));
  const maxLag = Math.min(Math.ceil(sampleRate / fMin) + 1, Math.floor(n / 2));
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0, m = 0;
    for (let i = 0, end = n - lag; i < end; i++) {
      const a = buf[i], b = buf[i + lag];
      r += a * b;
      m += a * a + b * b;
    }
    nsdf[lag] = m > 0 ? (2 * r) / m : 0;
  }
  if (range) {
    // Narrow search: take the strongest local maximum inside the window.
    let best = -1;
    for (let l = minLag + 1; l < maxLag; l++) {
      if (nsdf[l] > 0 && nsdf[l] >= nsdf[l - 1] && nsdf[l] >= nsdf[l + 1] && (best < 0 || nsdf[l] > nsdf[best])) best = l;
    }
    if (best < 0) return null;
    return refine(nsdf, best, sampleRate);
  }
  // Key maxima: highest point of each positive region after the first dip below zero.
  const peaks = [];
  let lag = minLag;
  while (lag < maxLag && nsdf[lag] > 0) lag++;
  while (lag < maxLag) {
    while (lag < maxLag && nsdf[lag] <= 0) lag++;
    let best = lag;
    while (lag < maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > nsdf[best]) best = lag;
      lag++;
    }
    if (best < maxLag && nsdf[best] > 0) peaks.push(best);
  }
  if (!peaks.length) return null;
  const top = Math.max(...peaks.map((p) => nsdf[p]));
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * top);
  return refine(nsdf, chosen, sampleRate);
}

// Parabolic interpolation for sub-sample accuracy.
function refine(nsdf, i, sampleRate) {
  const y0 = nsdf[i - 1] ?? nsdf[i], y1 = nsdf[i], y2 = nsdf[i + 1] ?? nsdf[i];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom ? (0.5 * (y0 - y2)) / denom : 0;
  const period = i + Math.max(-1, Math.min(1, shift));
  return { freq: sampleRate / period, clarity: y1 };
}

// Search window around a string: ±5 semitones.
export function rangeAround(midi) {
  return { minFreq: midiToFreq(midi - 5), maxFreq: midiToFreq(midi + 5) };
}

// Halve the sample rate (average pairs = gentle low-pass), so a longer window
// costs no more CPU. Guitar fundamentals are far below the new Nyquist.
export function decimate2(src, dst) {
  for (let i = 0, j = 0; j < dst.length; i += 2, j++) dst[j] = 0.5 * (src[i] + src[i + 1]);
  return dst;
}

export class Tuner {
  constructor(onReading) {
    this.onReading = onReading; // ({ freq, midi } | null)
    this.history = [];
    this.lastHeard = 0;
    this.lockMidi = null; // string chosen by the user
    this.focusMidi = null; // string found automatically
    this.streak = { midi: null, count: 0 };
  }

  setLock(midi) {
    this.lockMidi = midi;
    this.focusMidi = null;
    this.history = [];
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const hp = this.ctx.createBiquadFilter(); // remove rumble below the low E
    hp.type = 'highpass';
    hp.frequency.value = 55;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192; // ~170 ms: several cycles even for the low E
    src.connect(hp).connect(this.analyser);
    this.raw = new Float32Array(this.analyser.fftSize);
    this.buf = new Float32Array(this.analyser.fftSize / 2);
    this.timer = setInterval(() => this.tick(), 70);
  }

  nearestString(midi) {
    let best = STRINGS[0].midi;
    for (const st of STRINGS) if (Math.abs(midi - st.midi) < Math.abs(midi - best)) best = st.midi;
    return best;
  }

  tick() {
    this.analyser.getFloatTimeDomainData(this.raw);
    decimate2(this.raw, this.buf);
    const sr = this.ctx.sampleRate / 2;
    const target = this.lockMidi ?? this.focusMidi;
    const r = detectPitch(this.buf, sr, target !== null ? rangeAround(target) : null);
    const now = performance.now();
    const minClarity = target !== null ? 0.8 : 0.9;
    if (r && r.clarity > minClarity && r.freq > 60 && r.freq < 1100) {
      const midi = freqToMidi(r.freq);
      // Auto mode: after 3 readings on the same string, stay focused on it.
      if (this.lockMidi === null && this.focusMidi === null) {
        const s = this.nearestString(midi);
        this.streak = this.streak.midi === s ? { midi: s, count: this.streak.count + 1 } : { midi: s, count: 1 };
        if (this.streak.count >= 3) { this.focusMidi = s; this.history = []; }
      }
      this.history.push(r.freq);
      if (this.history.length > 7) this.history.shift();
      const sorted = [...this.history].sort((a, b) => a - b);
      const freq = sorted[Math.floor(sorted.length / 2)]; // median: steadier needle
      this.lastHeard = now;
      this.onReading({ freq, midi: freqToMidi(freq) });
    } else if (now - this.lastHeard > 700) {
      // Quiet: forget the focus so the next string is found fresh.
      this.history = [];
      this.focusMidi = null;
      this.streak = { midi: null, count: 0 };
      this.onReading(null);
    }
  }

  stop() {
    clearInterval(this.timer);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.history = [];
    this.focusMidi = null;
  }
}
