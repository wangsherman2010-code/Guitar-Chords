// Practice presets that set up the app for exercises in the two books.
// Descriptions are short paraphrases. The books and course videos have the full instructions.

const inv = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];

const templates = inv.map((name, i) => ({
  title: `Lesson ${1 + i * 2}: Maj7 template, ${name}`,
  desc: `The ${name} maj7 shape with bass on the 6th, 5th and 4th string, all from the same root. Move between them in time.`,
  set: { quality: 'maj7', family: 'book', group: 'all', inversion: i, cycle: false },
}));
const cycles = inv.map((name, i) => ({
  title: `Lesson ${2 + i * 2}: Quality cycle, ${name}`,
  desc: 'maj7 → 7 → m7 → m7♭5 → °7 from one root, on all three string sets.',
  set: { quality: 'maj7', family: 'book', group: 'all', inversion: i, cycle: true },
}));
const lessonOrder = [];
for (let i = 0; i < 4; i++) lessonOrder.push(templates[i], cycles[i]);

const vocab = [];
const qs = [['maj7', 'Major 7th'], ['7', 'Dominant 7th'], ['m7', 'Minor 7th'], ['m7b5', 'Half-diminished'], ['dim7', 'Diminished 7th']];
const strs = [['b6', '6th'], ['b5', '5th'], ['b4', '4th']];
let n = 9;
for (const [id, name] of qs) {
  for (const [g, s] of strs) {
    vocab.push({
      title: `Lesson ${n}: ${name} inversions, ${s}-string bass`,
      desc: `Play the four inversions up and down along the ${s} string. Open “Tab: walk these shapes up the neck” to see the sequence.`,
      set: { quality: id, family: 'book', group: g, inversion: 'all', cycle: false },
    });
    n++;
  }
}

export const PROGRESSIONS = [
  { name: 'Major ii–V–I in C', chords: 'Dm7 G7 Cmaj7 Cmaj7' },
  { name: 'Minor ii–V–i in C', chords: 'Dm7b5 G7b9 Cm6 Cm6' },
  { name: 'Autumn Leaves (A section, G minor)', chords: 'Cm7 F7 Bbmaj7 Ebmaj7 Am7b5 D7 Gm6 Gm6' },
  { name: 'Blue Bossa', chords: 'Cm7 Cm7 Fm7 Fm7 Dm7b5 G7 Cm7 Cm7 Ebm7 Ab7 Dbmaj7 Dbmaj7 Dm7b5 G7 Cm7 Dm7b5 G7' },
  { name: 'Blues in F (jazz)', chords: 'F7 Bb7 F7 Cm7 F7 Bb7 Bdim7 F7 D7 Gm7 C7 F7 D7 Gm7 C7' },
  { name: 'Rhythm changes A (Bb)', chords: 'Bbmaj7 G7 Cm7 F7 Dm7 G7 Cm7 F7' },
  { name: 'iii–vi–ii–V in C', chords: 'Em7 A7 Dm7 G7 Cmaj7' },
];

export const LESSONS = [
  {
    book: 'Jazz Comping Mastery 1: Essential Inversion Vocabulary',
    items: [
      ...lessonOrder,
      ...vocab,
      {
        title: 'Lessons 24–25: Voice leading & the comping game',
        desc: 'Autumn Leaves with 5th- and 4th-string drop-2 shapes. Each voice moves by a half step, a whole step, or stays put.',
        set: { prog: PROGRESSIONS[2].chords, progPreset: 2, progGroups: ['b5', 'b4'], tab: 'lead' },
      },
      {
        title: 'Lesson 25: Blue Bossa comping',
        desc: 'Try every string set, then limit yourself to one string set and see how close the shapes stay.',
        set: { prog: PROGRESSIONS[3].chords, progPreset: 3, progGroups: ['b6', 'b5', 'b4'], tab: 'lead' },
      },
    ],
  },
  {
    book: 'Chords on Command: exercise checklist',
    items: [
      {
        title: 'Series 1: Scale counting along one string',
        desc: 'Turn on the faint major-scale map. Pick a root and count 1–7 up and down a single string.',
        set: { quality: 'maj', scale: true, hidden: [], family: 'triads' },
      },
      {
        title: 'Series 5: Hearing intervals (3, 5, 7, 9, 11, 13)',
        desc: 'Choose a 13th chord and press “Hear intervals”. Sing each chord tone against the root.',
        set: { quality: '13', scale: true },
      },
      {
        title: 'Series 6: The five template shapes (G major)',
        desc: 'C-A-G-E-D shapes of G. Play each one, then rotate through them in time.',
        set: { root: 'G', quality: 'maj', family: 'caged', group: 'all', inversion: 'all', scale: false },
      },
      {
        title: 'Series 6-3: Template manipulation',
        desc: 'Keep “5 template shapes” selected and change the chord type. Watch which notes move: 3→♭3, root→7 and so on.',
        set: { root: 'G', quality: 'maj7', family: 'caged', group: 'all', inversion: 'all' },
      },
      {
        title: 'Series 7: Anatomy of familiar shapes',
        desc: 'Switch the labels to 1 3 5 7 and check the degree of every note in the shapes you already know.',
        set: { quality: '7', family: 'caged', labels: 'degree' },
      },
      {
        title: 'Shell voicings (R · 3 · 7)',
        desc: 'The essential chord tones only, a good first step towards comping.',
        set: { quality: '7', family: 'shell', group: 'all', inversion: 'all' },
      },
    ],
  },
];
