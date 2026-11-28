// Tutor tab: a step-by-step course with backing tracks and listening checks.
import { parseChordSymbol, parseNote, degreePc, degreeLabel, degreeFamily, spellDegree } from './theory.js';
import { buildGroup, groupById } from './voicings.js';
import { chordDiagram, fretboard } from './render.js';
import { strum, arpeggio, stopAll } from './audio.js';
import { Backing, parseProgression } from './backing.js';
import { Tuner } from './tuner.js';
import { ChordListener } from './listen.js';
import { TRACKS, LESSONS, UPCOMING } from './course.js';

let ctx = null; // { state, save, keepAwake, pretty, toast }
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };

// ---------------------------------------------------------------------------
// Shared players (only one thing makes sound / listens at a time)
// ---------------------------------------------------------------------------
let backing = null;
let backingOwner = null; // id of the control that started it
let listener = null;
let follower = null;
let playTimers = [];
const onStop = new Set(); // UI reset callbacks

export function stopTutorAudio() {
  if (backing) backing.stop();
  backingOwner = null;
  if (listener) listener.stop();
  listener = null;
  if (follower) follower.stop();
  follower = null;
  playTimers.forEach(clearTimeout);
  playTimers = [];
  stopAll();
  ctx && ctx.keepAwake('tutor', false);
  onStop.forEach((f) => f());
  onStop.clear();
}

function tstate() {
  if (!ctx.state.tutor) ctx.state.tutor = { done: {}, step: {}, checks: {}, open: null };
  return ctx.state.tutor;
}

