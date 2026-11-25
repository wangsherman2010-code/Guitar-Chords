// Voicing engine: builds playable chord shapes on string sets from chord tones.
import { TUNING, parseNote, degreePc, degreeFamily, parseDegree, voiceTones, stringNumber } from './theory.js';

export const MAX_FRET = 15;

// String index: 0 = 6th (low E) ... 5 = 1st (high e)
const set = (...nums) => nums.map((n) => 6 - n);
const setName = (strings) => strings.map(stringNumber).join('-');

// Voicing families. "book" mirrors Jazz Comping Mastery 1:
// 6th-string bass = drop 3, 5th- and 4th-string bass = drop 2.
export const FAMILIES = {
  book: {
    name: 'Jazz Comping (book shapes)',
    needs: 4,
    groups: [
      { id: 'b6', name: '6th-string bass · Drop 3', short: '6th string', strings: set(6, 4, 3, 2), kind: 'drop3' },
      { id: 'b5', name: '5th-string bass · Drop 2', short: '5th string', strings: set(5, 4, 3, 2), kind: 'drop2' },
      { id: 'b4', name: '4th-string bass · Drop 2', short: '4th string', strings: set(4, 3, 2, 1), kind: 'drop2' },
    ],
  },
  drop2: {
    name: 'Drop 2 (all string sets)',
    needs: 4,
    groups: [
      { id: 'd2-6', name: 'Drop 2 · strings 6-5-4-3', short: '6543', strings: set(6, 5, 4, 3), kind: 'drop2' },
      { id: 'd2-5', name: 'Drop 2 · strings 5-4-3-2', short: '5432', strings: set(5, 4, 3, 2), kind: 'drop2' },
      { id: 'd2-4', name: 'Drop 2 · strings 4-3-2-1', short: '4321', strings: set(4, 3, 2, 1), kind: 'drop2' },
    ],
  },
  drop3: {
    name: 'Drop 3 (all string sets)',
    needs: 4,
    groups: [
      { id: 'd3-6', name: 'Drop 3 · strings 6-4-3-2', short: '6432', strings: set(6, 4, 3, 2), kind: 'drop3' },
      { id: 'd3-5', name: 'Drop 3 · strings 5-3-2-1', short: '5321', strings: set(5, 3, 2, 1), kind: 'drop3' },
    ],
  },
  shell: {
    name: 'Shell voicings (R · 3 · 7)',
    needs: 4,
    groups: [
      { id: 'sh-6', name: 'Shells · 6th-string root', short: '6th string', strings: set(6, 4, 3), kind: 'shell' },
      { id: 'sh-5', name: 'Shells · 5th-string root', short: '5th string', strings: set(5, 4, 3), kind: 'shell' },
    ],
  },
  caged: {
    name: '5 template shapes (C-A-G-E-D)',
    needs: 'template',
    groups: [
      { id: 'caged', name: 'Five chord-shape templates, altered to this chord', short: 'templates', strings: [0, 1, 2, 3, 4, 5], kind: 'caged' },
    ],
  },
  triads: {
    name: 'Triads (close, 3 adjacent strings)',
    needs: 3,
    groups: [
      { id: 't-6', name: 'Triads · strings 6-5-4', short: '654', strings: set(6, 5, 4), kind: 'close' },
      { id: 't-5', name: 'Triads · strings 5-4-3', short: '543', strings: set(5, 4, 3), kind: 'close' },
      { id: 't-4', name: 'Triads · strings 4-3-2', short: '432', strings: set(4, 3, 2), kind: 'close' },
      { id: 't-3', name: 'Triads · strings 3-2-1', short: '321', strings: set(3, 2, 1), kind: 'close' },
    ],
  },
};

export function familiesFor(quality) {
  const n = voiceTones(quality).length;
  return Object.entries(FAMILIES)
    .filter(([id, f]) => (f.needs === 'template' ? templateOk(quality) : f.needs === n) && (id !== 'shell' || shellTones(quality)))
    .map(([id, f]) => ({ id, ...f }));
}

