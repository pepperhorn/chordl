/**
 * Contact sheet of generated guitar voicings, for teacher review.
 * Bundled for the browser by build-contact-sheet.mjs; every diagram is drawn
 * by chordl-react's GuitarChord from a position that went through
 * dbPositionToChord — the same path a card face takes.
 */
import { createRoot } from "react-dom/client";
import { GuitarChord } from "../../chordl-react/src/components/GuitarChord";
import { dbPositionToChord } from "../src/instruments";
import { guitarPositionFor } from "../src/guitarPosition";
import type { GeneratedPosition } from "../src/voicingGenerator";
import { sheetChords, slashChords } from "../test/fixtures/sheetCatalogue";

function gripText(p: GeneratedPosition): string {
  return p.frets
    .map((f) => (f < 0 ? "x" : f === 0 ? "0" : String(f + p.baseFret - 1)))
    .map((s) => (s.length > 1 ? `(${s})` : s))
    .join("");
}

// A deterministic spread: every 21st generated sheet chord, every 330th slash.
function pick() {
  const out: Array<{ name: string; p: GeneratedPosition }> = [];
  const take = (list: ReturnType<typeof sheetChords>, stride: number) => {
    let n = 0;
    for (const c of list) {
      const p = guitarPositionFor(c);
      if (!p || !p.generated) continue;
      if (n++ % stride === 0) out.push({ name: c.name, p });
    }
  };
  take(sheetChords(), 21);
  take(slashChords(), 330);
  return out;
}

function Sheet() {
  const items = pick();
  return (
    <main className="contact-sheet">
      <header className="contact-sheet__header">
        <h1>Generated guitar voicings — teacher review</h1>
        <p>
          {items.length} shapes from <code>generateGuitarVoicings</code>, chosen deterministically across the
          catalogue. Every shape is flagged <code>generated</code>. Check: playable fingering, sensible
          register, and that the omitted tones are acceptable.
        </p>
      </header>
      <section className="contact-sheet__grid">
        {items.map(({ name, p }) => (
          <figure className="voicing-card" key={name} data-chord={name}>
            <figcaption className="voicing-card__name">{name}</figcaption>
            <GuitarChord chord={dbPositionToChord(p, 6)} frets={5} scale={0.75} />
            <div className="voicing-card__grip">{gripText(p)}</div>
            <div className="voicing-card__meta">
              {p.omitted.length ? `omits ${p.omitted.join(", ")}` : "all tones"}
            </div>
            <div className="voicing-card__rule">{p.rule.replace(/\+/g, " · ")}</div>
          </figure>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Sheet />);
