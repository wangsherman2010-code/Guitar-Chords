import {
  ROOTS, QUALITIES, QUALITY_BY_ID, CYCLE_QUALITIES, PRACTICE_ROOTS, MAJOR_SCALE,
  spellChord, chordSymbol, degreeFamily, degreeLabel, parseNote, degreeSemis, parseChordSymbol, voiceTones,
} from './theory.js';
import { familiesFor, buildGroup, groupById, voiceLead, movement, FAMILIES } from './voicings.js';
import { chordDiagram, fretboard, tab } from './render.js';
import { strum, arpeggio, intervalDrill, note, Metronome, INSTRUMENTS, setInstrument, preload } from './audio.js';
import { LESSONS, PROGRESSIONS } from './lessons.js';
import { PALETTES } from './palettes.js';

const $ = (s) => document.querySelector(s);
const STORE = 'chord-compass:v1';

const defaults = {
  tab: 'chords',
  root: 'C',
  quality: 'maj7',
  labels: 'degree',
  hidden: [],
  family: 'book',
  group: 'all',
  inversion: 'all',
  cycle: false,
  scale: false,
  lefty: false,
  bpm: 80,
  prog: PROGRESSIONS[0].chords,
  progPreset: 0,
  progGroups: ['b5', 'b4'],
  startFret: 5,
  instrument: 'electric_guitar_jazz',
  palette: 'jazz',
};

let state = { ...defaults };
try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* storage unavailable */ }
let selected = null; // currently highlighted voicing (not persisted)

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
}

