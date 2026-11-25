// Music theory core: notes, degrees, chord qualities.
// Chord spellings follow "The Ultimate Chord Spelling List" (Chords on Command).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

// Roots offered in the picker (enharmonic spellings jazz players actually use).
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C#'];

// Standard tuning, string index 0 = 6th string (low E). MIDI numbers.
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const stringNumber = (idx) => 6 - idx; // idx 0 -> "6th string"

export function parseNote(name) {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note: ${name}`);
  const letter = LETTERS.indexOf(m[1].toUpperCase());
  let acc = 0;
  for (const ch of m[2]) acc += ch === '#' ? 1 : -1;
  return { letter, pc: (LETTER_PC[letter] + acc + 120) % 12 };
}

// Parse a degree token like "1", "b3", "#11", "bb7".
export function parseDegree(token) {
  const m = /^([#b]*)(\d+)$/.exec(token);
  if (!m) throw new Error(`Bad degree: ${token}`);
  const num = parseInt(m[2], 10);
  let acc = 0;
  for (const ch of m[1]) acc += ch === '#' ? 1 : -1;
  const step = (num - 1) % 7;
  const octave = Math.floor((num - 1) / 7);
  return { num, acc, step, semis: MAJOR_STEPS[step] + acc + 12 * octave };
}

export const degreeSemis = (token) => parseDegree(token).semis;
export const degreePc = (token) => ((degreeSemis(token) % 12) + 12) % 12;

function accidentalString(n) {
  if (n === 0) return '';
  return n > 0 ? '#'.repeat(n) : 'b'.repeat(-n);
}

// Correctly spelled note name for a degree above a root (e.g. C + bb7 = Bbb).
export function spellDegree(rootName, token) {
  const root = parseNote(rootName);
  const d = parseDegree(token);
  const letter = (root.letter + d.step) % 7;
  const targetPc = (root.pc + d.semis) % 12;
  let diff = (targetPc - LETTER_PC[letter] + 12) % 12;
  if (diff > 6) diff -= 12;
  return LETTERS[letter] + accidentalString(diff);
}

// Colour family for a degree, used for consistent colour coding everywhere.
export function degreeFamily(token) {
  const { num } = parseDegree(token);
  if (num === 1 || num === 8) return 'root';
  if (num === 3 || num === 10) return 'third';
  if (num === 5 || num === 12) return 'fifth';
  if (num === 7 || num === 14) return 'seventh';
  if (num === 6) return 'sixth';
  if (num === 2 || num === 4) return 'sus';
  if (num === 9) return 'ninth';
  if (num === 11) return 'eleventh';
  return 'thirteenth';
}

// Display label: "R" for the root (as in the exercise books), else the degree.
export const degreeLabel = (token) => (token === '1' ? 'R' : token.replace('b', '♭').replace('#', '♯').replace('♭b', '♭♭'));

// ---------------------------------------------------------------------------
// Chord qualities. `tones` = full spelling. `voice` = 4 tones used for drop-2 /
// drop-3 voicings when the chord has more than four notes (the 5th, and other
// less essential tones, are left out the way comping players usually do).
// ---------------------------------------------------------------------------
export const QUALITIES = [
  // Triads
  { id: 'maj', name: 'Major', symbol: '', group: 'Triads', tones: ['1', '3', '5'] },
  { id: 'min', name: 'Minor', symbol: 'm', group: 'Triads', tones: ['1', 'b3', '5'] },
  { id: 'dim', name: 'Diminished', symbol: '°', group: 'Triads', tones: ['1', 'b3', 'b5'] },
  { id: 'aug', name: 'Augmented', symbol: '+', group: 'Triads', tones: ['1', '3', '#5'] },
  // Sus
  { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', group: 'Sus chords', tones: ['1', '4', '5'] },
  { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', group: 'Sus chords', tones: ['1', '2', '5'] },
  // 6th
  { id: '6', name: 'Major 6', symbol: '6', group: '6th chords', tones: ['1', '3', '5', '6'] },
  { id: 'm6', name: 'Minor 6', symbol: 'm6', group: '6th chords', tones: ['1', 'b3', '5', '6'] },
  // Add
  { id: 'add9', name: 'Major add9', symbol: 'add9', group: 'Add chords', tones: ['1', '3', '5', '9'] },
  { id: 'madd9', name: 'Minor add9', symbol: 'm(add9)', group: 'Add chords', tones: ['1', 'b3', '5', '9'] },
  // 7th chords
  { id: 'maj7', name: 'Major 7', symbol: 'maj7', group: '7th chords', tones: ['1', '3', '5', '7'] },
  { id: '7', name: 'Dominant 7', symbol: '7', group: '7th chords', tones: ['1', '3', '5', 'b7'] },
  { id: 'm7', name: 'Minor 7', symbol: 'm7', group: '7th chords', tones: ['1', 'b3', '5', 'b7'] },
  { id: 'm7b5', name: 'Half-diminished (m7♭5)', symbol: 'm7♭5', group: '7th chords', tones: ['1', 'b3', 'b5', 'b7'] },
  { id: 'dim7', name: 'Diminished 7', symbol: '°7', group: '7th chords', tones: ['1', 'b3', 'b5', 'bb7'] },
  { id: '7sus4', name: 'Dominant 7 sus4', symbol: '7sus4', group: '7th chords', tones: ['1', '4', '5', 'b7'] },
  { id: '7#5', name: 'Dominant 7 ♯5', symbol: '7♯5', group: '7th chords', tones: ['1', '3', '#5', 'b7'] },
  { id: '7b5', name: 'Dominant 7 ♭5', symbol: '7♭5', group: '7th chords', tones: ['1', '3', 'b5', 'b7'] },
  { id: 'mMaj7', name: 'Minor major 7', symbol: 'm(maj7)', group: '7th chords', tones: ['1', 'b3', '5', '7'] },
  { id: 'maj7#5', name: 'Major 7 ♯5', symbol: 'maj7♯5', group: '7th chords', tones: ['1', '3', '#5', '7'] },
  // Extended
  { id: 'maj9', name: 'Major 9', symbol: 'maj9', group: 'Extended chords', tones: ['1', '3', '5', '7', '9'], voice: ['1', '3', '7', '9'] },
  { id: '69', name: 'Major 6/9', symbol: '6/9', group: 'Extended chords', tones: ['1', '3', '5', '6', '9'], voice: ['1', '3', '6', '9'] },
  { id: 'maj7#11', name: 'Major 7 ♯11', symbol: 'maj7♯11', group: 'Extended chords', tones: ['1', '3', '5', '7', '#11'], voice: ['1', '3', '7', '#11'] },
  { id: 'maj13', name: 'Major 13', symbol: 'maj13', group: 'Extended chords', tones: ['1', '3', '5', '7', '13'], voice: ['1', '3', '7', '13'] },
  { id: '9', name: 'Dominant 9', symbol: '9', group: 'Extended chords', tones: ['1', '3', '5', 'b7', '9'], voice: ['1', '3', 'b7', '9'] },
  { id: '13', name: 'Dominant 13', symbol: '13', group: 'Extended chords', tones: ['1', '3', '5', 'b7', '13'], voice: ['1', '3', 'b7', '13'] },
  { id: '7b9', name: 'Dominant 7 ♭9', symbol: '7♭9', group: 'Extended chords', tones: ['1', '3', '5', 'b7', 'b9'], voice: ['1', '3', 'b7', 'b9'] },
  { id: '7#9', name: 'Dominant 7 ♯9', symbol: '7♯9', group: 'Extended chords', tones: ['1', '3', '5', 'b7', '#9'], voice: ['1', '3', 'b7', '#9'] },
  { id: '7#11', name: 'Dominant 7 ♯11', symbol: '7♯11', group: 'Extended chords', tones: ['1', '3', '5', 'b7', '#11'], voice: ['1', '3', 'b7', '#11'] },
  { id: '7b13', name: 'Dominant 7 ♭13', symbol: '7♭13', group: 'Extended chords', tones: ['1', '3', '5', 'b7', 'b13'], voice: ['1', '3', 'b7', 'b13'] },
  { id: '7sus4b9', name: 'Dominant 7 sus4 ♭9', symbol: '7sus4♭9', group: 'Extended chords', tones: ['1', '4', '5', 'b7', 'b9'], voice: ['1', '4', 'b7', 'b9'] },
  { id: 'alt', name: 'Altered dominant (rootless)', symbol: '7alt', group: 'Extended chords', tones: ['1', '3', 'b5', '#5', 'b7', 'b9', '#9'], voice: ['3', 'b7', '#9', 'b13'] },
  { id: 'm9', name: 'Minor 9', symbol: 'm9', group: 'Extended chords', tones: ['1', 'b3', '5', 'b7', '9'], voice: ['1', 'b3', 'b7', '9'] },
  { id: 'm7b9', name: 'Minor 7 ♭9', symbol: 'm7♭9', group: 'Extended chords', tones: ['1', 'b3', '5', 'b7', 'b9'], voice: ['1', 'b3', 'b7', 'b9'] },
  { id: 'm11', name: 'Minor 11', symbol: 'm11', group: 'Extended chords', tones: ['1', 'b3', '5', 'b7', '11'], voice: ['1', 'b3', 'b7', '11'] },
];

export const QUALITY_BY_ID = Object.fromEntries(QUALITIES.map((q) => [q.id, q]));

// The five qualities cycled in Jazz Comping Mastery 1, lessons 2/4/6/8.
export const CYCLE_QUALITIES = ['maj7', '7', 'm7', 'm7b5', 'dim7'];

// Practice roots used throughout the exercise books.
export const PRACTICE_ROOTS = ['C', 'A', 'G', 'E', 'D'];

export function voiceTones(q) {
  return q.voice || q.tones;
}

export function chordSymbol(root, q) {
  return root + q.symbol;
}

// Notes of every chord tone, for a quick spelling summary.
export function spellChord(root, q) {
  return q.tones.map((t) => ({ degree: t, note: spellDegree(root, t), pc: (parseNote(root).pc + degreePc(t)) % 12 }));
}

// Major scale degrees (for the faint "scale map" overlay; Exercise Series 1).
export const MAJOR_SCALE = ['1', '2', '3', '4', '5', '6', '7'];

// ---------------------------------------------------------------------------
// Chord-symbol parser for the voice-leading progression tool.
// ---------------------------------------------------------------------------
const SUFFIXES = [
  // [regex for suffix, quality id] — order matters (longest/most specific first)
  [/^(maj7|M7|Δ7?|ma7)(#|♯)11$/, 'maj7#11'],
  [/^(maj7|M7|Δ7?)(#|♯|\+)5$|^\+maj7$|^\+M7$/, 'maj7#5'],
  [/^(maj13|M13|Δ13)$/, 'maj13'],
  [/^(maj9|M9|Δ9)$/, 'maj9'],
  [/^(maj7|M7|Δ7?|ma7|maj)$/, 'maj7'],
  [/^(m|min|-)(\(?(maj7|M7|Δ7?)\)?)$/, 'mMaj7'],
  [/^(m7b5|m7♭5|min7b5|-7b5|ø7?|h7?)$/, 'm7b5'],
  [/^(dim7|°7|o7)$/, 'dim7'],
  [/^(m11|min11|-11)$/, 'm11'],
  [/^(m7b9|m7♭9|-7b9|m7\(b9\))$/, 'm7b9'],
  [/^(m9|min9|-9)$/, 'm9'],
  [/^(m6|min6|-6)$/, 'm6'],
  [/^(m7|min7|-7|mi7)$/, 'm7'],
  [/^(madd9|m\(add9\)|-add9|-\(add9\))$/, 'madd9'],
  [/^(m|min|-|mi)$/, 'min'],
  [/^(dim|°|o)$/, 'dim'],
  [/^(aug|\+)$/, 'aug'],
  [/^(7sus4?b9|7sus4?♭9|7b9sus4?)$/, '7sus4b9'],
  [/^(7sus4?|sus7)$/, '7sus4'],
  [/^(sus4?)$/, 'sus4'],
  [/^(sus2)$/, 'sus2'],
  [/^(6\/9|69)$/, '69'],
  [/^6$/, '6'],
  [/^(add9|\(add9\))$/, 'add9'],
  [/^(7alt|alt)$/, 'alt'],
  [/^(7b13|7♭13|7\(b13\))$/, '7b13'],
  [/^(7#11|7♯11|7\(#11\))$/, '7#11'],
  [/^(7#9|7♯9|7\(#9\))$/, '7#9'],
  [/^(7b9|7♭9|7\(b9\))$/, '7b9'],
  [/^(7#5|7♯5|7\+|\+7|aug7)$/, '7#5'],
  [/^(7b5|7♭5)$/, '7b5'],
  [/^13$/, '13'],
  [/^9$/, '9'],
  [/^7$/, '7'],
  [/^$/, 'maj'],
];

export function parseChordSymbol(sym) {
  const m = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(sym.trim());
  if (!m) return null;
  const acc = m[2].replace('♯', '#').replace('♭', 'b');
  const root = m[1].toUpperCase() + acc;
  const suffix = m[3].trim();
  for (const [re, id] of SUFFIXES) {
    if (re.test(suffix)) return { root, quality: QUALITY_BY_ID[id] };
  }
  return null;
}
