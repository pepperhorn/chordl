import React from "react";
import { createRoot } from "react-dom/client";
import { PianoKeyboard, PianoChord } from "../src";

function App() {
  return (
    <div>
      <h1>better-chord-react</h1>

      <h2>Explicit Props (PianoKeyboard)</h2>
      <div className="row">
        <div className="example">
          <label>C major triad: highlightKeys=["C","E","G"]</label>
          <PianoKeyboard highlightKeys={["C", "E", "G"]} />
        </div>
        <div className="example">
          <label>F#m7: highlightKeys=["F#","A","C#","E"] startFrom="E" size={6}</label>
          <PianoKeyboard
            highlightKeys={["F#", "A", "C#", "E"]}
            startFrom="E"
            size={6}
          />
        </div>
        <div className="example">
          <label>Custom size/start: startFrom="G" size={10} format="exact"</label>
          <PianoKeyboard startFrom="G" size={10} format="exact" />
        </div>
      </div>

      <h2>Chord Strings (PianoChord)</h2>
      <div className="row">
        <div className="example">
          <label>chord="Cmaj7"</label>
          <PianoChord chord="Cmaj7" />
        </div>
        <div className="example">
          <label>chord="Cmaj7#5 starting on G#"</label>
          <PianoChord chord="Cmaj7#5 starting on G#" />
        </div>
        <div className="example">
          <label>chord="D minor seventh in first inversion"</label>
          <PianoChord chord="D minor seventh in first inversion" />
        </div>
      </div>

      <h2>Themes</h2>
      <div className="row">
        <div className="example">
          <label>Boomwhacker theme: chord="C" (C major triad)</label>
          <PianoChord chord="C" theme="boomwhacker" />
        </div>
        <div className="example">
          <label>Simple theme (default): chord="C"</label>
          <PianoChord chord="C" theme="simple" />
        </div>
        <div className="example">
          <label>Custom highlight color: chord="Am" highlightColor="#ff6b6b"</label>
          <PianoChord chord="Am" highlightColor="#ff6b6b" />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
