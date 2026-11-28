import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../js/course.js';
import { parseChordSymbol, parseNote } from '../js/theory.js';
import { buildGroup, groupById, voiceLead, FAMILIES } from '../js/voicings.js';
import { parseProgression } from '../js/backing.js';
import { degreeFamily } from '../js/theory.js';

function resolve(spec) {
  const c = parseChordSymbol(spec.symbol);
  const g = groupById(spec.group);
  let list = buildGroup(c.root, c.quality, g);
  if (spec.inversion !== undefined) list = list.filter((v) => v.inversion === spec.inversion);
  if (spec.pick) {
    const want = spec.pick === 'R73' ? 'seventh' : 'third';
    list = list.filter((v) => { const d = g.strings.map((s) => v.degrees[s]); return d[0] === '1' && degreeFamily(d[1]) === want; });
  }
  list.sort((a, b) => Math.abs(a.minFret - (spec.near ?? 5)) - Math.abs(b.minFret - (spec.near ?? 5)));
  return list[0];
}
const fr = (v) => v.frets.map((x) => (x === null ? 'x' : x)).join(' ');

test('every diagram / play spec resolves to a playable shape', () => {
  const shown = [];
  for (const l of LESSONS) for (const s of l.steps) for (const spec of [...(s.items || []).filter((i) => i.symbol), ...(s.chords || [])]) {
    const v = resolve(spec);
    assert.ok(v, `${l.id}: ${spec.symbol} ${spec.group}`);
    shown.push(`${spec.symbol}@${spec.group}: ${fr(v)}`);
  }
  console.log(shown.join('\n'));
});

test('every backing progression parses and gets voicings', () => {
  const groupsOk = (g) => g.every((id) => groupById(id));
  for (const l of LESSONS) for (const s of l.steps) {
    const progs = [];
    if (s.type === 'backing') progs.push([s.prog, s.groups || ['b5', 'b4']]);
    if (s.type === 'checklist') for (const it of s.items) if (it.prog) progs.push([it.prog, s.groups || ['b5', 'b4']]);
    for (const [prog, groups] of progs) {
      assert.ok(groupsOk(groups), `${l.id}: bad groups`);
      const p = parseProgression(prog);
      const path = voiceLead(p.map((c) => ({ root: c.root, quality: c.quality })), groups, { startFret: 5 });
      assert.ok(path && path.length === p.length, `${l.id}: no voicings for ${JSON.stringify(prog)} on ${groups}`);
    }
  }
});

test('follow exercises use valid note names and shell spec examples are correct', () => {
  for (const l of LESSONS) for (const s of l.steps) if (s.type === 'follow') for (const e of s.exercises) for (const n of e.notes) assert.doesNotThrow(() => parseNote(n), n);
  assert.equal(fr(resolve({ symbol: 'G7', group: 'sh-6', pick: 'R73', near: 3 })), '3 x 3 4 x x');
  assert.equal(fr(resolve({ symbol: 'Cmaj7', group: 'sh-5', pick: 'R37', near: 3 })), 'x 3 2 4 x x');
  assert.equal(fr(resolve({ symbol: 'Cmaj7', group: 'b5', inversion: 0, near: 3 })), 'x 3 5 4 5 x');
});