// ---------------------------------------------------------------------------
// Voicing lookup for a step spec
// ---------------------------------------------------------------------------
function voicingFor(spec) {
  const c = parseChordSymbol(spec.symbol);
  const g = groupById(spec.group);
  if (!c || !g) return null;
  let list = buildGroup(c.root, c.quality, g);
  if (spec.inversion !== undefined) list = list.filter((v) => v.inversion === spec.inversion);
  if (spec.pick) {
    const want = spec.pick === 'R73' ? 'seventh' : 'third';
    list = list.filter((v) => {
      const degs = g.strings.map((s) => v.degrees[s]);
      return degs[0] === '1' && degreeFamily(degs[1]) === want;
    });
  }
  if (!list.length) return null;
  const near = spec.near ?? 5;
  list.sort((a, b) => Math.abs(a.minFret - near) - Math.abs(b.minFret - near));
  return { v: list[0], root: c.root, quality: c.quality };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
export function initTutor(c) { ctx = c; }

export function renderTutor() {
  const box = document.querySelector('#tutorRoot');
  const t = tstate();
  const lesson = LESSONS.find((l) => l.id === t.open);
  box.replaceChildren(lesson ? renderLesson(lesson) : renderOverview());
}

function lessonStatus(l) {
  const t = tstate();
  if (t.done[l.id]) return '✓ Done';
  const st = t.step[l.id];
  return st ? `Continue · step ${st + 1} of ${l.steps.length}` : 'Start';
}

function renderOverview() {
  const wrap = el('div');
  const intro = el('div', 'card', `<h3>Jazz guitar course</h3>
    <p class="hint">Two tracks that grow together. Do a level of each, in any order. Each lesson explains one idea,
    lets you hear it, then gives you exercises with backing tracks. Where possible the app listens and checks you.</p>`);
  wrap.append(intro);
  for (const tr of TRACKS) {
    const card = el('div', 'card');
    card.append(el('h3', null, tr.name), el('p', 'hint', tr.blurb));
    const lessons = LESSONS.filter((l) => l.track === tr.id).sort((a, b) => a.level - b.level);
    for (const l of lessons) {
      const b = el('button', `lessoncard${tstate().done[l.id] ? ' done' : ''}`,
        `<span class="lvl">Level ${l.level}</span><b>${l.title}</b><span class="goal">${l.goal}</span><span class="status">${lessonStatus(l)}</span>`);
      b.addEventListener('click', () => openLesson(l.id));
      card.append(b);
    }
    (UPCOMING[tr.id] || []).forEach((title, i) => {
      card.append(el('div', 'lessoncard soon', `<span class="lvl">Level ${lessons.length + i + 1}</span><b>${title}</b><span class="status">Coming soon</span>`));
    });
    wrap.append(card);
  }
  return wrap;
}

function openLesson(id) {
  stopTutorAudio();
  tstate().open = id;
  ctx.save();
  history.pushState({ tab: 'tutor', lesson: id }, '');
  renderTutor();
  window.scrollTo({ top: 0 });
}

export function closeLesson({ fromBack = false } = {}) {
  stopTutorAudio();
  tstate().open = null;
  ctx.save();
  if (!fromBack && history.state && history.state.lesson) history.back();
  renderTutor();
  window.scrollTo({ top: 0 });
}

// Android Back inside a lesson returns to the course overview.
export function tutorHandlePop(e) {
  const t = ctx && ctx.state.tutor;
  if (ctx && ctx.state.tab === 'tutor' && t && t.open && !(e.state && e.state.lesson)) {
    closeLesson({ fromBack: true });
    return true;
  }
  return false;
}

function renderLesson(l) {
  const t = tstate();
  const idx = Math.min(t.step[l.id] || 0, l.steps.length - 1);
  const wrap = el('div');
  const head = el('div', 'card lessonhead');
  const back = el('button', 'link', '‹ All lessons');
  back.addEventListener('click', () => closeLesson());
  const track = TRACKS.find((x) => x.id === l.track);
  head.append(back, el('div', 'lvl', `${track.name} · Level ${l.level}`), el('h2', null, l.title), el('p', 'hint', l.goal));
  const bar = el('div', 'stepbar');
  l.steps.forEach((_, i) => {
    const d = el('button', `stepdot${i === idx ? ' on' : ''}${i < idx ? ' past' : ''}`);
    d.setAttribute('aria-label', `Step ${i + 1}`);
    d.addEventListener('click', () => goStep(l, i));
    bar.append(d);
  });
  head.append(bar, el('div', 'stepcount', `Step ${idx + 1} of ${l.steps.length}`));
  wrap.append(head);

  const body = el('div', 'card stepbody');
  body.append(renderStep(l, l.steps[idx], idx));
  wrap.append(body);

  const nav = el('div', 'stepnav');
  const prev = el('button', 'btn ghost', '‹ Back');
  prev.disabled = idx === 0;
  prev.addEventListener('click', () => goStep(l, idx - 1));
  const last = idx === l.steps.length - 1;
  const next = el('button', 'btn', last ? '✓ Finish lesson' : 'Next ›');
  next.addEventListener('click', () => {
    if (!last) { goStep(l, idx + 1); return; }
    t.done[l.id] = true;
    ctx.save();
    ctx.toast(`Lesson complete: ${l.title}`);
    closeLesson();
  });
  nav.append(prev, next);
  wrap.append(nav);
  return wrap;
}

function goStep(l, i) {
  stopTutorAudio();
  tstate().step[l.id] = Math.max(0, Math.min(l.steps.length - 1, i));
  ctx.save();
  renderTutor();
  document.querySelector('#tutorRoot .stepbody')?.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -70);
}

function renderStep(l, s, idx) {
  const box = el('div', `step step-${s.type}`);
  if (s.caption) box.append(el('h3', null, s.caption));
  switch (s.type) {
    case 'text': box.append(el('div', 'steptext', s.html)); break;
    case 'diagrams': box.append(stepDiagrams(s)); break;
    case 'fretboard': box.append(stepFretboard(s)); break;
    case 'play': box.append(stepPlay(s)); break;
    case 'backing': box.append(stepBacking(s, `${l.id}:${idx}`)); break;
    case 'listen': box.append(stepListen(s, `${l.id}:${idx}`)); break;
    case 'follow': box.append(stepFollow(s, `${l.id}:${idx}`)); break;
    case 'checklist': box.append(stepChecklist(s, `${l.id}:${idx}`)); break;
    default: break;
  }
  return box;
}

