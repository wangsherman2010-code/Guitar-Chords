import {
  ROOTS, QUALITIES, QUALITY_BY_ID, CYCLE_QUALITIES, PRACTICE_ROOTS, MAJOR_SCALE,
  spellChord, spellDegree, chordSymbol, degreeFamily, degreeLabel, parseNote, degreeSemis, parseChordSymbol, voiceTones,
} from './theory.js';
import { familiesFor, buildGroup, groupById, voiceLead, movement, FAMILIES } from './voicings.js';
import { chordDiagram, fretboard, tab, finderDiagram } from './render.js';
import { identify, candidateName, defaultDegree, degreesFromBass } from './identify.js';
import { strum, arpeggio, intervalDrill, note, Metronome, INSTRUMENTS, setInstrument, preload, stopAll } from './audio.js';
import { LESSONS, PROGRESSIONS } from './lessons.js';
import { PALETTES } from './palettes.js';
import { Tuner, STRINGS, noteName } from './tuner.js';
import { ChordListener } from './listen.js';

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
  barOpen: false,
  finder: { frets: [null, 3, 2, 0, 1, 0], start: 1 },
};

let state = { ...defaults };
try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* storage unavailable */ }
let selected = null; // currently highlighted voicing (not persisted)

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
}

let navigatingBack = false; // true while applying a Back-button step
function set(patch, { keepSel = false } = {}) {
  const prevTab = state.tab;
  Object.assign(state, patch);
  // Each page change becomes a history step, so Android Back returns to the previous page.
  if (state.tab !== prevTab && !navigatingBack) history.pushState({ tab: state.tab }, '');
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
    const fab = $('#barOpen');
    fab.classList.add('pulse');
    setTimeout(() => fab.classList.remove('pulse'), 90);
  });
  metro.bpm = state.bpm;
  const updBpm = (d) => {
    state.bpm = Math.max(30, Math.min(260, state.bpm + d));
    metro.bpm = state.bpm;
    $('#bpm').textContent = state.bpm;
    $('#fabBpm').textContent = state.bpm;
    save();
  };
  $('#bpmDown').addEventListener('click', () => updBpm(-4));
  $('#bpmUp').addEventListener('click', () => updBpm(4));
  $('#metroToggle').addEventListener('click', () => {
    const on = metro.toggle();
    $('#metroToggle').textContent = on ? '■' : '▶';
    $('#barOpen').classList.toggle('running', on);
    $('#metroToggle').setAttribute('aria-label', on ? 'Stop metronome' : 'Start metronome');
    if (!on) document.querySelectorAll('#beats i').forEach((d) => d.classList.remove('on'));
  });
  // Collapsible practice bar (folded by default so it doesn't cover the page).
  const applyBar = () => document.body.classList.toggle('bar-collapsed', !state.barOpen);
  applyBar();
  $('#fabBpm').textContent = state.bpm;
  $('#barClose').addEventListener('click', () => { state.barOpen = false; save(); applyBar(); });
  $('#barOpen').addEventListener('click', () => { state.barOpen = true; save(); applyBar(); });

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
  $('#progPlay').addEventListener('click', () => toggleProgression('strum'));
  $('#progArp').addEventListener('click', () => toggleProgression('notes'));
  $('#progCopy').addEventListener('click', async () => {
    const txt = $('#progTab')?.textContent;
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); toast('Tab copied'); } catch { toast('Copy not available'); }
  });
}

