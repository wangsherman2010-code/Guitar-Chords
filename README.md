# Chord Compass

A guitar chord practice app (PWA) for jazz guitar. Pick a root and a chord type to see:

- **Fretboard map:** every chord tone on frets 0–15, colour-coded and labelled R · 3 · 5 · 7 · 9 … (or note names). Tap a degree to hide it, and switch on a faint major-scale map for scale-degree counting.
- **Voicings & inversions:** chord diagrams with the degree of each note, plus ASCII tab.
  - *Jazz Comping (book shapes):* drop 3 with 6th-string bass, drop 2 with 5th- and 4th-string bass, all four inversions (from *Jazz Comping Mastery 1*)
  - Drop 2 / drop 3 on every string set, shell voicings (R-3-7), close triads
  - *5 template shapes (C-A-G-E-D):* changed automatically to fit the selected chord type (from *Chords on Command*, series 6)
  - **Chord-quality cycle:** maj7 → 7 → m7 → m7♭5 → °7 from the same root and inversion
- **Sound:** strum or arpeggiate any shape. "Hear intervals" plays the root together with each chord tone.
- **Voice leading:** type a progression (e.g. `Dm7 G7 Cmaj7`) and the app picks voicings with the smallest movement. Presets include Autumn Leaves, Blue Bossa, F blues and rhythm changes.
- **Practice tab:** presets for the exercises in both books.
- **Practice bar:** metronome plus the C → A → G → E → D practice roots.

Works offline after the first visit, and can be installed to the home screen.

## Run locally

```
python3 -m http.server 8000
# open http://localhost:8000
```

No build step. Plain HTML, CSS and ES modules.

## Tests

```
node --test tests/
```

## Deploy (GitHub Pages)

Repository **Settings → Pages → Deploy from a branch**, then pick the branch and `/ (root)`.
After changing files, bump `VERSION` in `sw.js` so installed copies update.