// ---- diagrams -------------------------------------------------------------
function stepDiagrams(s) {
  const grid = el('div', 'grid');
  for (const it of s.items) {
    const r = voicingFor(it);
    if (!r) continue;
    const card = el('div', 'vcard');
    card.append(el('div', 'title', it.label ? `${ctx.pretty(it.symbol)} · ${it.label}` : ctx.pretty(it.symbol)));
    card.append(chordDiagram(r.v, r.root, ctx.state.labels));
    const play = el('div', 'actions');
    const b1 = el('button', null, '▶'); b1.title = 'Strum';
    const b2 = el('button', null, '♪'); b2.title = 'Note by note';
    b1.addEventListener('click', (e) => { e.stopPropagation(); strum(r.v.pitches); });
    b2.addEventListener('click', (e) => { e.stopPropagation(); arpeggio(r.v.pitches); });
    play.append(b1, b2);
    card.append(play);
    card.addEventListener('click', () => strum(r.v.pitches));
    grid.append(card);
  }
  return grid;
}

// ---- fretboard ------------------------------------------------------------
function boardFor(root, tones, opts = {}) {
  const wrap = el('div', 'boardwrap');
  wrap.append(fretboard({ root, tones, mode: ctx.state.labels, lefty: ctx.state.lefty, ...opts }));
  return wrap;
}
function stepFretboard(s) {
  return boardFor(s.root, s.tones, { onlyStrings: s.onlyStrings || null, window: s.window || null });
}

// ---- play example ---------------------------------------------------------
function stepPlay(s) {
  const b = el('button', 'btn', s.label || '▶ Play');
  b.addEventListener('click', () => {
    stopTutorAudio();
    if (s.notes) arpeggio(s.notes, { step: s.step || 0.32, dur: 1.2 });
    if (s.chords) {
      s.chords.forEach((spec, i) => {
        const r = voicingFor(spec);
        if (r) playTimers.push(setTimeout(() => strum(r.v.pitches), i * 1300));
      });
    }
  });
  return b;
}

// ---- backing track --------------------------------------------------------
const bpmFor = {}; // remembered tempo per step

function backingControls({ prog, bpm, style, groups, startFret, owner, onChord }) {
  const box = el('div', 'backing');
  const chords = parseProgression(prog);
  const strip = el('div', 'chordstrip');
  chords.forEach((c, i) => strip.append(el('span', 'chordcell', `${ctx.pretty(c.symbol)}${c.bars > 1 ? `<small>×${c.bars}</small>` : ''}`)));
  bpmFor[owner] = bpmFor[owner] || bpm || 80;
  const tempo = el('div', 'tempo');
  const minus = el('button', 'iconbtn', '−');
  const plus = el('button', 'iconbtn', '+');
  const val = el('span', 'bpmval', `<b>${bpmFor[owner]}</b> bpm`);
  const go = el('button', 'btn', '▶ Start backing');
  const setLabel = (on) => { go.textContent = on ? '■ Stop' : '▶ Start backing'; go.classList.toggle('stop', on); };
  const restartIfRunning = () => { if (backingOwner === owner) start(); };
  minus.addEventListener('click', () => { bpmFor[owner] = Math.max(40, bpmFor[owner] - 5); val.innerHTML = `<b>${bpmFor[owner]}</b> bpm`; restartIfRunning(); });
  plus.addEventListener('click', () => { bpmFor[owner] = Math.min(220, bpmFor[owner] + 5); val.innerHTML = `<b>${bpmFor[owner]}</b> bpm`; restartIfRunning(); });
  const cells = () => [...strip.children];
  async function start() {
    stopTutorAudio();
    backing = backing || new Backing({});
    backing.onChord = (i) => { cells().forEach((c, j) => c.classList.toggle('on', i === j)); onChord && onChord(chords[i]); };
    backingOwner = owner;
    setLabel(true);
    onStop.add(() => { setLabel(false); cells().forEach((c) => c.classList.remove('on')); });
    ctx.keepAwake('tutor', true);
    await backing.start(chords, { bpm: bpmFor[owner], style: style || 'four', groups: groups || ['b5', 'b4'], startFret: startFret || 5 });
  }
  go.addEventListener('click', () => { if (backingOwner === owner) stopTutorAudio(); else start(); });
  tempo.append(minus, val, plus);
  const styleName = { four: 'four to the bar', charleston: 'charleston rhythm', whole: 'held chords' }[style || 'four'];
  box.append(strip, el('div', 'backingrow'), el('p', 'hint', `Count-in of 4 clicks, then the progression loops (${styleName}).`));
  box.querySelector('.backingrow').append(tempo, go);
  return box;
}