export function groupById(id) {
  for (const f of Object.values(FAMILIES)) {
    const g = f.groups.find((x) => x.id === id);
    if (g) return g;
  }
  return null;
}

const relPc = (t) => degreePc(t);

// Close-position order of the voicing tones (sorted by pitch above the root).
function closeOrder(tones) {
  return [...tones].sort((a, b) => relPc(a) - relPc(b));
}

function shellTones(q) {
  const tones = q.tones;
  if (!tones.includes('1')) return null;
  const third = tones.find((t) => degreeFamily(t) === 'third') || tones.find((t) => ['4', '2'].includes(t));
  const seventh = tones.find((t) => degreeFamily(t) === 'seventh') || tones.find((t) => t === '6');
  if (!third || !seventh) return null;
  return { third, seventh };
}

// ---------------------------------------------------------------------------
// Template shapes (Chords on Command, Exercise Series 6): the five open-chord
// shapes, made movable, then "manipulated" into the selected chord quality.
// ---------------------------------------------------------------------------
const TEMPLATES = [
  { name: 'C shape', rootPc: 0, frets: [null, 3, 2, 0, 1, 0] },
  { name: 'A shape', rootPc: 9, frets: [null, 0, 2, 2, 2, 0] },
  { name: 'G shape', rootPc: 7, frets: [3, 2, 0, 0, 0, 3] },
  { name: 'E shape', rootPc: 4, frets: [0, 2, 2, 1, 0, 0] },
  { name: 'D shape', rootPc: 2, frets: [null, null, 0, 2, 3, 2] },
];

function chordRoles(q) {
  const t = q.tones;
  return {
    third: t.find((x) => degreeFamily(x) === 'third') || t.find((x) => x === '4' || x === '2'),
    fifth: t.find((x) => degreeFamily(x) === 'fifth'),
    seventh: t.find((x) => degreeFamily(x) === 'seventh') || t.find((x) => x === '6'),
  };
}

function templateOk(q) {
  if (q.voice || q.tones.length > 4 || !q.tones.includes('1')) return false;
  if (q.tones.some((t) => degreeFamily(t) === 'ext')) return false;
  const r = chordRoles(q);
  return Boolean(r.third && r.fifth) && (q.tones.length === 3 || Boolean(r.seventh));
}

function semis(t) { return parseDegree(t).semis; }

