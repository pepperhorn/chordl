// Feasibility spike: can we GENERATE playable shapes for an arbitrary tuning?
const TUNINGS = {
  "standard  E A D G B E": [40,45,50,55,59,64],
  "drop D    D A D G B E": [38,45,50,55,59,64],
  "DADGAD    D A D G A D": [38,45,50,55,57,62],
  "open G    D G D G B D": [38,43,50,55,59,62],
  "open D    D A D F# A D": [38,45,50,54,57,62],
  "Joni C#GDFC#D (Hejira)": [37,43,50,53,61,62],
};
const PC = { C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11 };
const chord = (root, ivs) => new Set(ivs.map(i => (PC[root]+i)%12));

function generate(openMidi, pcs, { maxSpan = 4, maxFret = 14, minNotes = 3 } = {}) {
  const out = [];
  for (let base = 0; base <= maxFret; base++) {
    // per string: muted, or any fret in [base, base+maxSpan] sounding a chord tone
    const opts = openMidi.map(open => {
      const o = [-1];
      for (let f = base; f <= base + maxSpan; f++) {
        if (f === 0 || base === 0 ? true : f >= base) {
          if (pcs.has((open + f) % 12)) o.push(f);
        }
      }
      if (base > 0 && pcs.has(open % 12)) o.push(0); // open strings always available
      return o;
    });
    const combo = [];
    (function walk(i, picked) {
      if (i === opts.length) {
        const sounding = picked.filter(f => f >= 0);
        if (sounding.length < minNotes) return;
        const fretted = sounding.filter(f => f > 0);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > maxSpan) return;
        const midi = picked.map((f,ix) => f < 0 ? null : openMidi[ix] + f).filter(m => m !== null);
        const got = new Set(midi.map(m => m % 12));
        if (got.size !== pcs.size) return;               // must spell the whole chord
        combo.push({ frets: [...picked], midi, fretted: fretted.length });
        return;
      }
      for (const f of opts[i]) walk(i + 1, [...picked, f]);
    })(0, []);
    out.push(...combo);
  }
  // dedupe by sounding pitch set — the same machinery duplicateVoicingMap uses
  const seen = new Set(), uniq = [];
  for (const c of out) { const k = c.midi.join(","); if (!seen.has(k)) { seen.add(k); uniq.push(c); } }
  return uniq;
}

const D = chord("D", [0,4,7]);
console.log("D major triad, shapes spelling all three tones, span<=4, frets 0-14\n");
for (const [name, t] of Object.entries(TUNINGS)) {
  const all = generate(t, D);
  const easy = all.filter(c => c.fretted <= 3);
  console.log(name.padEnd(26), "unique voicings:", String(all.length).padStart(5),
              "| <=3 fretted fingers:", String(easy.length).padStart(4),
              "| open-string shapes:", all.filter(c => c.fretted === 0).length);
}

// timing + a denser chord
const t0 = process.hrtime.bigint();
let total = 0;
for (const t of Object.values(TUNINGS)) total += generate(t, D).length;
const t1 = process.hrtime.bigint();
console.log(`\n6 tunings, ${total} voicings, ${(Number(t1-t0)/1e6).toFixed(1)}ms`);