function stepBacking(s, owner) {
  const box = el('div');
  let mapBox = null;
  const showMap = (c) => {
    if (!mapBox || !c) return;
    mapBox.replaceChildren(el('div', 'maplabel', `Now: <b>${ctx.pretty(c.symbol)}</b>`), boardFor(c.root, c.quality.tones, { window: s.toneMap.window }));
  };
  box.append(backingControls({ ...s, owner, onChord: s.toneMap ? showMap : null }));
  if (s.tips) {
    const ul = el('ul', 'tips');
    s.tips.forEach((t) => ul.append(el('li', null, t)));
    box.append(ul);
  }
  if (s.toneMap) {
    mapBox = el('div', 'tonemap');
    box.append(mapBox);
    showMap(parseProgression(s.prog)[0]);
  }
  return box;
}

// ---- listen check (chords) ------------------------------------------------
function stepListen(s, key) {
  const t = tstate();
  const box = el('div');
  const targets = s.targets.map((sym) => ({ sym, c: parseChordSymbol(sym) }));
  let done = t.checks[key] || 0;
  const chips = el('div', 'targets');
  const msg = el('p', 'feedback', '');
  const btn = el('button', 'btn', '🎙 Start listening');
  const draw = () => {
    chips.replaceChildren(...targets.map((x, i) => el('span', `target${i < done ? ' ok' : i === done ? ' now' : ''}`, `${i < done ? '✓ ' : ''}${ctx.pretty(x.sym)}`)));
    if (done >= targets.length) msg.innerHTML = '<b>All correct. Well done!</b>';
    else if (!listener) msg.textContent = `Next: play ${ctx.pretty(targets[done].sym)}.`;
  };
  const setBtn = (on) => { btn.textContent = on ? '■ Stop listening' : (done >= targets.length ? '↻ Try again' : '🎙 Start listening'); btn.classList.toggle('stop', on); };
  btn.addEventListener('click', async () => {
    if (listener) { stopTutorAudio(); return; }
    if (done >= targets.length) { done = 0; t.checks[key] = 0; ctx.save(); draw(); }
    stopTutorAudio();
    listener = new ChordListener((res) => {
      const want = targets[done];
      const wantPc = parseNote(want.c.root).pc;
      const hit = res.candidates.slice(0, 2).some((c) => parseNote(c.root).pc === wantPc && c.quality.id === want.c.quality.id);
      const heard = res.candidates[0] ? ctx.pretty(res.candidates[0].root + res.candidates[0].quality.symbol) : '?';
      if (hit) {
        done++;
        t.checks[key] = done;
        ctx.save();
        ctx.toast(`✓ ${ctx.pretty(want.sym)}`);
        msg.textContent = done < targets.length ? `✓ ${ctx.pretty(want.sym)}. Next: ${ctx.pretty(targets[done].sym)}.` : '';
        draw();
        if (done >= targets.length) stopTutorAudio();
      } else {
        msg.textContent = `Heard ${heard}. Try ${ctx.pretty(want.sym)} again, and let it ring.`;
      }
    }, (lvl) => { if (lvl === 'notchord') msg.textContent = 'Heard a sound, but not a chord. Strum and let it ring.'; });
    try {
      await listener.start();
      ctx.keepAwake('tutor', true);
      setBtn(true);
      msg.textContent = `Play ${ctx.pretty(targets[done].sym)}.`;
      onStop.add(() => { setBtn(false); draw(); });
    } catch {
      listener = null;
      msg.textContent = 'Couldn’t use the microphone. Allow it in your browser’s site settings.';
    }
  });
  draw();
  setBtn(false);
  box.append(chips, msg, btn);
  return box;
}

// ---- follow check (single notes) ------------------------------------------
const NOTE_PC = (name) => parseNote(name).pc;

