import test from 'node:test';
import assert from 'node:assert/strict';
import { spellDegree, QUALITY_BY_ID, parseChordSymbol, spellChord } from '../js/theory.js';
import { buildGroup, groupById, voiceLead } from '../js/voicings.js';

const fr = (v) => v.frets.map((x) => (x === null ? 'x' : x)).join(' ');

test('spelling', () => {
  assert.equal(spellDegree('C', 'bb7'), 'Bbb');
  assert.equal(spellDegree('F#', '7'), 'E#');
  assert.equal(spellDegree('Eb', 'b3'), 'Gb');
  assert.equal(spellDegree('Bb', '#11'), 'E');
  assert.deepEqual(spellChord('D', QUALITY_BY_ID.m7b5).map((x) => x.note), ['D', 'F', 'Ab', 'C']);
});

test('book shapes: C maj7 matches Jazz Comping Mastery templates', () => {
  const q = QUALITY_BY_ID.maj7;
  const b6 = buildGroup('C', q, groupById('b6')).map(fr);
  const b5 = buildGroup('C', q, groupById('b5')).map(fr);
  const b4 = buildGroup('C', q, groupById('b4')).map(fr);
  assert.ok(b6.includes('8 x 9 9 8 x'), b6.join(' | '));   // R 7 3 5
  assert.ok(b5.includes('x 3 5 4 5 x'), b5.join(' | '));   // R 5 7 3
  assert.ok(b4.includes('x x 10 12 12 12'), b4.join(' | ')); // R 5 7 3
});

test('inversion labels follow bass note', () => {
  const v = buildGroup('C', QUALITY_BY_ID['7'], groupById('b5'));
  const names = new Set(v.map((x) => x.inversionName));
  assert.deepEqual([...names], ['Root position', '1st inversion', '2nd inversion', '3rd inversion']);
});

test('chord symbol parser', () => {
  for (const [s, id] of [['Dm7', 'm7'], ['G7', '7'], ['Cmaj7', 'maj7'], ['Am7b5', 'm7b5'], ['Bbø', 'm7b5'], ['F#°7', 'dim7'], ['Gm6', 'm6'], ['C', 'maj'], ['Ebmaj7', 'maj7'], ['D7b9', '7b9'], ['C-7', 'm7'], ['CΔ7', 'maj7'], ['G7alt', 'alt']]) {
    const r = parseChordSymbol(s);
    assert.ok(r, s);
    assert.equal(r.quality.id, id, s);
  }
});

test('voice leading ii-V-I stays close', () => {
  const chords = ['Dm7', 'G7', 'Cmaj7'].map(parseChordSymbol);
  const path = voiceLead(chords, ['b5']);
  assert.equal(path.length, 3);
  for (let i = 1; i < 3; i++) assert.ok(Math.abs(path[i].avgFret - path[i - 1].avgFret) <= 3, path.map(fr).join(' | '));
  console.log(path.map(fr));
});

test('every quality yields voicings in some family', async () => {
  const { familiesFor } = await import('../js/voicings.js');
  for (const q of Object.values(QUALITY_BY_ID)) {
    const fams = familiesFor(q);
    const total = fams.flatMap((f) => f.groups.flatMap((g) => buildGroup('A', q, g))).length;
    assert.ok(total > 0, q.id);
  }
});

test('template shapes: G major + manipulation to Gmaj7 / Gm', () => {
  const g = groupById('caged');
  const maj = buildGroup('G', QUALITY_BY_ID.maj, g).map((v) => v.inversionName + ' ' + fr(v));
  assert.ok(maj.includes('G shape 3 2 0 0 0 3'), maj.join(' | '));
  assert.ok(maj.includes('E shape 3 5 5 4 3 3'), maj.join(' | '));
  const m = buildGroup('G', QUALITY_BY_ID.min, g).map(fr);
  assert.ok(m.includes('3 5 5 3 3 3'), m.join(' | '));
  const m7 = buildGroup('C', QUALITY_BY_ID.maj7, g).map(fr);
  assert.ok(m7.includes('x 3 2 0 0 0'), m7.join(' | '));
});