function set(patch, { keepSel = false } = {}) {
  Object.assign(state, patch);
  if (!keepSel) selected = null;
  save();
  render();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function chip(label, pressed, onClick, extra = '') {
  const b = document.createElement('button');
  b.className = `chip ${extra}`.trim();
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}

const pretty = (s) => s.replace(/#/g, '♯').replace(/b(?=\d|$)/g, '♭').replace(/([A-G])b/g, '$1♭');
const q = () => QUALITY_BY_ID[state.quality] || QUALITY_BY_ID.maj7;

// ---------------------------------------------------------------------------
// Static setup
// ---------------------------------------------------------------------------
function setupStatic() {
  // quality select with optgroups
  const sel = $('#quality');
  const groups = {};
  for (const qq of QUALITIES) {
    if (!groups[qq.group]) {
      groups[qq.group] = document.createElement('optgroup');
      groups[qq.group].label = qq.group;
      sel.append(groups[qq.group]);
    }
    const o = document.createElement('option');
    o.value = qq.id;
    o.textContent = `${qq.name}  —  ${qq.tones.map(degreeLabel).join(' ')}`;
    groups[qq.group].append(o);
  }
  sel.addEventListener('change', () => set({ quality: sel.value, hidden: [] }));

  document.querySelectorAll('#labelMode button').forEach((b) =>
    b.addEventListener('click', () => set({ labels: b.dataset.v }, { keepSel: true })));

  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => { set({ tab: b.dataset.tab }, { keepSel: true }); window.scrollTo({ top: 0 }); }));

  // Colours
  const pal = $('#palette');
  for (const p of PALETTES) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    pal.append(o);
  }
  pal.value = state.palette;
  document.documentElement.dataset.palette = state.palette;
  pal.addEventListener('change', () => {
    state.palette = pal.value;
    document.documentElement.dataset.palette = pal.value;
    save();
  });

  // Sound
  const inst = $('#instrument');
  for (const i of INSTRUMENTS) {
    const o = document.createElement('option');
    o.value = i.id;
    o.textContent = i.name;
    inst.append(o);
  }
  inst.value = state.instrument;
  setInstrument(state.instrument);
  inst.addEventListener('change', () => {
    state.instrument = inst.value;
    save();
    setInstrument(inst.value);
    preload().then(() => toast('Sound ready'));
  });
  // Start downloading the samples on the first tap (browsers need a gesture for audio).
  window.addEventListener('pointerdown', () => preload(), { once: true });

  $('#scaleOverlay').addEventListener('change', (e) => set({ scale: e.target.checked }, { keepSel: true }));
  $('#lefty').addEventListener('change', (e) => set({ lefty: e.target.checked }, { keepSel: true }));
  $('#cycle').addEventListener('change', (e) => set({ cycle: e.target.checked }));
  $('#clearSel').addEventListener('click', () => { selected = null; render(); });

  $('#hearIntervals').addEventListener('click', () => {
    // Root on the 5th string around fret 3–7 (or 6th string), like the book's interval exercises.
    const rootPc = parseNote(state.root).pc;
    let rootPitch = 45 + ((rootPc - 9 + 12) % 12); // A2 .. G#3
    if (rootPitch > 50) rootPitch -= 12;
    if (rootPitch < 42) rootPitch += 12;
    const tones = q().tones.filter((t) => !state.hidden.includes(t)).map((t) => rootPitch + degreeSemis(t));
    const secs = intervalDrill(rootPitch, tones);
    toast(`Root + each chord tone: ${q().tones.map(degreeLabel).join(' · ')}`);
    $('#hearIntervals').disabled = true;
    setTimeout(() => { $('#hearIntervals').disabled = false; }, secs * 1000);
  });

  // Practice bar
  const metro = new Metronome((beat) => {
    document.querySelectorAll('#beats i').forEach((d, i) => d.classList.toggle('on', i === beat));
  });
  metro.bpm = state.bpm;
  const updBpm = (d) => {
    state.bpm = Math.max(30, Math.min(260, state.bpm + d));
    metro.bpm = state.bpm;
    $('#bpm').textContent = state.bpm;
    save();
  };
  $('#bpmDown').addEventListener('click', () => updBpm(-4));
  $('#bpmUp').addEventListener('click', () => updBpm(4));
  $('#metroToggle').addEventListener('click', () => {
    const on = metro.toggle();
    $('#metroToggle').textContent = on ? '■' : '▶';
    $('#metroToggle').setAttribute('aria-label', on ? 'Stop metronome' : 'Start metronome');
    if (!on) document.querySelectorAll('#beats i').forEach((d) => d.classList.remove('on'));
  });
  $('#nextRoot').addEventListener('click', () => {
    const i = PRACTICE_ROOTS.indexOf(state.root);
    const next = PRACTICE_ROOTS[(i + 1) % PRACTICE_ROOTS.length];
    set({ root: next });
    toast(`Now: ${pretty(chordSymbol(next, q()))}`);
  });

  // Lessons
  const lw = $('#lessons');
  for (const book of LESSONS) {
    const div = document.createElement('div');
    div.className = 'book';
    div.innerHTML = `<h4>${book.book}</h4>`;
    for (const l of book.items) {
      const b = document.createElement('button');
      b.className = 'lesson';
      b.innerHTML = `<b>${l.title}</b><span>${l.desc}</span>`;
      b.addEventListener('click', () => {
        const patch = { ...l.set };
        if (patch.prog) {
          patch.tab = 'lead';
        } else if (!patch.tab) {
          patch.tab = 'chords';
        }
        if (!patch.hidden) patch.hidden = [];
        set(patch);
        window.scrollTo({ top: 0 });
        toast(l.title);
      });
      div.append(b);
    }
    lw.append(div);
  }

  // Voice leading
  const ps = $('#progPreset');
  PROGRESSIONS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = p.name;
    ps.append(o);
  });
  const custom = document.createElement('option');
  custom.value = -1;
  custom.textContent = 'Custom…';
  ps.append(custom);
  ps.addEventListener('change', () => {
    const i = +ps.value;
    if (i >= 0) set({ progPreset: i, prog: PROGRESSIONS[i].chords });
    else set({ progPreset: -1 });
  });
  let typing;
  $('#progInput').addEventListener('input', (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => { state.prog = e.target.value; state.progPreset = -1; save(); renderLead(); $('#progPreset').value = -1; }, 350);
  });
  $('#startFret').addEventListener('input', (e) => { state.startFret = +e.target.value; save(); renderLead(); });
  $('#progPlay').addEventListener('click', () => playProgression('strum'));
  $('#progArp').addEventListener('click', () => playProgression('notes'));
  $('#progCopy').addEventListener('click', async () => {
    const txt = $('#progOut pre.tab')?.textContent;
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); toast('Tab copied'); } catch { toast('Copy not available'); }
  });
}

