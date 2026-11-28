// The Tutor's course: two tracks (comping, improvisation), eight levels each.
// Explanations are original summaries. The books ("Jazz Comping Mastery 1"
// and "Chords on Command") and their videos have the full method.
//
// Step types:
//   text      { html }
//   diagrams  { caption, items: [{ symbol, group, pick?, inversion?, near?, label? }] }
//   fretboard { caption, root, tones, onlyStrings?, window? }
//   play      { label, chords?: [voicing spec], notes?: [midi], step? }
//   backing   { caption, prog, bpm, style, groups?, startFret?, toneMap?: { window }, tips? }
//   listen    { caption, targets: ['Dm7', ...] }
//   follow    { caption, exercises: [{ label, notes: ['D', 'F', ...] }] }
//   checklist { caption, items: [{ text, prog?, bpm? }] }

const II_V_I_C = ['Dm7', 'G7', ['Cmaj7', 2]];
const II_V_I_F = ['Gm7', 'C7', ['Fmaj7', 2]];
const II_V_I_BB = ['Cm7', 'F7', ['Bbmaj7', 2]];

export const TRACKS = [
  { id: 'comp', name: 'Comping', blurb: 'Chord shapes and how to move between them, so you can accompany a tune.' },
  { id: 'improv', name: 'Improvisation', blurb: 'Know the fretboard by numbers, then make lines from the chords.' },
];

