// Backing tracks for the Tutor: loops a progression with bass and comping.
import { voiceLead } from './voicings.js';
import { parseChordSymbol, parseNote, degreePc } from './theory.js';
import { audioTime, playNoteAt, clickAt, prepare } from './audio.js';

// Bass note in a comfortable low range (E2..D#3).
function bassMidi(pc) { return 40 + ((pc - 4 + 12) % 12); }

export function parseProgression(list) {
  // list: ['Dm7', 'G7', ['Cmaj7', 2]] → [{ symbol, root, quality, bars }]
  return list.map((it) => {
    const [sym, bars] = Array.isArray(it) ? it : [it, 1];
    const c = parseChordSymbol(sym);
    return { symbol: sym, root: c.root, quality: c.quality, bars };
  });
}

export class Backing {
  constructor({ onChord, onBeat } = {}) {
    this.onChord = onChord; // (index) when a chord starts
    this.onBeat = onBeat; // (beatInBar)
    this.timer = null;
    this.timeouts = [];
  }

  get running() { return this.timer !== null; }

  async start(progression, { bpm = 80, style = 'four', groups = ['b5', 'b4'], startFret = 5, countIn = true } = {}) {
    this.stop();
    this.prog = progression;
    this.bpm = bpm;
    this.style = style;
    const path = voiceLead(progression.map((c) => ({ root: c.root, quality: c.quality })), groups, { startFret }) || [];
    this.voicings = path;
    await prepare([...new Set(path.flatMap((v) => v.pitches))]);
    const beat = 60 / bpm;
    this.beat = beat;
    // Build one loop of events: [{ t (beats from loop start), kind, ... }]
    const ev = [];
    let t = 0;
    progression.forEach((c, i) => {
      const v = path[i];
      const rootPc = parseNote(c.root).pc;
      const fifthPc = (rootPc + degreePc(c.quality.tones.find((x) => /5$/.test(x)) || '5')) % 12;
      ev.push({ t, kind: 'chordStart', i });
      for (let bar = 0; bar < c.bars; bar++) {
        const b0 = t + bar * 4;
        // Bass: root on 1, fifth on 3 ("two feel").
        ev.push({ t: b0, kind: 'bass', midi: bassMidi(rootPc) });
        ev.push({ t: b0 + 2, kind: 'bass', midi: bassMidi(fifthPc) });
        for (let k = 0; k < 4; k++) ev.push({ t: b0 + k, kind: 'beat', k });
        if (!v) continue;
        if (style === 'four') { // Freddie Green: short, light strum on every beat
          for (let k = 0; k < 4; k++) ev.push({ t: b0 + k, kind: 'chord', pitches: v.pitches, gain: k % 2 ? 0.32 : 0.4, dur: beat * 0.6 });
        } else if (style === 'charleston') { // hits on 1 and the "and" of 2
          ev.push({ t: b0, kind: 'chord', pitches: v.pitches, gain: 0.45, dur: beat * 0.5 });
          ev.push({ t: b0 + 1.5, kind: 'chord', pitches: v.pitches, gain: 0.42, dur: beat * 0.9 });
        } else { // 'whole': let it ring
          ev.push({ t: b0, kind: 'chord', pitches: v.pitches, gain: 0.45, dur: beat * 3.8 });
        }
      }
      t += c.bars * 4;
    });
    this.loopBeats = t;
    this.events = ev.sort((a, b) => a.t - b.t);
    const now = audioTime() + 0.1;
    this.countInBeats = countIn ? 4 : 0;
    for (let k = 0; k < this.countInBeats; k++) clickAt(now + k * beat, k === 0);
    this.t0 = now + this.countInBeats * beat; // time of loop start
    this.loop = 0;
    this.idx = 0;
    this.timer = setInterval(() => this.schedule(), 30);
    this.schedule();
  }

  schedule() {
    const horizon = audioTime() + 0.2;
    for (;;) {
      const e = this.events[this.idx];
      const when = this.t0 + (this.loop * this.loopBeats + e.t) * this.beat;
      if (when > horizon) break;
      const delay = Math.max(0, (when - audioTime()) * 1000);
      if (e.kind === 'bass') playNoteAt(e.midi, when, 0.75, this.beat * 1.9);
      else if (e.kind === 'chord') e.pitches.forEach((p, j) => playNoteAt(p, when + j * 0.012, e.gain, e.dur));
      else if (e.kind === 'beat') {
        if (e.k % 2 === 1) clickAt(when);
        if (this.onBeat) this.timeouts.push(setTimeout(() => this.onBeat(e.k), delay));
      } else if (e.kind === 'chordStart' && this.onChord) this.timeouts.push(setTimeout(() => this.onChord(e.i), delay));
      this.idx++;
      if (this.idx >= this.events.length) { this.idx = 0; this.loop++; }
    }
    if (this.timeouts.length > 200) this.timeouts = this.timeouts.slice(-50);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
  }
}