// ---------------------------------------------------------------------------
// Render: chords tab
// ---------------------------------------------------------------------------
function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  document.querySelectorAll('.tab').forEach((t) => t.toggleAttribute('data-active', t.id === `tab-${state.tab}`));
  $('#bpm').textContent = state.bpm;

  // practice roots in bottom bar
  const pr = $('#practiceRoots');
  pr.replaceChildren(...PRACTICE_ROOTS.map((r) => chip(r, state.root === r, () => set({ root: r }))));

  if (state.tab === 'chords') renderChords();
  if (state.tab === 'lead') renderLead();
}

function renderChords() {
  const qq = q();
  // roots
  $('#roots').replaceChildren(...ROOTS.map((r) => chip(pretty(r), state.root === r, () => set({ root: r }))));
  $('#quality').value = qq.id;
  document.querySelectorAll('#labelMode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.labels)));
  $('#scaleOverlay').checked = state.scale;
  $('#lefty').checked = state.lefty;

  // name + spelling
  $('#chordName').textContent = pretty(chordSymbol(state.root, qq));
  const sp = $('#spelling');
  sp.replaceChildren(...spellChord(state.root, qq).map(({ degree, note: n }) => {
    const s = document.createElement('span');
    s.innerHTML = `<b>${pretty(n)}</b><small class="deg-${degreeFamily(degree)}-text">${degreeLabel(degree)}</small>`;
    return s;
  }));

  // degree chips
  $('#degreeChips').replaceChildren(...qq.tones.map((t) => {
    const on = !state.hidden.includes(t);
    const c = chip(degreeLabel(t), on, () => {
      const hidden = on ? [...state.hidden, t] : state.hidden.filter((x) => x !== t);
      set({ hidden }, { keepSel: true });
    }, `deg deg-${degreeFamily(t)}`);
    return c;
  }));

  // fretboard
  const board = fretboard({
    root: state.root,
    tones: qq.tones,
    hidden: new Set(state.hidden),
    mode: state.labels,
    voicing: selected,
    scale: state.scale ? MAJOR_SCALE : null,
    lefty: state.lefty,
  });
  board.addEventListener('click', (e) => {
    const g = e.target.closest('.tone');
    if (!g) return;
    const s = +g.dataset.s, f = +g.dataset.f;
    note([40, 45, 50, 55, 59, 64][s] + f);
  });
  $('#boardWrap').replaceChildren(board);
  $('#clearSel').hidden = !selected;

  renderVoicings();
}

function voicingCard(v, root, quality, { title, sub } = {}) {
  const card = document.createElement('div');
  card.className = 'vcard';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-selected', String(selected?.key === v.key && selected?.root === root));
  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title || v.inversionName;
  const s = document.createElement('div');
  s.className = 'sub';
  s.textContent = sub || (v.minFret > 0 ? `fret ${v.minFret}` : 'open position');
  const actions = document.createElement('div');
  actions.className = 'actions';
  const bStrum = document.createElement('button');
  bStrum.type = 'button'; bStrum.textContent = '▶'; bStrum.title = 'Strum';
  bStrum.addEventListener('click', (e) => { e.stopPropagation(); strum(v.pitches); });
  const bArp = document.createElement('button');
  bArp.type = 'button'; bArp.textContent = '♪'; bArp.title = 'Arpeggio (low to high)';
  bArp.addEventListener('click', (e) => { e.stopPropagation(); arpeggio(v.pitches); });
  actions.append(bStrum, bArp);
  const pre = document.createElement('pre');
  pre.className = 'tab';
  pre.textContent = tab(v);
  card.append(t, s, chordDiagram(v, root, state.labels), actions, pre);
  const pick = () => {
    if (root !== state.root || quality.id !== state.quality) {
      state.root = root; state.quality = quality.id; save();
    }
    selected = { ...v, root };
    strum(v.pitches);
    render();
    if (window.matchMedia('(max-width: 900px)').matches) $('#boardWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  card.addEventListener('click', pick);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  return card;
}

function renderVoicings() {
  const qq = q();
  const fams = familiesFor(qq);
  let famId = state.family;
  if (!fams.find((f) => f.id === famId)) famId = fams[0]?.id;
  const fam = FAMILIES[famId];

  $('#families').replaceChildren(...fams.map((f) => chip(f.name, f.id === famId, () => set({ family: f.id, group: 'all', inversion: 'all' }))));

  const groups = fam ? fam.groups : [];
  const groupOk = state.group === 'all' || groups.some((g) => g.id === state.group);
  const groupSel = groupOk ? state.group : 'all';
  $('#groups').replaceChildren(
    chip('All', groupSel === 'all', () => set({ group: 'all' })),
    ...(groups.length > 1 ? groups.map((g) => chip(g.short, groupSel === g.id, () => set({ group: g.id }))) : []),
  );

  const n = voiceTones(qq).length;
  const invLabels = n === 3
    ? [['all', 'All'], [0, 'Root'], [1, '3rd'], [2, '5th']]
    : [['all', 'All'], [0, 'Root'], [1, '3rd'], [2, '5th'], [3, '7th/6th'], [4, 'Ext']];
  $('#inversions').replaceChildren(...invLabels
    .filter(([v]) => v !== 4 || qq.voice)
    .map(([v, l]) => chip(l, String(state.inversion) === String(v), () => set({ inversion: v }))));

  const cycleAllowed = famId && fam.needs === 4 && famId !== 'shell';
  $('#cycleWrap').hidden = !cycleAllowed;
  $('#cycle').checked = state.cycle && cycleAllowed;

  const out = $('#voicings');
  out.replaceChildren();
  const shownGroups = groups.filter((g) => groupSel === 'all' || g.id === groupSel);

  const hint = $('#voicingHint');
  if (state.cycle && cycleAllowed) {
    const inv = state.inversion === 'all' || state.inversion === 4 ? 0 : +state.inversion;
    hint.textContent = `Same root, same ${['root position', '1st inversion', '2nd inversion', '3rd inversion'][inv]}: change one or two notes at a time to move through the five qualities.`;
    for (const g of shownGroups) renderCycleRow(out, g, inv);
    return;
  }
  hint.textContent = qq.voice
    ? `For voicings, ${qq.symbol} uses ${voiceTones(qq).map(degreeLabel).join(' · ')}. Less essential tones are left out, the way comping players usually do it.`
    : famId === 'caged'
      ? 'The five open-chord template shapes, made movable and changed to fit this chord (Chords on Command, series 6).'
      : 'Tap a shape to highlight it on the fretboard and hear it.';

  let total = 0;
  for (const g of shownGroups) {
    let list = buildGroup(state.root, qq, g);
    if (state.inversion !== 'all') list = list.filter((v) => v.inversion === +state.inversion);
    if (!list.length) continue;
    total += list.length;
    const sec = document.createElement('section');
    sec.className = 'group';
    sec.innerHTML = `<header><h4>${g.name}</h4><span class="sub hint" style="margin:0">${list.length} shape${list.length > 1 ? 's' : ''}</span></header>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    list.forEach((v) => grid.append(voicingCard(v, state.root, qq)));
    sec.append(grid);
    // Up-the-neck sequence tab (lessons 9–23: play inversions up and down the string)
    if (list.length > 1) {
      const seq = [...list].sort((a, b) => a.avgFret - b.avgFret);
      const det = document.createElement('details');
      det.className = 'seq';
      det.innerHTML = '<summary>Tab: walk these shapes up the neck</summary>';
      const pre = document.createElement('pre');
      pre.className = 'tab';
      pre.textContent = tab(seq, { labels: seq.map((v) => shortInv(v)) });
      const play = document.createElement('button');
      play.className = 'btn ghost';
      play.style.marginTop = '6px';
      play.textContent = '▶ Play up & down';
      play.addEventListener('click', () => playSequence([...seq, ...seq.slice(0, -1).reverse()]));
      det.append(pre, play);
      sec.append(det);
    }
    out.append(sec);
  }
  if (!total) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No playable shapes for this filter. Try another bass note or string set.';
    out.append(p);
  }
}

function shortInv(v) {
  if (v.inversionName.endsWith('shape')) return v.inversionName.split(' ')[0];
  return { 0: 'R', 1: '1st', 2: '2nd', 3: '3rd' }[v.inversion] ?? v.bass;
}

function renderCycleRow(out, g, inv) {
  const sec = document.createElement('section');
  sec.className = 'group cycle-row';
  sec.innerHTML = `<header><h4>${g.name}</h4></header>`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  let anchor = null;
  for (const id of CYCLE_QUALITIES) {
    const qq = QUALITY_BY_ID[id];
    const list = buildGroup(state.root, qq, g).filter((v) => v.inversion === inv);
    if (!list.length) continue;
    let v;
    if (!anchor) {
      // pick a mid-neck position for the first chord
      v = [...list].sort((a, b) => Math.abs(a.avgFret - 6) - Math.abs(b.avgFret - 6))[0];
      anchor = v;
    } else {
      v = [...list].sort((a, b) => Math.abs(a.avgFret - anchor.avgFret) - Math.abs(b.avgFret - anchor.avgFret))[0];
    }
    grid.append(voicingCard(v, state.root, qq, { title: pretty(chordSymbol(state.root, qq)), sub: v.inversionName }));
  }
  sec.append(grid);
  out.append(sec);
}

let seqTimers = [];
// mode 'strum': one strum per chord (2 beats each).
// mode 'notes': each chord as single notes, low to high, in eighth notes.
function playSequence(seq, { onStep, mode = 'strum' } = {}) {
  seqTimers.forEach(clearTimeout); // a new play replaces any playback in progress
  seqTimers = [];
  const beat = 60 / state.bpm;
  const gap = mode === 'notes'
    ? Math.max(4, ...seq.map((v) => v.pitches.length)) * beat / 2
    : Math.max(0.45, beat * 2);
  seq.forEach((v, i) => seqTimers.push(setTimeout(() => {
    if (mode === 'notes') arpeggio(v.pitches, { step: beat / 2, dur: beat * 2.5 });
    else strum(v.pitches);
    onStep && onStep(i);
  }, i * gap * 1000)));
  return seq.length * gap;
}

// ---------------------------------------------------------------------------
// Voice leading tab
// ---------------------------------------------------------------------------
const LEAD_GROUPS = [
  ['b6', '6th-str drop 3'], ['b5', '5th-str drop 2'], ['b4', '4th-str drop 2'],
  ['d2-6', 'Drop 2 · 6543'], ['d3-5', 'Drop 3 · 5321'], ['sh-6', 'Shells · 6th'], ['sh-5', 'Shells · 5th'],
];
let leadPath = null;

function parseProg(text) {
  const tokens = text.split(/[\s|,]+/).filter(Boolean).filter((t) => t !== '/' && t !== '%');
  const chords = [];
  const bad = [];
  for (const t of tokens) {
    const c = parseChordSymbol(t);
    if (c) chords.push({ ...c, symbol: t }); else bad.push(t);
  }
  return { chords, bad };
}

function renderLead() {
  $('#progPreset').value = state.progPreset;
  const input = $('#progInput');
  if (document.activeElement !== input) input.value = state.prog;
  $('#startFret').value = state.startFret;
  $('#startFretVal').textContent = state.startFret;
  $('#progGroups').replaceChildren(...LEAD_GROUPS.map(([id, label]) => chip(label, state.progGroups.includes(id), () => {
    const has = state.progGroups.includes(id);
    let next = has ? state.progGroups.filter((x) => x !== id) : [...state.progGroups, id];
    if (!next.length) next = [id];
    set({ progGroups: next });
  })));

  const { chords, bad } = parseProg(state.prog);
  const err = $('#progError');
  const out = $('#progOut');
  out.replaceChildren();
  leadPath = null;
  if (bad.length) {
    err.hidden = false;
    err.textContent = `Couldn't read: ${bad.join(', ')}. Try symbols like Dm7, G7, Cmaj7, Bø, F#°7, E7b9.`;
  } else err.hidden = true;
  if (!chords.length) return;

  // Shell voicings need a 7th; fall back to book shapes for chords that can't be shelled.
  const path = voiceLead(chords.map((c) => ({ root: c.root, quality: c.quality })), state.progGroups, { startFret: state.startFret });
  if (!path) {
    err.hidden = false;
    err.textContent = 'Some chords have no shapes in the selected string sets. Add another string set.';
    return;
  }
  leadPath = path.map((v, i) => ({ ...v, chord: chords[i] }));

  const card = document.createElement('div');
  card.className = 'card';
  const grid = document.createElement('div');
  grid.className = 'prog';
  leadPath.forEach((v, i) => {
    const c = v.chord;
    const vc = voicingCard(v, c.root, c.quality, { title: pretty(chordSymbol(c.root, c.quality)), sub: `${groupById(v.groupId)?.short ?? ''} · ${v.inversionName}` });
    if (i > 0) {
      const mv = movement(leadPath[i - 1], v);
      const still = mv.filter((m) => m === 0).length;
      const steps = mv.filter((m) => m > 0 && m <= 2).length;
      const m = document.createElement('div');
      m.className = 'moves';
      m.textContent = `${still} held · ${steps} by step${mv.some((x) => x > 2) ? ' · ' + mv.filter((x) => x > 2).length + ' leap' : ''}`;
      vc.insertBefore(m, vc.querySelector('.actions'));
    }
    // In the progression, tapping a card should not jump to the Chords tab; just play.
    const clone = vc.cloneNode(true);
    clone.addEventListener('click', () => strum(v.pitches));
    clone.querySelector('.actions button:first-child').addEventListener('click', (e) => { e.stopPropagation(); strum(v.pitches); });
    clone.querySelector('.actions button:last-child').addEventListener('click', (e) => { e.stopPropagation(); arpeggio(v.pitches); });
    clone.dataset.i = i;
    grid.append(clone);
  });
  card.append(grid);
  const full = document.createElement('pre');
  full.className = 'tab';
  full.textContent = tab(leadPath, { labels: leadPath.map((v) => v.chord.symbol) });
  const h = document.createElement('h3');
  h.style.marginTop = '14px';
  h.textContent = 'Tab';
  card.append(h, full);
  out.append(card);
}

function playProgression(mode = 'strum') {
  if (!leadPath) return;
  const cards = [...document.querySelectorAll('#progOut .vcard')];
  const secs = playSequence(leadPath, {
    mode,
    onStep: (i) => cards.forEach((c, j) => c.classList.toggle('playing', i === j)),
  });
  seqTimers.push(setTimeout(() => cards.forEach((c) => c.classList.remove('playing')), secs * 1000 + 200));
}

// ---------------------------------------------------------------------------
setupStatic();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
  // When a new version takes over, reload once so every file is from the same version.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}