export const LESSONS = [
  // =========================================================================
  // COMPING: Level 1
  // =========================================================================
  {
    id: 'comp-1', track: 'comp', level: 1,
    title: 'Shell voicings: R · 3 · 7',
    goal: 'Play a ii–V–I with three-note shells, the backbone of jazz comping.',
    steps: [
      { type: 'text', html: `
        <p>Every 7th chord gets its sound from just two notes: the <b>3rd</b> (major or minor) and the <b>7th</b>
        (major or minor). Add the <b>root</b> and you have a <b>shell</b>: three notes that clearly say
        “maj7”, “7” or “m7”.</p>
        <p>The 5th adds very little, so comping players usually leave it out. That keeps the chord light and leaves
        room for the bass and the soloist.</p>
        <p>Two shapes cover every chord:</p>
        <ul><li><b>Root on the 6th string:</b> R – 7 – 3 on strings 6, 4, 3 (mute the 5th string)</li>
        <li><b>Root on the 5th string:</b> R – 3 – 7 on strings 5, 4, 3</li></ul>` },
      { type: 'diagrams', caption: 'C shells, root on the 6th string (R–7–3). Watch which notes change.', items: [
        { symbol: 'Cmaj7', group: 'sh-6', pick: 'R73', near: 8 },
        { symbol: 'C7', group: 'sh-6', pick: 'R73', near: 8 },
        { symbol: 'Cm7', group: 'sh-6', pick: 'R73', near: 8 },
      ] },
      { type: 'diagrams', caption: 'C shells, root on the 5th string (R–3–7).', items: [
        { symbol: 'Cmaj7', group: 'sh-5', pick: 'R37', near: 3 },
        { symbol: 'C7', group: 'sh-5', pick: 'R37', near: 3 },
        { symbol: 'Cm7', group: 'sh-5', pick: 'R37', near: 3 },
      ] },
      { type: 'text', html: `
        <p><b>maj7 → 7:</b> only the 7th moves, down one fret.<br><b>7 → m7:</b> only the 3rd moves, down one fret.</p>
        <p>That's the whole secret of shells: learn one shape and the other qualities are one finger away.</p>` },
      { type: 'diagrams', caption: 'ii–V–I in C: switch between the two shapes so your hand barely moves.', items: [
        { symbol: 'Dm7', group: 'sh-5', pick: 'R37', near: 5, label: 'ii' },
        { symbol: 'G7', group: 'sh-6', pick: 'R73', near: 3, label: 'V' },
        { symbol: 'Cmaj7', group: 'sh-5', pick: 'R37', near: 3, label: 'I' },
      ] },
      { type: 'play', label: '▶ Hear the ii–V–I', chords: [
        { symbol: 'Dm7', group: 'sh-5', pick: 'R37', near: 5 },
        { symbol: 'G7', group: 'sh-6', pick: 'R73', near: 3 },
        { symbol: 'Cmaj7', group: 'sh-5', pick: 'R37', near: 3 },
      ] },
      { type: 'backing', caption: 'Play along: ii–V–I in C', prog: II_V_I_C, bpm: 80, style: 'four', groups: ['sh-6', 'sh-5'], startFret: 3,
        tips: ['First: one shell on beat 1 of each bar, and let it ring.',
          'Then: play it on all four beats, short and light (the “Freddie Green” sound).',
          'Keep your fingers touching the strings when you change: the shapes are close.'] },
      { type: 'listen', caption: 'Check yourself: play each shell and let it ring. The app listens.', targets: ['Dm7', 'G7', 'Cmaj7'] },
      { type: 'checklist', caption: 'Take it to other keys', groups: ['sh-6', 'sh-5'], startFret: 3, items: [
        { text: 'F: Gm7 – C7 – Fmaj7 (ii on the 6th string, then 5th, then 6th)', prog: II_V_I_F },
        { text: 'B♭: Cm7 – F7 – B♭maj7', prog: II_V_I_BB },
        { text: 'C again, but start the ii on the 6th string (Dm7 at fret 10)', prog: II_V_I_C },
      ] },
    ],
  },
  // =========================================================================
  // COMPING: Level 2
  // =========================================================================
  {
    id: 'comp-2', track: 'comp', level: 2,
    title: 'Drop 2 & drop 3: root position',
    goal: 'Play maj7, 7 and m7 as four-note chords from the same root in three places on the neck.',
    steps: [
      { type: 'text', html: `
        <p>Four-note voicings use all of R, 3, 5 and 7, spread over four strings so they're playable. Jazz Comping Mastery
        builds everything from three <b>templates</b>, all from the same root:</p>
        <ul><li><b>Root on the 6th string:</b> “drop 3”, strings 6-4-3-2 (5th string muted)</li>
        <li><b>Root on the 5th string:</b> “drop 2”, strings 5-4-3-2</li>
        <li><b>Root on the 4th string:</b> “drop 2”, strings 4-3-2-1</li></ul>
        <p>Same chord, three places. Learn the maj7 templates first, then change one or two notes for the other qualities.</p>` },
      { type: 'diagrams', caption: 'Cmaj7 in root position: three templates (book lesson 1).', items: [
        { symbol: 'Cmaj7', group: 'b6', inversion: 0, near: 8, label: '6th string' },
        { symbol: 'Cmaj7', group: 'b5', inversion: 0, near: 3, label: '5th string' },
        { symbol: 'Cmaj7', group: 'b4', inversion: 0, near: 10, label: '4th string' },
      ] },
      { type: 'play', label: '▶ Hear Cmaj7 in three places', chords: [
        { symbol: 'Cmaj7', group: 'b6', inversion: 0, near: 8 },
        { symbol: 'Cmaj7', group: 'b5', inversion: 0, near: 3 },
        { symbol: 'Cmaj7', group: 'b4', inversion: 0, near: 10 },
      ] },
      { type: 'diagrams', caption: 'C7: lower the 7th one fret.', items: [
        { symbol: 'C7', group: 'b6', inversion: 0, near: 8 },
        { symbol: 'C7', group: 'b5', inversion: 0, near: 3 },
        { symbol: 'C7', group: 'b4', inversion: 0, near: 10 },
      ] },
      { type: 'diagrams', caption: 'Cm7: lower the 3rd as well.', items: [
        { symbol: 'Cm7', group: 'b6', inversion: 0, near: 8 },
        { symbol: 'Cm7', group: 'b5', inversion: 0, near: 3 },
        { symbol: 'Cm7', group: 'b4', inversion: 0, near: 10 },
      ] },
      { type: 'backing', caption: 'Same chord, three places: move between the templates in time', prog: [['Cmaj7', 6]], bpm: 70, style: 'whole', groups: ['b5'],
        tips: ['Two bars on each template: 6th string → 5th string → 4th string, then back down.',
          'Aim to land the new shape exactly on beat 1.',
          'Then do the same with C7 and Cm7 (play over this backing; the colours are the same idea).'] },
      { type: 'listen', caption: 'Check yourself: play each chord (any of the three templates).', targets: ['Cmaj7', 'C7', 'Cm7'] },
      { type: 'diagrams', caption: 'Put it to use: ii–V–I with root-position templates.', items: [
        { symbol: 'Dm7', group: 'b5', inversion: 0, near: 5, label: 'ii · 5th string' },
        { symbol: 'G7', group: 'b6', inversion: 0, near: 3, label: 'V · 6th string' },
        { symbol: 'Cmaj7', group: 'b5', inversion: 0, near: 3, label: 'I · 5th string' },
      ] },
      { type: 'backing', caption: 'Play along: ii–V–I in C (charleston rhythm)', prog: II_V_I_C, bpm: 80, style: 'charleston', groups: ['b5', 'b6'], startFret: 4,
        tips: ['Charleston rhythm: hit on beat 1 and on the “and” of 2. Count “1 – 2 & – 3 – 4”.'] },
      { type: 'checklist', caption: 'Practise all three qualities on the book\'s practice roots', items: [
        { text: 'C: maj7, 7, m7 in all three templates', prog: [['Cmaj7', 2], ['C7', 2], ['Cm7', 2]] },
        { text: 'A: maj7, 7, m7 in all three templates', prog: [['Amaj7', 2], ['A7', 2], ['Am7', 2]] },
        { text: 'G: maj7, 7, m7 in all three templates', prog: [['Gmaj7', 2], ['G7', 2], ['Gm7', 2]] },
        { text: 'E: maj7, 7, m7 in all three templates', prog: [['Emaj7', 2], ['E7', 2], ['Em7', 2]] },
        { text: 'D: maj7, 7, m7 in all three templates', prog: [['Dmaj7', 2], ['D7', 2], ['Dm7', 2]] },
      ] },
    ],
  },
  // =========================================================================
  // IMPROVISATION: Level 1
  // =========================================================================
  {
    id: 'improv-1', track: 'improv', level: 1,
    title: 'The fretboard by numbers',
    goal: 'Name any note as a number of the scale (1–7), on any string. This is the language of chords and solos.',
    steps: [
      { type: 'text', html: `
        <p>The major scale is a ladder of seven steps: <b>whole, whole, half, whole, whole, whole, half</b>.
        On one string a whole step is two frets and a half step is one fret.</p>
        <p>Instead of note names, call the notes by their <b>numbers</b>: 1 2 3 4 5 6 7. Numbers work in every key,
        and chords are built from them: a maj7 chord is 1-3-5-7. When you think in numbers, the fretboard stops
        being 12 different keys and becomes one map. (Chords on Command, exercise series 1.)</p>` },
      { type: 'fretboard', caption: 'C major on the 5th (A) string: frets 3 · 5 · 7 · 8 · 10 · 12 · 14 · 15', root: 'C', tones: ['1', '2', '3', '4', '5', '6', '7'], onlyStrings: [1], window: [3, 15] },
      { type: 'play', label: '▶ Hear it: 1 to 8 and back', notes: [48, 50, 52, 53, 55, 57, 59, 60, 59, 57, 55, 53, 52, 50, 48], step: 0.35 },
      { type: 'follow', caption: 'Your turn: play it, and the app follows each note. Say the numbers out loud as you go.', exercises: [
        { label: 'Up the A string from C (fret 3): 1 → 8', notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] },
        { label: 'Back down: 8 → 1', notes: ['C', 'B', 'A', 'G', 'F', 'E', 'D', 'C'] },
      ] },
      { type: 'text', html: `
        <p>Now the same ladder from <b>any</b> starting fret. The key changes, the numbers don't.</p>
        <p>The book's first exercise: start on <b>fret 1 of the 6th string</b> (F), call it 1, and climb the scale up the string as far as
        you can. Come back down, play the <b>open string as 7</b> (E), and resolve to 1.</p>` },
      { type: 'fretboard', caption: 'F major on the low E string: 1 at fret 1, 7 is the open string', root: 'F', tones: ['1', '2', '3', '4', '5', '6', '7'], onlyStrings: [0], window: [0, 13] },
      { type: 'follow', caption: 'Play the exercise. The app follows you.', exercises: [
        { label: 'F major up the low E string: 1 → 8', notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E', 'F'] },
        { label: 'Down again, open string as 7, resolve to 1', notes: ['F', 'E', 'D', 'C', 'Bb', 'A', 'G', 'F', 'E', 'F'] },
      ] },
      { type: 'checklist', caption: 'Do it on every string (start on fret 1, open string as 7)', items: [
        { text: 'String 6 (F major)' }, { text: 'String 5 (B♭ major)' }, { text: 'String 4 (E♭ major)' },
        { text: 'String 3 (A♭ major)' }, { text: 'String 2 (C major)' }, { text: 'String 1 (F major)' },
      ] },
      { type: 'backing', caption: 'Drone: count the C major scale on any string over a held C chord', prog: [['Cmaj7', 4]], bpm: 60, style: 'whole', groups: ['b5'],
        tips: ['Start mid-string, on a random fret that is in C. Find which number it is, then go up and down from there.',
          'Stop on a note and hear its colour against the chord: 3 and 7 sound “sweet”, 4 wants to move down to 3.'] },
    ],
  },
  // =========================================================================
  // IMPROVISATION: Level 2
  // =========================================================================
  {
    id: 'improv-2', track: 'improv', level: 2,
    title: 'Chord tones: 1-3-5-7 over a ii–V–I',
    goal: 'Outline each chord of a ii–V–I with its arpeggio, without moving your hand.',
    steps: [
      { type: 'text', html: `
        <p>The strongest notes over any chord are its <b>chord tones</b>: 1, 3, 5 and 7. Great jazz lines are full of them,
        especially on the strong beats (1 and 3) and right when the chord changes.</p>
        <p>Playing a chord's notes one at a time is an <b>arpeggio</b>. We'll learn the arpeggios of a ii–V–I in C in <b>one position</b>
        (frets 2–6), so your hand stays put and you can see how the chords connect.</p>` },
      { type: 'fretboard', caption: 'Dm7 (ii): D F A C in frets 2–6', root: 'D', tones: ['1', 'b3', '5', 'b7'], window: [2, 6] },
      { type: 'fretboard', caption: 'G7 (V): G B D F in frets 2–6', root: 'G', tones: ['1', '3', '5', 'b7'], window: [2, 6] },
      { type: 'fretboard', caption: 'Cmaj7 (I): C E G B in frets 2–6', root: 'C', tones: ['1', '3', '5', '7'], window: [2, 6] },
      { type: 'play', label: '▶ Hear the three arpeggios', notes: [50, 53, 57, 60, 43, 47, 50, 53, 48, 52, 55, 59], step: 0.32 },
      { type: 'follow', caption: 'Play each arpeggio up, then down from the 7th. The app follows you.', exercises: [
        { label: 'Dm7 up: D F A C', notes: ['D', 'F', 'A', 'C'] },
        { label: 'G7 up: G B D F', notes: ['G', 'B', 'D', 'F'] },
        { label: 'Cmaj7 up: C E G B', notes: ['C', 'E', 'G', 'B'] },
        { label: 'Dm7 down from the 7th: C A F D', notes: ['C', 'A', 'F', 'D'] },
        { label: 'G7 down from the 7th: F D B G', notes: ['F', 'D', 'B', 'G'] },
        { label: 'Cmaj7 down from the 7th: B G E C', notes: ['B', 'G', 'E', 'C'] },
      ] },
      { type: 'backing', caption: 'Play along: arpeggiate the chord that is sounding', prog: II_V_I_C, bpm: 70, style: 'charleston', groups: ['b5', 'b4'], toneMap: { window: [2, 6] },
        tips: ['Quarter notes: up the arpeggio, then down. Change arpeggio exactly when the chord changes.',
          'The map below shows the current chord\'s notes in your position.'] },
      { type: 'text', html: `
        <p>Now start each bar on the <b>3rd</b> of the chord (F, then B, then E). Then try starting on the <b>7th</b> (C, then F, then B).</p>
        <p>Notice: the 7th of Dm7 (C) moves down a half step to the 3rd of G7 (B), and the 7th of G7 (F) moves down to the 3rd of Cmaj7 (E).
        Those 3rds and 7ths are the <b>guide tones</b>, the notes that “sing” the changes. That's Level 3.</p>` },
      { type: 'backing', caption: 'Play along: start each bar on the 3rd, then on the 7th', prog: II_V_I_C, bpm: 70, style: 'charleston', groups: ['b5', 'b4'], toneMap: { window: [2, 6] } },
      { type: 'checklist', caption: 'Other keys (find the same arpeggios in one position)', items: [
        { text: 'F: Gm7 – C7 – Fmaj7', prog: II_V_I_F },
        { text: 'B♭: Cm7 – F7 – B♭maj7', prog: II_V_I_BB },
      ] },
    ],
  },
];

// Upcoming levels (shown as "coming soon").
export const UPCOMING = {
  comp: ['The quality cycle (maj7 → 7 → m7 → m7♭5 → °7)', 'Inversions on each string set', 'Voice leading through ii–V–I',
    'Comping rhythms', 'Minor ii–V–i', 'Comping on tunes: Autumn Leaves, Blue Bossa, F blues'],
  improv: ['Guide tones: target the 3rds and 7ths', 'Approach notes', 'Enclosures & bebop passing notes', 'Motifs: develop a short idea',
    'Minor ii–V lines', 'Improvise on tunes'],
};