// ---------------------------------------------------------------------------
// Render: chords tab
// ---------------------------------------------------------------------------
function render() {
  if (state.tab !== 'finder' && chordListener) stopListening();
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  document.querySelectorAll('.tab').forEach((t) => t.toggleAttribute('data-active', t.id === `tab-${state.tab}`));
  $('#bpm').textContent = state.bpm;

  // practice roots in bottom bar
  const pr = $('#practiceRoots');
  pr.replaceChildren(...PRACTICE_ROOTS.map((r) => chip(r, state.root === r, () => set({ root: r }))));

  if (state.tab === 'chords') renderChords();
  if (state.tab === 'lead') renderLead();
  if (state.tab === 'finder') renderFinder();
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
  const bEdit = document.createElement('button');
  bEdit.type = 'button'; bEdit.textContent = '✎'; bEdit.title = 'Edit in Chord finder'; bEdit.className = 'edit';
  bEdit.addEventListener('click', (e) => { e.stopPropagation(); editInFinder(v); });
  actions.append(bStrum, bArp, bEdit);
  card.append(t, s, chordDiagram(v, root, state.labels), actions);
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
      pre.className = 'tabtext';
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
  stopPlayback(); // a new play replaces any playback in progress
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
// Plain-language explanations shown when a shape button is tapped.
const LEAD_INFO = {
  b6: 'Lowest note on the 6th string (low E). Uses strings 6-4-3-2, with the 5th string muted. A deep, full sound. These are the 6th-string shapes from Jazz Comping Mastery.',
  b5: 'Lowest note on the 5th string (A). Uses four neighbouring strings, 5-4-3-2. The most common jazz comping shape: compact, clear and easy to move. The book\'s 5th-string shapes.',
  b4: 'Lowest note on the 4th string (D). Uses the top four strings, 4-3-2-1. A brighter, higher sound that sits well above a bass player. The book\'s 4th-string shapes.',
  'd2-6': 'Drop 2 on the bottom four strings, 6-5-4-3. A dark, low sound. Can get muddy below about the 5th fret.',
  'd3-5': 'Drop 3 with the lowest note on the 5th string. Uses strings 5-3-2-1, with the 4th string muted. Wide, open spacing.',
  'sh-6': 'Shell voicing: only Root, 3rd and 7th, the notes that define the chord. Root on the 6th string, strings 6-4-3. Lean, big-band style.',
  'sh-5': 'Shell voicing with the root on the 5th string, strings 5-4-3. Same idea: just R, 3 and 7.',
};
let lastTappedGroup = null;
let playingMode = null; // 'strum' | 'notes' | null
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
    lastTappedGroup = id;
    let next = has ? state.progGroups.filter((x) => x !== id) : [...state.progGroups, id];
    if (!next.length) next = [id];
    set({ progGroups: next });
  })));

  const { chords, bad } = parseProg(state.prog);
  const err = $('#progError');
  const out = $('#progOut');
  if (playingMode) stopPlayback(); // the cards are about to change
  out.replaceChildren();
  leadPath = null;
  renderGroupInfo(null);
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
  renderGroupInfo(leadPath);

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
    clone.querySelector('.actions button:nth-child(2)').addEventListener('click', (e) => { e.stopPropagation(); arpeggio(v.pitches); });
    clone.querySelector('.actions .edit').addEventListener('click', (e) => { e.stopPropagation(); editInFinder(v); });
    clone.dataset.i = i;
    grid.append(clone);
  });
  card.append(grid);
  const full = document.createElement('pre');
  full.className = 'tabtext';
  full.id = 'progTab';
  full.textContent = tab(leadPath, { labels: leadPath.map((v) => v.chord.symbol) });
  const h = document.createElement('h3');
  h.style.marginTop = '14px';
  h.textContent = 'Tab';
  card.append(h, full);
  out.append(card);
}

// Mini picture of which strings a shape uses: E A D G B e, filled = played.
function stringStrip(id) {
  const g = groupById(id);
  const used = new Set(g ? g.strings : []);
  return `<span class="strip" aria-hidden="true">${['E', 'A', 'D', 'G', 'B', 'e']
    .map((n, i) => `<i class="${used.has(i) ? 'on' : ''}">${n}</i>`).join('')}</span>`;
}

