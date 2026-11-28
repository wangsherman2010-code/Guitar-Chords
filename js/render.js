// SVG rendering: chord diagrams, full fretboard map, and ASCII tab.
import { TUNING, degreeFamily, degreeLabel, spellDegree, parseNote, degreePc, STRING_NAMES } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

const shortNote = (n) => n.replace(/#/g, '♯').replace(/b/g, '♭');

function dotLabel(root, degree, mode) {
  return mode === 'note' ? shortNote(spellDegree(root, degree)) : degreeLabel(degree);
}

// ---------------------------------------------------------------------------
// Vertical chord diagram (like the exercise books): strings 6 → 1 left to right.
// ---------------------------------------------------------------------------
export function chordDiagram(v, root, mode = 'degree') {
  const W = 144, H = 190;
  const left = 36, top = 34, gap = 18, fretH = 26, frets = 5;
  const fretted = v.frets.filter((f) => f !== null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const start = maxF <= frets ? 1 : minF;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram', role: 'img' });
  svg.setAttribute('aria-label', `Chord diagram, frets ${v.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`);

  // Nut or fret number
  if (start === 1) {
    svg.append(el('rect', { x: left - 1, y: top - 4, width: gap * 5 + 2, height: 4, class: 'nut' }));
  } else {
    svg.append(el('text', { x: left - 11, y: top + fretH / 2 + 4, class: 'fretnum', 'text-anchor': 'end' }, `${start}fr`));
  }
  for (let i = 0; i <= frets; i++) {
    svg.append(el('line', { x1: left, x2: left + gap * 5, y1: top + i * fretH, y2: top + i * fretH, class: 'fret' }));
  }
  for (let s = 0; s < 6; s++) {
    svg.append(el('line', { x1: left + s * gap, x2: left + s * gap, y1: top, y2: top + frets * fretH, class: 'string' }));
  }
  for (let s = 0; s < 6; s++) {
    const x = left + s * gap;
    const f = v.frets[s];
    const d = v.degrees[s];
    if (f === null) {
      svg.append(el('text', { x, y: top - 10, class: 'mute', 'text-anchor': 'middle' }, '×'));
      continue;
    }
    const fam = degreeFamily(d);
    if (f === 0) {
      svg.append(el('circle', { cx: x, cy: top - 14, r: 6, class: `open deg-${fam}` }));
    } else {
      const y = top + (f - start + 0.5) * fretH;
      svg.append(el('circle', { cx: x, cy: y, r: 8.5, class: `dot deg-${fam}` }));
      const lab = dotLabel(root, d, mode);
      svg.append(el('text', { x, y: y + 3.6, class: `dottext ink-${fam}${lab.length > 2 ? ' small' : ''}`, 'text-anchor': 'middle' }, lab));
    }
    // Label under the string (the other naming, like the book's R 5 7 3 row)
    const under = mode === 'note' ? degreeLabel(d) : shortNote(spellDegree(root, d));
    svg.append(el('text', { x, y: top + frets * fretH + 16, class: `under deg-${fam}-text`, 'text-anchor': 'middle' }, under));
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Horizontal fretboard map with every chord tone (and optional scale overlay).
// ---------------------------------------------------------------------------
export function fretboard({ root, tones, hidden = new Set(), mode = 'degree', voicing = null, scale = null, frets = 15, lefty = false, onlyStrings = null, window: win = null }) {
  const left = 58, top = 18, fw = 52, sh = 26;
  const W = left + fw * (frets + 0.6) + 10;
  const H = top + sh * 5 + 34;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'board', role: 'img', 'aria-label': 'Fretboard map' });
  const xAt = (f) => {
    const x = f === 0 ? left - 17 : left + (f - 0.5) * fw;
    return lefty ? W - x : x;
  };
  const yAt = (s) => top + (5 - s) * sh; // high e on top

  const g = el('g');
  svg.append(g);
  // inlays
  for (const f of [3, 5, 7, 9, 15]) if (f <= frets) g.append(el('circle', { cx: xAt(f), cy: top + sh * 2.5, r: 5, class: 'inlay' }));
  if (frets >= 12) {
    g.append(el('circle', { cx: xAt(12), cy: top + sh * 1.5, r: 5, class: 'inlay' }));
    g.append(el('circle', { cx: xAt(12), cy: top + sh * 3.5, r: 5, class: 'inlay' }));
  }
  // frets
  for (let f = 0; f <= frets; f++) {
    const x = lefty ? W - (left + f * fw) : left + f * fw;
    g.append(el('line', { x1: x, x2: x, y1: top, y2: top + sh * 5, class: f === 0 ? 'nutline' : 'fret' }));
    if (f > 0) g.append(el('text', { x: xAt(f), y: top + sh * 5 + 22, class: 'fretnum', 'text-anchor': 'middle' }, f));
  }
  for (let s = 0; s < 6; s++) {
    g.append(el('line', { x1: lefty ? W - left : left, x2: lefty ? W - (left + fw * frets) : left + fw * frets, y1: yAt(s), y2: yAt(s), class: 'string', 'stroke-width': 0.8 + (5 - s) * 0.25 }));
    g.append(el('text', { x: lefty ? W - 8 : 8, y: yAt(s) + 4, class: 'strname', 'text-anchor': lefty ? 'end' : 'start' }, STRING_NAMES[s]));
  }

  const rootPc = parseNote(root).pc;
  const byPc = new Map();
  for (const t of tones) byPc.set((rootPc + degreePc(t)) % 12, t);
  const scaleByPc = new Map();
  if (scale) for (const t of scale) scaleByPc.set((rootPc + degreePc(t)) % 12, t);

  const inVoicing = (s, f) => voicing && voicing.frets[s] === f;

  // Highlight a hand position (fret window) for lessons.
  if (win) {
    const x1 = xAt(win[0]) - fw / 2, x2 = xAt(win[1]) + fw / 2;
    g.insertBefore(el('rect', { x: Math.min(x1, x2), y: top - 12, width: Math.abs(x2 - x1), height: sh * 5 + 24, rx: 8, class: 'poswin' }), g.firstChild);
  }
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= frets; f++) {
      if (onlyStrings && !onlyStrings.includes(s)) continue;
      if (win && (f < win[0] || f > win[1])) continue;
      const pc = (TUNING[s] + f) % 12;
      const t = byPc.get(pc);
      const x = xAt(f), y = yAt(s);
      if (t && !hidden.has(t)) {
        const fam = degreeFamily(t);
        const active = inVoicing(s, f);
        const dim = voicing && !active;
        const grp = el('g', { class: `tone${dim ? ' faded' : ''}${active ? ' active' : ''}`, 'data-s': s, 'data-f': f });
        grp.append(el('circle', { cx: x, cy: y, r: active ? 11.5 : 10, class: `dot deg-${fam}` }));
        const lab = dotLabel(root, t, mode);
        grp.append(el('text', { x, y: y + 4, class: `dottext ink-${fam}${lab.length > 2 ? ' small' : ''}`, 'text-anchor': 'middle' }, lab));
        g.append(grp);
      } else if (scaleByPc.has(pc)) {
        const st = scaleByPc.get(pc);
        const grp = el('g', { class: 'tone ghost', 'data-s': s, 'data-f': f });
        grp.append(el('circle', { cx: x, cy: y, r: 8, class: 'ghostdot' }));
        grp.append(el('text', { x, y: y + 3.5, class: 'ghosttext', 'text-anchor': 'middle' }, mode === 'note' ? shortNote(spellDegree(root, st)) : st));
        g.append(grp);
      }
    }
  }
  return svg;
}

