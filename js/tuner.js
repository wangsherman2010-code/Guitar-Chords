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
export function detectPitch(buf, sampleRate) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null; // too quiet

  const minLag = Math.floor(sampleRate / 1100); // ~1100 Hz max
  const maxLag = Math.min(Math.floor(sampleRate / 65), Math.floor(n / 2)); // ~65 Hz min (below low E)
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
  // Parabolic interpolation for sub-sample accuracy.
  const y0 = nsdf[chosen - 1] ?? nsdf[chosen], y1 = nsdf[chosen], y2 = nsdf[chosen + 1] ?? nsdf[chosen];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom ? (0.5 * (y0 - y2)) / denom : 0;
  const period = chosen + Math.max(-1, Math.min(1, shift));
  return { freq: sampleRate / period, clarity: y1 };
}

export class Tuner {
  constructor(onReading) {
    this.onReading = onReading; // ({ freq, midi } | null)
    this.history = [];
    this.lastHeard = 0;
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
    hp.frequency.value = 60;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    src.connect(hp).connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.timer = setInterval(() => this.tick(), 60);
  }

  tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const r = detectPitch(this.buf, this.ctx.sampleRate);
    const now = performance.now();
    if (r && r.clarity > 0.85 && r.freq > 60 && r.freq < 1100) {
      this.history.push(r.freq);
      if (this.history.length > 5) this.history.shift();
      const sorted = [...this.history].sort((a, b) => a - b);
      const freq = sorted[Math.floor(sorted.length / 2)]; // median: steadier needle
      this.lastHeard = now;
      this.onReading({ freq, midi: freqToMidi(freq) });
    } else if (now - this.lastHeard > 700) {
      this.history = [];
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
  }
}
