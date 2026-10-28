import React, { useState, useRef, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { PianoKeyboard, PianoChord, StaffNotation, ChordSheet, ProgressionView, resolveProgressionRequest, BRAVURA_GLYPHS, PETALUMA_GLYPHS, encodeChordSheet, decodeChordSheet } from "../src";
import { BoardEditor, useChordBoard, localStorageAdapter } from "@pepperhorn/chordl-board";
import "@pepperhorn/chordl-board/editor.css";
import type { StaffGlyphSet, ChordSheetData, UIThemeMode } from "../src";
import { SHOW_HINTS, HINT_SPEED } from "../src/config";
import { HINTS } from "./hints";
import packageMetadata from "../package.json";

function HintRotator() {
  const [active, setActive] = useState(0);
  const [exit, setExit] = useState<number | null>(null);
  const activeRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const outgoing = activeRef.current;
      const next = (outgoing + 1) % HINTS.length;
      activeRef.current = next;
      setExit(outgoing);
      setActive(next);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Clear exit class after transition completes
  useEffect(() => {
    if (exit === null) return;
    const t = setTimeout(() => setExit(null), HINT_SPEED * 1000 + 50);
    return () => clearTimeout(t);
  }, [exit]);

  return (
    <div className="hint-rotator" style={{ "--hint-speed": `${HINT_SPEED}s` } as React.CSSProperties}>
      {HINTS.map((hint, i) => (
        <span
          key={i}
          className={`hint-rotator__text${
            i === active ? " hint-rotator__text--active" : ""
          }${i === exit ? " hint-rotator__text--exit" : ""}`}
        >
          {hint}
        </span>
      ))}
    </div>
  );
}

export function InteractiveInput({ uiTheme, showOptions, onToggleOptions, onExportStatus }: { uiTheme: UIThemeMode; showOptions: boolean; onToggleOptions: () => void; onExportStatus?: (status: "idle" | "preparing") => void }) {
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const storage = useMemo(() => localStorageAdapter("chordl-board", {
    onError: () => setStorageWarning("This board is no longer being saved — your browser's storage is full. Everything on screen still works, but it will be gone if you reload. Use the board's JSON button to export a copy, then remove a picture or two."),
  }), []);
  const board = useChordBoard({ storage });
  return <BoardEditor board={board} uiTheme={uiTheme} initialChord="Cmaj7#5 starting on G#"
    onExportStatus={onExportStatus} storageWarning={storageWarning}
    onDismissStorageWarning={() => setStorageWarning(null)}
    header={SHOW_HINTS ? <div style={{ width: "100%", maxWidth: 640, marginBottom: 8 }}><HintRotator /></div> : undefined}>
    <button className="btn-toggle-options" onClick={onToggleOptions}
      style={{ font: "inherit", fontSize: "0.8rem", border: "1px solid var(--btn-border)", borderRadius: 20, padding: "6px 16px", background: "var(--pill-bg)", color: "var(--text-muted)", cursor: "pointer" }}>
      <span aria-hidden="true">{showOptions ? "▾" : "▸"}</span> {showOptions ? "Hide" : "Show"} examples
    </button>
  </BoardEditor>;
}

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

function App() {
  const [uiTheme, setUiTheme] = useState<UIThemeMode>("light");
  const [showOptions, setShowOptions] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "preparing">("idle");

  // Sync theme attribute to <html> so body/::before pick up CSS variables
  React.useEffect(() => {
    document.documentElement.setAttribute("data-bc-theme", uiTheme);
  }, [uiTheme]);

  return (
    <div
      data-bc-theme={uiTheme}
      style={{
        minHeight: "100vh",
        padding: "2.5rem 1.5rem",
        maxWidth: 960,
        margin: "0 auto",
        transition: "color 0.4s ease",
      }}
    >
      {/* Header */}
      <div className="fade-in" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "2.5rem",
      }}>
        <div className="app-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="./favicon-32.png" alt="" width={32} height={32} aria-hidden="true" />
          <div>
            <h1 style={{
              fontSize: "1.6rem",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              lineHeight: 1.2,
            }}>
              chordl
              <span style={{ color: "var(--accent)", fontWeight: 300 }}>.app</span>
            </h1>
            <p style={{
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              marginTop: 4,
              fontWeight: 300,
              letterSpacing: "0.01em",
            }}>
              Interactive chord visualization
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {exportStatus === "preparing" && (
            <span className="export-status-indicator" style={{
              fontSize: "0.75rem",
              color: "var(--accent)",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              animation: "fadeUp 0.3s ease both",
            }}>
              <span className="export-pulse-dot" style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "pulse 1s ease-in-out infinite",
              }} />
              Preparing .zip...
            </span>
          )}
          <PillGroup
            options={[
              { label: "Light", value: "light" as UIThemeMode },
              { label: "Dark", value: "dark" as UIThemeMode },
            ]}
            value={uiTheme}
            onChange={setUiTheme}
          />
        </div>
      </div>

      {/* Hero — no card, input floats directly */}
      <div className="fade-in fade-in-delay-1" style={{
        padding: "1.5rem 0 2rem",
      }}>
        <InteractiveInput uiTheme={uiTheme} showOptions={showOptions} onToggleOptions={() => setShowOptions((v) => !v)} onExportStatus={setExportStatus} />
      </div>

      {/* Example sections */}
      {showOptions && <div className="fade-in fade-in-delay-2">
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
      </div>}

      {/* Footer */}
      <footer className="fade-in fade-in-delay-3" style={{
        marginTop: "3rem",
        padding: "2rem 0 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        borderTop: "1px solid var(--btn-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <a href="https://creativeranges.org" target="_blank" rel="noopener noreferrer">
            <img src="./crf-header.png" alt="Creative Ranges Foundation" style={{ height: 72, opacity: 0.85 }} />
          </a>
          <a href="https://pepperhorn.com" target="_blank" rel="noopener noreferrer">
            <img src="./PH25.svg" alt="PepperHorn Music" style={{ height: 72, opacity: 0.85 }} />
          </a>
        </div>
        <p style={{
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.6,
          maxWidth: 420,
          fontWeight: 300,
        }}>
          This element created by the not-for-profit charity{" "}
          <a href="https://creativeranges.org" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Creative Ranges Foundation
          </a>{" "}
          and{" "}
          <a href="https://pepperhorn.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            PepperHorn Music
          </a>.
        </p>
        <div className="footer-meta" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)", fontSize: "0.75rem" }}>
          <a
            href="https://github.com/pepperhorn/chordl"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "inherit",
              textDecoration: "none",
              fontWeight: 400,
              transition: "color 0.2s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <span className="app-version" title="Deployed app version">v{packageMetadata.version}</span>
        </div>
      </footer>
    </div>
  );
}

// Guarded so this module can be imported (e.g. by tests exercising
// `InteractiveInput` directly) without a #root element present — the real
// dev/index.html always provides one, so this branch is a no-op in the real
// app. Do not "simplify" this back to a bare `!` — that turns a missing
// #root into a loud crash at import time for tests, but if dev/index.html
// itself is ever the one missing it, mounting nothing here would otherwise
// fail *silently*: a blank page with no console output and no clue why.
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
} else {
  console.error("chordl dev app: no #root element found in the document — nothing was mounted.");
}