// ---------------------------------------------------------------------------
// ASCII tab. Accepts one voicing or a sequence.
// ---------------------------------------------------------------------------
export function tab(voicings, { labels = null } = {}) {
  const list = Array.isArray(voicings) ? voicings : [voicings];
  const names = ['e', 'B', 'G', 'D', 'A', 'E'];
  const lines = names.map((n) => `${n}|-`);
  let header = '   ';
  list.forEach((v, i) => {
    const cells = [5, 4, 3, 2, 1, 0].map((s) => (v.frets[s] === null ? '-' : String(v.frets[s])));
    const w = Math.max(...cells.map((c) => c.length), labels ? (labels[i] || '').length : 0);
    cells.forEach((c, li) => { lines[li] += c.padEnd(w, '-') + '---'; });
    if (labels) header += (labels[i] || '').padEnd(w + 3, ' ');
  });
  const body = lines.map((l) => l + '|').join('\n');
  return labels ? `${header.trimEnd()}\n${body}` : body;
}

// ---------------------------------------------------------------------------
// Editable chord diagram for the Finder (big touch targets).
// marks[s] = { label, fam } for strings that sound.
// ---------------------------------------------------------------------------
export function finderDiagram(frets, start, marks, nFrets = 6) {
  const gap = 46, fretH = 50, left = 56, top = 64;
  const W = left * 2 + gap * 5, H = top + fretH * nFrets + 34;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fdiagram', role: 'img', 'aria-label': 'Editable chord diagram' });
  if (start === 1) svg.append(el('rect', { x: left - 2, y: top - 6, width: gap * 5 + 4, height: 6, class: 'nut' }));
  for (let i = 0; i <= nFrets; i++) svg.append(el('line', { x1: left, x2: left + gap * 5, y1: top + i * fretH, y2: top + i * fretH, class: 'fret' }));
  for (let i = 0; i < nFrets; i++) {
    svg.append(el('text', { x: left - 24, y: top + (i + 0.5) * fretH + 5, class: 'fretnum', 'text-anchor': 'end' }, String(start + i)));
  }
  for (let s = 0; s < 6; s++) svg.append(el('line', { x1: left + s * gap, x2: left + s * gap, y1: top, y2: top + fretH * nFrets, class: 'string' }));
  for (let s = 0; s < 6; s++) {
    const x = left + s * gap;
    svg.append(el('text', { x, y: top + fretH * nFrets + 24, class: 'strname', 'text-anchor': 'middle' }, STRING_NAMES[s]));
    // open / muted marker row (tap target)
    const f = frets[s];
    const openHit = el('rect', { x: x - gap / 2, y: 4, width: gap, height: top - 12, class: 'hit', 'data-s': s, 'data-f': 0 });
    svg.append(openHit);
    if (f === 0) {
      const m = marks[s];
      svg.append(el('circle', { cx: x, cy: top - 30, r: 15, class: `open deg-${m.fam}`, 'pointer-events': 'none' }));
      svg.append(el('text', { x, y: top - 25, class: `openlabel deg-${m.fam}-text`, 'text-anchor': 'middle', 'pointer-events': 'none' }, m.label));
    } else if (f === null) {
      svg.append(el('text', { x, y: top - 22, class: 'mute big', 'text-anchor': 'middle', 'pointer-events': 'none' }, '×'));
    } else {
      svg.append(el('circle', { cx: x, cy: top - 30, r: 9, class: 'openhint', 'pointer-events': 'none' }));
    }
    // fret cells (tap targets)
    for (let i = 0; i < nFrets; i++) {
      const fr = start + i;
      svg.append(el('rect', { x: x - gap / 2, y: top + i * fretH, width: gap, height: fretH, class: 'hit', 'data-s': s, 'data-f': fr }));
      if (f === fr) {
        const m = marks[s];
        const cy = top + (i + 0.5) * fretH;
        svg.append(el('circle', { cx: x, cy, r: 17, class: `dot deg-${m.fam}`, 'pointer-events': 'none' }));
        svg.append(el('text', { x, y: cy + 5, class: `dottext big ink-${m.fam}`, 'text-anchor': 'middle', 'pointer-events': 'none' }, m.label));
      }
    }
  }
  // Note above/below the window: show an arrow so it isn't lost.
  for (let s = 0; s < 6; s++) {
    const f = frets[s];
    if (f && (f < start || f >= start + nFrets)) {
      const x = left + s * gap;
      const below = f >= start + nFrets;
      svg.append(el('text', { x, y: below ? top + fretH * nFrets - 6 : top + 16, class: 'offwin', 'text-anchor': 'middle', 'pointer-events': 'none' }, `${below ? '▼' : '▲'}${f}`));
    }
  }
  return svg;
}
