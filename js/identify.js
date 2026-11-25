// Chord identification: name a set of notes, listing every sensible reading.
// Mirrors the analysis procedure in Chords on Command: try each note as the
// root, look for 3rds, 5ths and 7ths, allow a missing 5th, and consider
// rootless readings last.
import { TUNING, QUALITIES, parseNote, spellDegree, degreePc, degreeFamily } from './theory.js';
import { inversionName } from './voicings.js';

const PC_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const DEFAULT_DEG = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

// Power chord exists for naming only (it isn't in the voicing library).
const EXTRA = [{ id: '5', name: 'Power chord', symbol: '5', group: 'Other', tones: ['1', '5'] }];
const LIBRARY = [...QUALITIES, ...EXTRA];

export function pitchesFromFrets(frets) {
  return frets.map((f, s) => (f === null || f === undefined ? null : TUNING[s] + f)).filter((p) => p !== null);
}

export function identify(frets) {
  const pitches = pitchesFromFrets(frets);
  if (!pitches.length) return { pitches, pcs: [], bassPc: null, candidates: [] };
  const bass = Math.min(...pitches);
  const bassPc = bass % 12;
  const pcs = [...new Set(pitches.map((p) => p % 12))];
  const candidates = [];
  if (pcs.length >= 2) {
    for (let root = 0; root < 12; root++) {
      for (const q of LIBRARY) {
        const map = new Map(); // pc -> degree token
        for (const t of q.tones) map.set((root + degreePc(t)) % 12, t);
        if (map.size !== q.tones.length) continue;
        if (!pcs.every((pc) => map.has(pc))) continue; // no extra notes allowed
        const missing = q.tones.filter((t) => !pcs.includes((root + degreePc(t)) % 12));
        // Only the natural 5th and (for rootless readings) the root may be missing.
        if (!missing.every((t) => t === '5' || t === '1')) continue;
        const rootless = missing.includes('1');
        if (rootless && (pcs.length < 3 || q.tones.length < 4 || q.tones.includes('#5'))) continue;
        if (missing.length && pcs.length < 3) continue;
        const bassTok = map.get(bassPc);
        const bassIsRoot = bassPc === root;
        let score = 100;
        score -= missing.includes('5') ? 8 : 0;
        score -= rootless ? 28 : 0;
        score -= bassIsRoot ? 0 : 7;
        score -= q.tones.length * 1.5;
        if (q.id === 'alt' || q.voice) score -= 3; // prefer plain names
        const rootName = PC_NAME[root];
        const bassName = spellDegree(rootName, bassTok);
        candidates.push({
          root: rootName,
          quality: q,
          degrees: map,
          missing,
          rootless,
          bassName,
          bassTok,
          slash: !bassIsRoot && !rootless,
          inversion: bassIsRoot ? 'Root position' : rootless ? 'Rootless' : inversionName(q, bassTok),
          score,
        });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // Keep the best reading per (root, quality) and drop near-duplicates.
  const seen = new Set();
  const unique = candidates.filter((c) => {
    const k = `${c.root}|${c.quality.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { pitches, pcs, bassPc, candidates: unique.slice(0, 8) };
}

export function candidateName(c) {
  const base = c.root + c.quality.symbol;
  return c.slash ? `${base}/${c.bassName}` : base;
}

// Degree labels relative to the lowest note (the book's step 1), for when
// nothing matches or as a reference.
export function degreesFromBass(pcs, bassPc) {
  return pcs.map((pc) => DEFAULT_DEG[(pc - bassPc + 12) % 12]);
}

export function defaultDegree(rootPc, pc) {
  return DEFAULT_DEG[(pc - rootPc + 12) % 12];
}

export { PC_NAME, parseNote, degreeFamily };
