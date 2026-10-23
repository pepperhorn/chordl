/**
 * Demo of @pepperhorn/chordl-cards' ChordCardPlayer: every face the decks
 * print, for three chords. Served by the playground dev server at /cards.html
 * (`pnpm dev`); not part of the chordl.app site build.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ChordCardPlayer, fullChordName, parseTheme, qualityLabelFor, rootOf, type CardFace } from "@pepperhorn/chordl-cards";
// The print theme, as chordcards ships it (kept with chordl-cards' tests).
import rawTheme from "../../chordl-cards/test/fixtures/crf-default.json";

const theme = parseTheme(rawTheme);
const CHORDS = ["C", "F#m7", "Ebmaj7"];
const FACES: Array<{ face: CardFace; label: string }> = [
  { face: "keyboard-hands", label: "Exploded triad" },
  { face: "keyboard", label: "Keyboard" },
  { face: "guitar-top3", label: "Guitar — top 3" },
];

function CardsDemo() {
  return (
    <main className="cards-demo" style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 64px" }}>
      <h1 className="cards-demo-title" style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>ChordCardPlayer</h1>
      <p className="cards-demo-subtitle" style={{ margin: "0 0 24px", color: "#5a5651" }}>
        @pepperhorn/chordl-cards — the faces the printed decks carry, playable.
      </p>
      {CHORDS.map((chord) => (
        <section key={chord} className="cards-demo-chord" style={{ marginBottom: 40 }}>
          <h2 className="cards-demo-chord-title" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px" }}>
            {rootOf(chord)}<span className="cards-demo-quality" style={{ fontWeight: 600 }}> {qualityLabelFor(chord)}</span>
          </h2>
          <p className="cards-demo-full-name" style={{ margin: "0 0 16px", color: "#5a5651" }}>{fullChordName(chord)}</p>
          <div className="cards-demo-faces" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {FACES.map(({ face, label }) => (
              <figure
                key={face}
                className={`cards-demo-face cards-demo-face--${face}`}
                style={{ margin: 0, padding: 16, border: "1.5px solid #dcd9d3", borderRadius: 14 }}
              >
                <figcaption className="cards-demo-face-label" style={{ fontWeight: 600, marginBottom: 12 }}>{label}</figcaption>
                <ChordCardPlayer chord={chord} face={face} theme={theme} />
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<CardsDemo />);