function stepFollow(s, key) {
  const t = tstate();
  const box = el('div');
  const doneEx = t.checks[key] || 0; // number of exercises completed
  let ex = Math.min(doneEx, s.exercises.length - 1);
  let pos = 0;
  const list = el('div', 'exlist');
  const notesRow = el('div', 'notesrow');
  const msg = el('p', 'feedback', '');
  const btn = el('button', 'btn', '🎙 Start');
  const drawList = () => {
    const finished = t.checks[key] || 0;
    list.replaceChildren(...s.exercises.map((e, i) => {
      const b = el('button', `exitem${i < finished ? ' ok' : ''}${i === ex ? ' now' : ''}`, `${i < finished ? '✓ ' : ''}${e.label}`);
      b.addEventListener('click', () => { ex = i; pos = 0; drawList(); drawNotes(); });
      return b;
    }));
  };
  const drawNotes = () => {
    notesRow.replaceChildren(...s.exercises[ex].notes.map((n, i) => el('span', `fnote${i < pos ? ' ok' : i === pos ? ' now' : ''}`, ctx.pretty(n))));
  };
  const setBtn = (on) => { btn.textContent = on ? '■ Stop' : '🎙 Start'; btn.classList.toggle('stop', on); };
  let lastPc = null, same = 0;
  btn.addEventListener('click', async () => {
    if (follower) { stopTutorAudio(); return; }
    stopTutorAudio();
    pos = 0; drawNotes();
    follower = new Tuner((r) => {
      if (!r) { lastPc = null; same = 0; return; }
      const pc = ((Math.round(r.midi) % 12) + 12) % 12;
      same = pc === lastPc ? same + 1 : 1;
      lastPc = pc;
      const notes = s.exercises[ex].notes;
      const want = NOTE_PC(notes[pos]);
      if (pc === want && same >= 2) {
        pos++;
        same = -99; // the next note must be a new reading
        drawNotes();
        if (pos >= notes.length) {
          const finished = Math.max(t.checks[key] || 0, ex + 1);
          t.checks[key] = finished;
          ctx.save();
          ctx.toast(`✓ ${s.exercises[ex].label}`);
          if (ex < s.exercises.length - 1) { ex++; pos = 0; drawList(); drawNotes(); msg.textContent = `Great. Next: ${s.exercises[ex].label}`; }
          else { msg.innerHTML = '<b>All done. Well done!</b>'; drawList(); stopTutorAudio(); }
        } else msg.textContent = `✓ ${ctx.pretty(notes[pos - 1])}. Next: ${ctx.pretty(notes[pos])}`;
      } else if (pc !== want && same === 3) {
        const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
        msg.textContent = `Hearing ${names[pc]}. Looking for ${ctx.pretty(notes[pos])}.`;
      }
    }, { stringFocus: false, historyLen: 3 });
    try {
      await follower.start();
      ctx.keepAwake('tutor', true);
      setBtn(true);
      msg.textContent = `Play ${ctx.pretty(s.exercises[ex].notes[0])}, then the next note…`;
      onStop.add(() => setBtn(false));
    } catch {
      follower = null;
      msg.textContent = 'Couldn’t use the microphone. Allow it in your browser’s site settings.';
    }
  });
  drawList();
  drawNotes();
  setBtn(false);
  box.append(list, notesRow, msg, btn, el('p', 'hint', 'Play one note at a time and let each one sound clearly. Any octave counts.'));
  return box;
}

// ---- checklist -------------------------------------------------------------
function stepChecklist(s, key) {
  const t = tstate();
  const checked = new Set(t.checks[key] || []);
  const box = el('div', 'checklist');
  s.items.forEach((it, i) => {
    const row = el('div', 'checkrow');
    const lab = el('label', 'check');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = checked.has(i);
    cb.addEventListener('change', () => {
      if (cb.checked) checked.add(i); else checked.delete(i);
      t.checks[key] = [...checked];
      ctx.save();
    });
    lab.append(cb, el('span', null, it.text));
    row.append(lab);
    if (it.prog) row.append(backingControls({ prog: it.prog, bpm: it.bpm || 80, style: s.style || 'four', groups: s.groups, startFret: s.startFret, owner: `${key}:${i}` }));
    box.append(row);
  });
  return box;
}
