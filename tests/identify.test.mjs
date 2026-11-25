import test from 'node:test';
import assert from 'node:assert/strict';
import { identify, candidateName } from '../js/identify.js';

const x = null;
const top = (frets) => candidateName(identify(frets).candidates[0]);
const names = (frets) => identify(frets).candidates.map(candidateName);

test('common shapes get the expected top name', () => {
  assert.equal(top([x, 3, 2, 0, 1, 0]), 'C');          // open C
  assert.equal(top([x, 3, 5, 4, 5, x]), 'Cmaj7');      // drop 2
  assert.equal(top([8, x, 9, 9, 8, x]), 'Cmaj7');      // drop 3
  assert.equal(top([10, x, 10, 10, 10, x]), 'Dm7');    // D F A C
  assert.equal(top([3, x, 3, 4, x, x]), 'G7');         // shell
  assert.equal(top([x, 0, 2, 2, 1, 0]), 'Am');
  assert.equal(top([x, 5, 7, 5, 6, x]), 'Dm7');
  assert.equal(top([x, 3, 4, 2, 4, x]), 'C°7');
});

test('alternative readings are listed', () => {
  const n = names([x, 3, 2, 2, 1, x]); // C E A C -> Am/C , C6 (no 5)
  assert.ok(n.includes('Am/C'), n.join(', '));
  const m = names([x, 3, 5, 5, 5, x]); // C G C E? -> actually C G C E = C
  assert.ok(m[0] === 'C', m.join(', '));
  const six = names([8, x, 7, 9, 8, x]); // C A E G -> C6 / Am7/C
  assert.ok(six.includes('C6') && six.includes('Am7/C'), six.join(', '));
});

test('slash chords and inversions', () => {
  const r = identify([x, x, 2, 4, 3, 5]); // E B D A
  assert.equal(candidateName(r.candidates[0]), 'E7sus4');
  const em7 = identify([x, x, 2, 4, 3, 3]); // E B D G
  assert.equal(candidateName(em7.candidates[0]), 'Em7');
  const inv = identify([x, 7, 5, 5, 5, x]); // E G C E? -> C/E
  assert.equal(candidateName(inv.candidates[0]), 'C/E');
  assert.equal(inv.candidates[0].inversion, '1st inversion');
});

test('empty and single notes', () => {
  assert.equal(identify([x, x, x, x, x, x]).candidates.length, 0);
  assert.equal(identify([x, 3, x, x, x, x]).candidates.length, 0);
});