function renderGroupInfo(path) {
  const box = $('#progGroupInfo');
  if (!box) return;
  const label = Object.fromEntries(LEAD_GROUPS);
  let html = '';
  if (lastTappedGroup) {
    const on = state.progGroups.includes(lastTappedGroup);
    html += `<div class="gsel"><div class="ghead"><b>${label[lastTappedGroup]}</b> ${stringStrip(lastTappedGroup)}
      <span class="gstate ${on ? 'on' : ''}">${on ? 'On' : 'Off'}</span></div><p>${LEAD_INFO[lastTappedGroup]}</p></div>`;
  }
  if (path) {
    const counts = {};
    path.forEach((v) => { counts[v.groupId] = (counts[v.groupId] || 0) + 1; });
    const used = Object.entries(counts).map(([id, n]) => `<b>${label[id] || id}</b> (${n} chord${n > 1 ? 's' : ''})`).join(', ');
    html += `<p class="gused">This progression uses: ${used}.</p>`;
  }
  html += `<p class="gtip">Tap a shape to turn it on or off and read what it is. With <b>one</b> on, every chord uses that string set.
    With <b>several</b> on, the app picks, chord by chord, whichever shape is closest to the last one. So turning on another shape
    only changes the result if it gives a smoother move.</p>`;
  box.innerHTML = html;
}

function setPlayButtons() {
  $('#progPlay').textContent = playingMode === 'strum' ? '■ Stop' : '▶ Play through (strum)';
  $('#progArp').textContent = playingMode === 'notes' ? '■ Stop' : '♪ Play through (single notes)';
  $('#progPlay').classList.toggle('stop', playingMode === 'strum');
  $('#progArp').classList.toggle('stop', playingMode === 'notes');
}

// Stop any sequence: cancel what hasn't started yet and silence what's ringing.
function stopPlayback() {
  seqTimers.forEach(clearTimeout);
  seqTimers = [];
  stopAll();
  document.querySelectorAll('#progOut .vcard.playing').forEach((c) => c.classList.remove('playing'));
  if (playingMode) { playingMode = null; setPlayButtons(); }
}

function toggleProgression(mode) {
  if (playingMode === mode) { stopPlayback(); return; }
  playProgression(mode);
}

function playProgression(mode = 'strum') {
  if (!leadPath) return;
  const cards = [...document.querySelectorAll('#progOut .vcard')];
  const secs = playSequence(leadPath, {
    mode,
    onStep: (i) => cards.forEach((c, j) => c.classList.toggle('playing', i === j)),
  });
  playingMode = mode;
  setPlayButtons();
  seqTimers.push(setTimeout(() => {
    cards.forEach((c) => c.classList.remove('playing'));
    playingMode = null;
    setPlayButtons();
  }, secs * 1000 + 600));
}

// ---------------------------------------------------------------------------
// Chord finder: edit a shape, get its name(s)
// ---------------------------------------------------------------------------
const FINDER_FRETS = 6;
let finderPick = 0; // which reading labels the dots
let finderShowMore = false; // show rootless readings

function fitWindow(frets) {
  const used = frets.filter((f) => f !== null && f > 0);
  if (!used.length) return 1;
  const lo = Math.min(...used), hi = Math.max(...used);
  if (hi <= FINDER_FRETS) return 1;
  return Math.max(1, Math.min(lo - 1 || 1, 24 - FINDER_FRETS + 1));
}

function editInFinder(v) {
  const frets = [...v.frets];
  state.finder = { frets, start: fitWindow(frets) };
  finderPick = 0;
  set({ tab: 'finder' });
  window.scrollTo({ top: 0 });
}

function finderPitches() {
  return state.finder.frets.map((f, s) => (f === null ? null : [40, 45, 50, 55, 59, 64][s] + f)).filter((p) => p !== null);
}

function setFinderFret(s, f) {
  const frets = [...state.finder.frets];
  frets[s] = frets[s] === f ? null : f; // tap the same spot again to clear it
  state.finder = { ...state.finder, frets };
  finderPick = 0;
  finderShowMore = false;
  save();
  renderFinder();
  if (frets[s] !== null) note([40, 45, 50, 55, 59, 64][s] + frets[s]);
}

// ---------------------------------------------------------------------------
// Listen: hear a strummed chord and name it
// ---------------------------------------------------------------------------
let chordListener = null;
let heard = null; // { notes, candidates }
let heardPick = 0;

function stopListening() {
  if (chordListener) chordListener.stop();
  chordListener = null;
  $('#fListen').textContent = '🎙 Listen';
  $('#fListen').classList.remove('stop');
  renderListen();
}