function buildTemplates(rootName, quality, group, maxSpan) {
  const rootPc = parseNote(rootName).pc;
  const roles = chordRoles(quality);
  const out = [];
  for (const tpl of TEMPLATES) {
    const shift = (rootPc - tpl.rootPc + 12) % 12;
    for (const base of [shift - 12, shift, shift + 12]) {
      const frets = tpl.frets.map((f) => (f === null ? null : f + base));
      const degs = frets.map((f, s) => {
        if (f === null) return null;
        const rel = (((TUNING[s] + f - rootPc) % 12) + 12) % 12;
        return rel === 0 ? '1' : rel === 4 ? '3' : '5';
      });
      // Manipulate 3 and 5 into this chord's third and fifth.
      degs.forEach((d, s) => {
        if (d === '3') { frets[s] += semis(roles.third) - 4; degs[s] = roles.third; }
        if (d === '5') { frets[s] += semis(roles.fifth) - 7; degs[s] = roles.fifth; }
      });
      // Add the 7th (or 6th) by lowering the highest doubled root.
      if (quality.tones.length === 4) {
        const played = frets.map((f, s) => (f === null ? null : { s, p: TUNING[s] + f })).filter(Boolean);
        const lowest = Math.min(...played.map((x) => x.p));
        const roots = played.filter((x) => degs[x.s] === '1' && x.p !== lowest).sort((a, b) => b.p - a.p);
        if (!roots.length) continue;
        const s = roots[0].s;
        frets[s] += semis(roles.seventh) - 12;
        degs[s] = roles.seventh;
      }
      const used = frets.filter((f) => f !== null);
      if (Math.min(...used) < 0 || Math.max(...used) > MAX_FRET) continue;
      const fretted = used.filter((f) => f > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      if (span > maxSpan) continue;
      const strings = frets.map((f, s) => (f === null ? null : s)).filter((s) => s !== null);
      out.push({ frets, degrees: degs, strings, name: tpl.name });
    }
  }
  return out;
}

// Orders (bass first) of tones for a given voicing kind.
function orderings(quality, kind) {
  const tones = voiceTones(quality);
  if (kind === 'shell') {
    const s = shellTones(quality);
    return s ? [['1', s.seventh, s.third], ['1', s.third, s.seventh]] : [];
  }
  const c = closeOrder(tones);
  const n = c.length;
  const pick = (idxs) => idxs.map((i) => c[i % n]);
  const out = [];
  for (let b = 0; b < n; b++) {
    if (kind === 'close') out.push(pick([b, b + 1, b + 2]));
    if (kind === 'drop2') out.push(pick([b, b + 2, b + 3, b + 1]));
    if (kind === 'drop3') out.push(pick([b, b + 3, b + 1, b + 2]));
  }
  return out;
}

const INV_NAMES = ['Root position', '1st inversion', '2nd inversion', '3rd inversion'];

// Index used for the inversion filter (0 = root in bass, 1 = 3rd, 2 = 5th, 3 = 7th).
export function inversionIndex(quality, bass) {
  if (bass === '1') return 0;
  const fam = degreeFamily(bass);
  if (fam === 'third' || bass === '4' || bass === '2') return 1;
  if (fam === 'fifth') return 2;
  if (fam === 'seventh' || fam === 'sixth') return 3;
  return 4; // extension in bass
}

export function inversionName(quality, bass) {
  const i = inversionIndex(quality, bass);
  if (i === 4 || (quality.voice && i !== 0)) return `${bass.replace('b', '♭').replace('#', '♯')} in bass`;
  return INV_NAMES[i];
}

// Build all positions of one ordering on one string set.
function place(rootPc, order, strings, maxSpan) {
  const results = [];
  const bassPc = (rootPc + relPc(order[0])) % 12;
  const s0 = strings[0];
  for (let f = 0; f <= MAX_FRET; f++) {
    if ((TUNING[s0] + f) % 12 !== bassPc) continue;
    const pitches = [TUNING[s0] + f];
    const frets = [f];
    let ok = true;
    for (let i = 1; i < order.length; i++) {
      const pc = (rootPc + relPc(order[i])) % 12;
      let p = pitches[i - 1] + 1;
      while (p % 12 !== pc) p++;
      const fret = p - TUNING[strings[i]];
      if (fret < 0 || fret > MAX_FRET) { ok = false; break; }
      pitches.push(p);
      frets.push(fret);
    }
    if (!ok) continue;
    const fretted = frets.filter((x) => x > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > maxSpan) continue;
    results.push({ frets, pitches });
  }
  return results;
}

export function buildGroup(rootName, quality, group, { maxSpan = 4 } = {}) {
  const rootPc = parseNote(rootName).pc;
  const voicings = [];
  if (group.kind === 'caged') {
    for (const t of buildTemplates(rootName, quality, group, maxSpan)) {
      const pitches = t.strings.map((s) => TUNING[s] + t.frets[s]);
      const fretted = t.strings.map((s) => t.frets[s]).filter((x) => x > 0);
      const bass = t.degrees[t.strings[0]];
      voicings.push({
        key: `caged:${t.frets.map((x) => (x === null ? 'x' : x)).join('.')}`,
        groupId: group.id,
        frets: t.frets,
        degrees: t.degrees,
        pitches,
        bass,
        inversion: inversionIndex(quality, bass),
        inversionName: t.name,
        minFret: fretted.length ? Math.min(...fretted) : 0,
        maxFret: Math.max(...t.strings.map((s) => t.frets[s])),
        avgFret: t.strings.reduce((a, s) => a + t.frets[s], 0) / t.strings.length,
      });
    }
    voicings.sort((a, b) => a.minFret - b.minFret);
    return voicings;
  }
  for (const order of orderings(quality, group.kind)) {
    for (const { frets, pitches } of place(rootPc, order, group.strings, maxSpan)) {
      const f6 = Array(6).fill(null);
      const d6 = Array(6).fill(null);
      group.strings.forEach((s, i) => { f6[s] = frets[i]; d6[s] = order[i]; });
      const fretted = frets.filter((x) => x > 0);
      voicings.push({
        key: `${group.id}:${f6.map((x) => (x === null ? 'x' : x)).join('.')}`,
        groupId: group.id,
        frets: f6,
        degrees: d6,
        pitches,
        bass: order[0],
        inversion: inversionIndex(quality, order[0]),
        inversionName: group.kind === 'shell' ? `R–${order[1]}–${order[2]}`.replace(/b/g, '♭') : inversionName(quality, order[0]),
        minFret: fretted.length ? Math.min(...fretted) : 0,
        maxFret: Math.max(...frets),
        avgFret: frets.reduce((a, b) => a + b, 0) / frets.length,
      });
    }
  }
  // Sort by inversion, then by neck position.
  voicings.sort((a, b) => a.inversion - b.inversion || a.minFret - b.minFret);
  return voicings;
}

export function setLabel(strings) {
  return setName(strings);
}

// ---------------------------------------------------------------------------
// Voice leading: choose one voicing per chord minimising total movement
// (Jazz Comping Mastery 1, lessons 24–25: move each voice by the smallest step).
// ---------------------------------------------------------------------------
function moveCost(a, b) {
  // Average nearest-neighbour distance in semitones, both directions.
  const near = (p, set) => Math.min(...set.map((q) => Math.abs(p - q)));
  const ab = a.pitches.reduce((s, p) => s + near(p, b.pitches), 0) / a.pitches.length;
  const ba = b.pitches.reduce((s, p) => s + near(p, a.pitches), 0) / b.pitches.length;
  const pos = Math.abs(a.avgFret - b.avgFret) * 0.35;
  const stringChange = a.groupId === b.groupId ? 0 : 0.6;
  return ab + ba + pos + stringChange;
}

export function voiceLead(chords, groupIds, { startFret = 5 } = {}) {
  // chords: [{root, quality}] ; returns array of voicings (or null when none).
  const cands = chords.map(({ root, quality }) => {
    const n = voiceTones(quality).length;
    let groups = groupIds.map(groupById).filter(Boolean);
    if (n === 3) groups = FAMILIES.triads.groups; // triads use triad sets
    const list = groups.flatMap((g) => buildGroup(root, quality, g));
    return list;
  });
  if (cands.some((c) => c.length === 0)) return null;
  // Viterbi
  let cost = cands[0].map((v) => Math.abs(v.avgFret - startFret) * 0.5);
  const back = [];
  for (let i = 1; i < cands.length; i++) {
    const nc = [];
    const bk = [];
    for (const v of cands[i]) {
      let best = Infinity;
      let arg = 0;
      cands[i - 1].forEach((u, j) => {
        const c = cost[j] + moveCost(u, v);
        if (c < best) { best = c; arg = j; }
      });
      nc.push(best);
      bk.push(arg);
    }
    cost = nc;
    back.push(bk);
  }
  let idx = cost.indexOf(Math.min(...cost));
  const path = [cands[cands.length - 1][idx]];
  for (let i = back.length - 1; i >= 0; i--) {
    idx = back[i][idx];
    path.unshift(cands[i][idx]);
  }
  return path;
}

// Which voices moved and by how much (for annotation).
export function movement(a, b) {
  return b.pitches.map((p) => Math.min(...a.pitches.map((q) => Math.abs(p - q))));
}

export { parseDegree };
