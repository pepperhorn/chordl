import React, { useState, useRef, useEffect } from "react";
import { PianoKeyboard, PianoChord, StaffNotation, ChordSheet, ProgressionView, resolveProgressionRequest, BRAVURA_GLYPHS, PETALUMA_GLYPHS, encodeChordSheet, decodeChordSheet } from "../src";
import type { StaffGlyphSet, ChordSheetData, UIThemeMode } from "../src";
import { PillGroup } from "./PillGroup";

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [open]);

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        className="collapsible-header"
        onClick={() => setOpen(!open)}
      >
        <span
          className="collapsible-arrow"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          &#9654;
        </span>
        {title}
      </div>
      <div
        ref={contentRef}
        className="collapsible-body"
        style={{
          maxHeight: open ? height : 0,
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const GLYPH_OPTIONS: { label: string; value: StaffGlyphSet }[] = [
  { label: "Bravura", value: BRAVURA_GLYPHS },
  { label: "Petaluma", value: PETALUMA_GLYPHS },
];

function StaffNotationDemo({ uiTheme }: { uiTheme: UIThemeMode }) {
  const [glyphs, setGlyphs] = useState<StaffGlyphSet>(BRAVURA_GLYPHS);

  return (
    <>
      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
        <PillGroup
          label="Font"
          options={GLYPH_OPTIONS.map((o) => ({ label: o.label, value: o.label }))}
          value={glyphs.name}
          onChange={(name) => {
            const found = GLYPH_OPTIONS.find((o) => o.label === name);
            if (found) setGlyphs(found.value);
          }}
        />
      </div>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <div className="glass-card">
          <span className="example-label">Staff: Cmaj7 ({glyphs.name})</span>
          <StaffNotation notes={["C", "E", "G", "B"]} chordLabel="Cmaj7" scale={0.7} glyphs={glyphs} />
        </div>
        <div className="glass-card">
          <span className="example-label">Staff: Dm7 ({glyphs.name})</span>
          <StaffNotation notes={["D", "F", "A", "C"]} chordLabel="Dm7" scale={0.7} glyphs={glyphs} />
        </div>
        <div className="glass-card">
          <span className="example-label">Staff: G7 ({glyphs.name})</span>
          <StaffNotation notes={["G", "B", "D", "F"]} chordLabel="G7" scale={0.7} glyphs={glyphs} />
        </div>
      </div>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <div className="glass-card">
          <span className="example-label">Both: Cmaj7</span>
          <PianoChord chord="Cmaj7" display="both" uiTheme={uiTheme} />
        </div>
        <div className="glass-card">
          <span className="example-label">Grand staff — Cmaj7/G ({glyphs.name})</span>
          <StaffNotation notes={["G", "C", "E", "G", "B"]} lhNotes={["G"]} lhOctave={2} rhOctave={4} chordLabel="Cmaj7/G" scale={0.7} glyphs={glyphs} />
        </div>
      </div>
    </>
  );
}

const SAMPLE_SHEET: ChordSheetData = {
  v: "1.0",
  heading: "ii-V-I Worksheet",
  subheading: "Shell voicings in common keys",
  defaults: { scale: 0.5, format: "compact" },
  sections: [
    {
      heading: "Key of C",
      textAbove: "Play each chord with LH root, RH shell",
      chords: [
        { chord: "Dm7", chordHeading: "ii", annotationText: "shell" },
        { chord: "G7", chordHeading: "V" },
        { chord: "Cmaj7", chordHeading: "I" },
      ],
      textBelow: "Repeat in all 12 keys",
    },
    {
      heading: "Key of F",
      chords: [
        { chord: "Gm7", chordHeading: "ii" },
        { chord: "C7", chordHeading: "V" },
        { chord: "Fmaj7", chordHeading: "I" },
      ],
    },
  ],
};

function ChordSheetDemo({ uiTheme }: { uiTheme: UIThemeMode }) {
  const [token, setToken] = useState("");
  const [importToken, setImportToken] = useState("");
  const [importedSheet, setImportedSheet] = useState<ChordSheetData | null>(null);
  const [codecError, setCodecError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const t = await encodeChordSheet(SAMPLE_SHEET);
      setToken(t);
      setCodecError(null);
    } catch (e: any) {
      setCodecError(e?.message ?? String(e));
    }
  };

  const handleImport = async () => {
    try {
      const data = await decodeChordSheet(importToken || token);
      setImportedSheet(data);
      setCodecError(null);
    } catch (e: any) {
      setCodecError(e?.message ?? String(e));
    }
  };

  return (
    <>
      <div className="glass-card" style={{ marginBottom: "1rem" }}>
        <span className="example-label">ChordSheet — structured worksheet</span>
        <ChordSheet data={SAMPLE_SHEET} uiTheme={uiTheme} />
      </div>

      <div className="glass-card" style={{ marginBottom: "1rem" }}>
        <span className="example-label">Snapshot Codec</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button onClick={handleExport} style={{ fontSize: "0.8rem", padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--btn-bg)", color: "var(--text)", cursor: "pointer" }}>
            Export Token
          </button>
          <button onClick={handleImport} style={{ fontSize: "0.8rem", padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--btn-bg)", color: "var(--text)", cursor: "pointer" }}>
            Import Token
          </button>
        </div>
        {token && (
          <div style={{ marginBottom: 8 }}>
            <textarea
              value={token}
              readOnly
              rows={3}
              style={{ width: "100%", fontSize: "0.7rem", fontFamily: "monospace", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg, #fff)", color: "var(--text)" }}
            />
          </div>
        )}
        <input
          type="text"
          value={importToken}
          onChange={(e) => setImportToken(e.target.value)}
          placeholder="Paste a bcs1.* token to import..."
          style={{ width: "100%", fontSize: "0.8rem", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg, #fff)", color: "var(--text)" }}
        />
        {codecError && <p style={{ color: "var(--error)", fontSize: "0.8rem", margin: "4px 0 0" }}>{codecError}</p>}
        {importedSheet && (
          <div style={{ marginTop: 12 }}>
            <span className="example-label">Imported Sheet</span>
            <ChordSheet data={importedSheet} uiTheme={uiTheme} />
          </div>
        )}
      </div>
    </>
  );
}

export default function Examples({ uiTheme }: { uiTheme: UIThemeMode }) {
  return (
      <div className="fade-in fade-in-delay-2">
        <Collapsible title="Define Your Look & Feel">
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">highlightKeys=["C","E","G"]</span>
              <PianoKeyboard highlightKeys={["C", "E", "G"]} uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">F#m7 · startFrom="E" size={"{6}"}</span>
              <PianoKeyboard
                highlightKeys={["F#", "A", "C#", "E"]}
                startFrom="E"
                size={6}
                uiTheme={uiTheme}
              />
            </div>
            <div className="glass-card">
              <span className="example-label">startFrom="G" size={"{10}"} format="exact"</span>
              <PianoKeyboard startFrom="G" size={10} format="exact" uiTheme={uiTheme} />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">Boomwhacker · chord="C"</span>
              <PianoChord chord="C" theme="boomwhacker" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">Simple · chord="C"</span>
              <PianoChord chord="C" theme="simple" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">Custom · highlightColor="#ff6b6b"</span>
              <PianoChord chord="Am" highlightColor="#ff6b6b" uiTheme={uiTheme} />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">Note Names · base</span>
              <PianoChord chord="Cmaj7 with note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">Note Names · lg</span>
              <PianoChord chord="Cmaj7 with note names in lg" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">Note Names · xl</span>
              <PianoChord chord="Cmaj7 with note names in xl" uiTheme={uiTheme} />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">MIDI Names · base</span>
              <PianoChord chord="Cmaj7 midi note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">MIDI Names · lg</span>
              <PianoChord chord="Cmaj7 show midi names in lg" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">MIDI Names · xl</span>
              <PianoChord chord="Cmaj7 show midi names in xl" uiTheme={uiTheme} />
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Chord Strings">
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">chord="Cmaj7"</span>
              <PianoChord chord="Cmaj7" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">chord="Cmaj7#5 starting on G#"</span>
              <PianoChord chord="Cmaj7#5 starting on G#" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">chord="D minor seventh 1st inversion"</span>
              <PianoChord chord="D minor seventh in first inversion" uiTheme={uiTheme} />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">"with notes C E G B" — inferred octaves</span>
              <PianoChord chord="with notes C E G B with note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">"with notes E4 G4 C5 E5" — explicit octaves</span>
              <PianoChord chord="with notes E4 G4 C5 E5 with note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">"notes C E G in lh"</span>
              <PianoChord chord="notes C E G in lh with note names" uiTheme={uiTheme} />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">title + subheading + footer</span>
              <PianoChord
                chord="Cmaj7 with note names"
                title="Verse 1"
                subheading="warm voicing"
                footerText="pp legato"
                uiTheme={uiTheme}
              />
            </div>
            <div className="glass-card">
              <span className="example-label">title only (overrides default)</span>
              <PianoChord chord="Dm7" title="ii of C" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">footer below note names + fingering</span>
              <PianoChord
                chord="G7 with note names with fingerings"
                footerText="walk down to Cmaj7"
                uiTheme={uiTheme}
              />
            </div>
          </div>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <div className="glass-card">
              <span className="example-label">"notes C E G in the bass clef"</span>
              <PianoChord chord="notes C E G in the bass clef with note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">"notes E G B in the treble clef"</span>
              <PianoChord chord="notes E G B in the treble clef with note names" uiTheme={uiTheme} />
            </div>
            <div className="glass-card">
              <span className="example-label">Paired: bass clef + treble clef</span>
              <PianoChord
                chord="notes C E G in the bass clef and notes B D F in the treble clef with note names"
                uiTheme={uiTheme}
              />
            </div>
          </div>
        </Collapsible>

        <Collapsible title="Staff Notation">
          <StaffNotationDemo uiTheme={uiTheme} />
        </Collapsible>

        <Collapsible title="ChordSheet">
          <ChordSheetDemo uiTheme={uiTheme} />
        </Collapsible>

        <Collapsible title="Progressions">
          <div className="glass-card" style={{ marginBottom: "1rem" }}>
            <span className="example-label">ii-V-I in G — 3 voicing styles</span>
            <ProgressionView
              result={resolveProgressionRequest({
                progression: "ii-V-I",
                key: "G",
                numExamples: 3,
              })}
              uiTheme={uiTheme}
            />
          </div>
          <div className="glass-card" style={{ marginBottom: "1rem" }}>
            <span className="example-label">Blues in Bb — Bill Evans style</span>
            <ProgressionView
              result={resolveProgressionRequest({
                progression: "blues",
                key: "Bb",
                numExamples: 1,
                styleHint: "Bill Evans",
              })}
              showPlayback={false}
              uiTheme={uiTheme}
            />
          </div>
        </Collapsible>
      </div>
  );
}