async function toggleListening() {
  if (chordListener) { stopListening(); return; }
  if (tuner) stopTuner();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    heard = { error: 'This browser can’t use the microphone here.' };
    renderListen();
    return;
  }
  chordListener = new ChordListener(
    (r) => { heard = r; heardPick = 0; renderListen(); },
    (lvl) => { listenStatus = lvl; renderListen(); },
  );
  try {
    await chordListener.start();
    $('#fListen').textContent = '■ Stop';
    $('#fListen').classList.add('stop');
    listenStatus = 'waiting';
    if (heard && heard.error) heard = null;
    renderListen();
  } catch (e) {
    chordListener = null;
    heard = { error: e && e.name === 'NotAllowedError'
      ? 'Microphone permission was blocked. Allow it in your browser’s site settings, then try again.'
      : 'Couldn’t start the microphone.' };
    renderListen();
  }
}
let listenStatus = 'waiting';

const degreePcOf = (t) => ((degreeSemis(t) % 12) + 12) % 12;

// A playable shape for a heard chord, with the same bass note if possible.
function shapeFor(c, bassPc) {
  const q = QUALITY_BY_ID[c.quality.id];
  if (!q) return null;
  const all = familiesFor(q).flatMap((f) => f.groups.map((g) => ({ fam: f.id, g })));
  let best = null, bestCost = Infinity;
  for (const { fam, g } of all) {
    for (const v of buildGroup(c.root, q, g)) {
      const low = Math.min(...v.pitches) % 12;
      const cost = (low === bassPc ? 0 : 20) + Math.abs(v.avgFret - 5) + (fam === 'book' ? 0 : fam === 'caged' ? 1 : 2);
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
  }
  return best;
}

function renderListen() {
  const panel = $('#listenPanel');
  if (!panel) return;
  panel.hidden = !chordListener && !heard;
  if (panel.hidden) return;
  let html = '';
  if (heard && heard.error) {
    panel.innerHTML = `<p class="error">${heard.error}</p>`;
    return;
  }
  if (chordListener) {
    html += `<div class="lstatus ${listenStatus}">${listenStatus === 'hearing' ? '● Hearing…' : '🎙 Listening: strum a chord'}</div>`;
  }
  if (heard) {
    const cands = heard.candidates;
    const pick = cands[heardPick];
    if (!pick) {
      html += '<div class="lname muted">?</div><div class="lsub">Couldn’t name that. Strum again, a little louder, and let it ring.</div>';
    } else {
      const heardPcs = new Set(heard.notes.map((n) => n.midi % 12));
      const bassPc = heard.notes.length ? Math.min(...heard.notes.map((n) => n.midi)) % 12 : null;
      const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
      const rootPc = parseNote(pick.root).pc;
      // Chord notes in chord order (R, 3, 5, 7…), like the name cards.
      const chordTones = pick.quality.tones.filter((t) => heardPcs.has((rootPc + degreePcOf(t)) % 12));
      const notes = chordTones;
      const shown = chordTones.map((t) => `<span class="deg-${degreeFamily(t)}-text">${pretty(spellDegree(pick.root, t))}<small>${degreeLabel(t)}</small></span>`).join('');
      const extra = [...heardPcs].filter((pc) => !pick.degrees.has(pc)).map((pc) => pretty(names[pc]));
      html += `<div class="lhead">Heard</div><div class="lname">${pretty(candidateName(pick))}</div>
        <div class="lsub">${pick.quality.name}${pick.inversion && pick.inversion !== 'Root position' ? ' · ' + pick.inversion : ''}</div>
        <div class="rnotes" style="--n:${notes.length}">${shown}</div>
        ${extra.length ? `<div class="lsub">Also heard: ${extra.join(', ')} (probably an overtone)</div>` : ''}`;
      if (cands.length > 1) {
        html += `<div class="lalt">Could also be: ${cands.map((c, i) => i === heardPick ? '' : `<button class="chip lchip" data-i="${i}">${pretty(candidateName(c))}</button>`).join('')}</div>`;
      }
      if (shapeFor(pick, bassPc)) html += '<button id="lShow" class="btn ghost">Show a shape on the diagram</button>';
    }
  }
  panel.innerHTML = html;
  panel.querySelectorAll('.lchip').forEach((b) => b.addEventListener('click', () => { heardPick = +b.dataset.i; renderListen(); }));
  const show = panel.querySelector('#lShow');
  if (show) {
    show.addEventListener('click', () => {
      const pick = heard.candidates[heardPick];
      const bassPc = Math.min(...heard.notes.map((n) => n.midi)) % 12;
      const v = shapeFor(pick, bassPc);
      if (!v) return;
      state.finder = { frets: [...v.frets], start: fitWindow(v.frets) };
      finderPick = 0;
      save();
      renderFinder();
      strum(v.pitches);
    });
  }
}

function setupFinder() {
  $('#fListen').addEventListener('click', toggleListening);
  $('#finderBoard').addEventListener('click', (e) => {
    const r = e.target.closest('.hit');
    if (!r) return;
    setFinderFret(+r.dataset.s, +r.dataset.f);
  });
  const move = (d) => {
    const start = Math.max(1, Math.min(24 - FINDER_FRETS + 1, state.finder.start + d));
    state.finder = { ...state.finder, start };
    save();
    renderFinder();
  };
  $('#fUp').addEventListener('click', () => move(-1));
  $('#fDown').addEventListener('click', () => move(1));
  $('#fClear').addEventListener('click', () => { state.finder = { frets: Array(6).fill(null), start: state.finder.start }; finderPick = 0; save(); renderFinder(); });
  $('#fStrum').addEventListener('click', () => { const p = finderPitches(); if (p.length) strum(p); });
  $('#fArp').addEventListener('click', () => { const p = finderPitches(); if (p.length) arpeggio(p); });
}

function renderFinder() {
  const { frets, start } = state.finder;
  const res = identify(frets);
  // Ordinary names first; rootless readings sit behind "Show more names".
  const plain = res.candidates.filter((c) => !c.rootless);
  const rootless = res.candidates.filter((c) => c.rootless);
  const cands = finderShowMore ? [...plain, ...rootless] : plain;
  if (finderPick >= cands.length) finderPick = 0;
  const pick = cands[finderPick];
  const rootPc = pick ? parseNote(pick.root).pc : res.bassPc;
  const rootName = pick ? pick.root : null;

  // Labels for each sounding string
  const marks = frets.map((f, s) => {
    if (f === null) return null;
    const pc = ([40, 45, 50, 55, 59, 64][s] + f) % 12;
    const tok = pick ? pick.degrees.get(pc) : defaultDegree(rootPc, pc);
    let label = degreeLabel(tok);
    if (state.labels === 'note') {
      label = pick ? pretty(spellDegree(rootName, tok)) : pretty(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc]);
    }
    return { label, fam: degreeFamily(tok) };
  });

  $('#fWindow').textContent = `Frets ${start}–${start + FINDER_FRETS - 1}`;
  $('#finderBoard').replaceChildren(finderDiagram(frets, start, marks, FINDER_FRETS));

  // Big name right under the diagram, so it changes as you tap.
  const big = $('#finderName');
  const n = res.pcs.length;
  if (pick) {
    const tags = [
      pick.inversion !== 'Root position' && !pick.rootless ? pick.inversion : '',
      pick.missing.includes('5') ? 'no 5th' : '',
      pick.rootless ? `rootless, root ${pretty(pick.root)} implied` : '',
    ].filter(Boolean).join(' · ');
    big.innerHTML = `<div class="fname">${pretty(candidateName(pick))}</div>
      <div class="fsub">${pick.quality.name}${tags ? ' · ' + tags : ''}</div>`;
  } else {
    big.innerHTML = `<div class="fname muted">${n === 0 ? 'No notes' : n === 1 ? 'Single note' : '?'}</div>
      <div class="fsub">${n === 0 ? 'Tap the diagram to add notes.' : n === 1 ? 'Add two or more notes to make a chord.'
        : rootless.length ? 'No ordinary name. See “Show more names” below.' : 'No standard chord name. Try moving or removing a note.'}</div>`;
  }

  const out = $('#finderResult');
  out.replaceChildren();
  if (n === 0) {
    out.innerHTML = '<p class="hint">Names appear here once you add notes.</p>';
    return;
  }
  cands.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'reading';
    b.setAttribute('aria-pressed', String(i === finderPick));
    const shownTones = c.quality.tones.filter((t) => !c.missing.includes(t));
    const notes = shownTones
      .map((t) => `<span class="deg-${degreeFamily(t)}-text">${pretty(spellDegree(c.root, t))}<small>${degreeLabel(t)}</small></span>`).join('');
    const tags = [
      i === 0 && !c.rootless ? '<i class="tag best">Most likely</i>' : '',
      c.inversion !== 'Root position' && !c.rootless ? `<i class="tag">${c.inversion}</i>` : '',
      c.missing.includes('5') ? '<i class="tag">no 5th</i>' : '',
      c.rootless ? `<i class="tag">rootless: root ${pretty(c.root)} implied</i>` : '',
    ].join('');
    b.innerHTML = `<div class="rname">${pretty(candidateName(c))}</div>
      <div class="rsub">${c.quality.name}</div><div class="rnotes${shownTones.length > 5 ? ' many' : ''}" style="--n:${shownTones.length}">${notes}</div><div class="rtags">${tags}</div>`;
    b.addEventListener('click', () => { finderPick = i; renderFinder(); });
    out.append(b);
  });
  if (rootless.length) {
    const more = document.createElement('button');
    more.className = 'link';
    more.style.margin = '2px 0 8px';
    more.textContent = finderShowMore
      ? 'Hide rootless names'
      : `Show more names (${rootless.length} rootless reading${rootless.length > 1 ? 's' : ''})`;
    more.addEventListener('click', () => { finderShowMore = !finderShowMore; renderFinder(); });
    out.append(more);
  }
  if (pick && QUALITY_BY_ID[pick.quality.id]) {
    const go = document.createElement('button');
    go.className = 'btn ghost';
    go.style.display = 'block';
    go.style.marginTop = '8px';
    go.textContent = `Show ${pretty(pick.root + pick.quality.symbol)} on the Chords page`;
    go.addEventListener('click', () => { set({ tab: 'chords', root: pick.root, quality: pick.quality.id, hidden: [] }); window.scrollTo({ top: 0 }); });
    out.append(go);
  }
  if (n >= 2) {
    const ref = document.createElement('p');
    ref.className = 'hint';
    ref.style.marginTop = '10px';
    ref.innerHTML = `Counting from the lowest note: <b>${degreesFromBass(res.pcs, res.bassPc).map(degreeLabel).join(' · ')}</b>
      <br>Tap another name to see the notes labelled for that reading.`;
    out.append(ref);
  }
}

// ---------------------------------------------------------------------------
// Tuner (opened from the logo or the Tuner button; Back closes it)
// ---------------------------------------------------------------------------
let tuner = null;
let tunerLock = null; // index of a string chosen by the user, or null for automatic
const tunedOk = new Set();
let okSince = 0;

function tunerOpen() { return !$('#tuner').hidden; }

function openTuner() {
  if (tunerOpen()) return;
  if (chordListener) stopListening();
  $('#tuner').hidden = false;
  history.pushState({ tab: state.tab, tuner: true }, '');
  renderTunerStrings(null);
}

function closeTuner({ fromBack = false } = {}) {
  if (!tunerOpen()) return;
  stopTuner();
  $('#tuner').hidden = true;
  if (!fromBack && history.state && history.state.tuner) history.back();
}

function stopTuner() {
  if (tuner) tuner.stop();
  tuner = null;
  $('#tStart').textContent = '🎙 Start listening';
  $('#tStart').classList.remove('on');
  showReading(null);
  $('#tMsg').textContent = 'Tap Start, then play one string.';
}

async function startTuner() {
  if (tuner) { stopTuner(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#tMsg').textContent = 'This browser can’t use the microphone here.';
    return;
  }
  tuner = new Tuner(showReading);
  if (tunerLock !== null) tuner.setLock(STRINGS[tunerLock].midi);
  try {
    await tuner.start();
    $('#tStart').textContent = '■ Stop listening';
    $('#tStart').classList.add('on');
    $('#tMsg').textContent = 'Play one string…';
  } catch (e) {
    tuner = null;
    $('#tMsg').textContent = e && e.name === 'NotAllowedError'
      ? 'Microphone permission was blocked. Allow it in your browser’s site settings, then try again.'
      : 'Couldn’t start the microphone.';
  }
}

function renderTunerStrings(targetIdx) {
  $('#tStrings').replaceChildren(...STRINGS.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${st.name}<small>${st.label.split(' ')[1]}</small>`;
    if (i === tunerLock) b.classList.add('locked');
    else if (i === targetIdx) b.classList.add('target');
    if (tunedOk.has(i)) b.classList.add('done');
    b.addEventListener('click', () => {
      tunerLock = tunerLock === i ? null : i;
      if (tuner) tuner.setLock(tunerLock === null ? null : STRINGS[tunerLock].midi);
      note(st.midi); // reference tone
      renderTunerStrings(tunerLock ?? targetIdx);
    });
    return b;
  }));
}

function showReading(r) {
  const needle = $('#tNeedle');
  const msg = $('#tMsg');
  if (!r) {
    needle.classList.remove('live', 'ok');
    needle.style.left = '50%';
    $('#tNote').textContent = '–';
    $('#tHz').textContent = '';
    $('#tNote').parentElement.classList.remove('ok');
    if (tuner) msg.textContent = 'Play one string…';
    msg.classList.remove('ok');
    return;
  }
  // Target: the locked string, or the nearest open string.
  let idx = tunerLock;
  if (idx === null) {
    idx = 0;
    STRINGS.forEach((st, i) => { if (Math.abs(r.midi - st.midi) < Math.abs(r.midi - STRINGS[idx].midi)) idx = i; });
  }
  const target = STRINGS[idx];
  const cents = (r.midi - target.midi) * 100;
  const ok = Math.abs(cents) <= 5;
  const shown = Math.max(-50, Math.min(50, cents));
  needle.style.left = `${50 + shown}%`;
  needle.classList.add('live');
  needle.classList.toggle('ok', ok);
  $('#tNote').textContent = noteName(r.midi).replace(/\d+$/, '');
  $('#tHz').textContent = `${r.freq.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${Math.round(cents)} cents · string ${target.name}`;
  $('#tNote').parentElement.classList.toggle('ok', ok);
  if (Math.abs(cents) > 300) msg.textContent = `Far from ${target.name}. Check you’re on the right string.`;
  else if (ok) msg.textContent = `✓ ${target.name} is in tune`;
  else msg.textContent = cents < 0 ? `Tune up ↑ (${Math.round(-cents)} cents flat)` : `Tune down ↓ (${Math.round(cents)} cents sharp)`;
  msg.classList.toggle('ok', ok);
  // Mark a string done after it stays in tune for about half a second.
  if (ok) {
    if (!okSince) okSince = performance.now();
    if (performance.now() - okSince > 500 && !tunedOk.has(idx)) tunedOk.add(idx);
  } else okSince = 0;
  renderTunerStrings(idx);
}

function setupTuner() {
  $('#logoTuner').addEventListener('click', openTuner);
  $('#openTuner').addEventListener('click', openTuner);
  $('#closeTuner').addEventListener('click', () => closeTuner());
  $('#tuner').addEventListener('click', (e) => { if (e.target.id === 'tuner') closeTuner(); });
  $('#tStart').addEventListener('click', startTuner);
  document.addEventListener('visibilitychange', () => { if (document.hidden && tuner) stopTuner(); if (document.hidden && chordListener) stopListening(); });
}

// Android Back / browser back: close the tuner first, otherwise go to the previous page.
window.addEventListener('popstate', (e) => {
  if (tunerOpen()) { closeTuner({ fromBack: true }); return; }
  const tabName = e.state && e.state.tab;
  if (tabName && tabName !== state.tab) {
    navigatingBack = true;
    set({ tab: tabName }, { keepSel: true });
    navigatingBack = false;
    window.scrollTo({ top: 0 });
  }
});

// ---------------------------------------------------------------------------
setupStatic();
setupFinder();
setupTuner();
history.replaceState({ tab: state.tab }, '');
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
