import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { PianoKeyboard, PianoChord, VoicingVariantToggle, StaffNotation, ChordSheet, ProgressionView, isProgressionRequest, parseProgressionRequest, resolveProgressionRequest, BRAVURA_GLYPHS, PETALUMA_GLYPHS, encodeChordSheet, decodeChordSheet } from "../src";
import type { StaffGlyphSet, ChordSheetData } from "../src";
import type { UIThemeMode } from "../src";
import { SHOW_HINTS, HINT_SPEED } from "../src/config";
import { HINTS } from "./hints";

const SCALE_OPTIONS = [
  { label: "50%", value: 0.5 },
  { label: "60%", value: 0.6 },
  { label: "70%", value: 0.7 },
  { label: "80%", value: 0.8 },
  { label: "90%", value: 0.9 },
  { label: "100%", value: 1.0 },
];

const THEME_OPTIONS = [
  { label: "Simple", value: "simple" },
  { label: "CRF", value: "crf" },
  { label: "Boom", value: "boomwhacker" },
];

function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="control-item">
      {label && <span className="control-label">{label}</span>}
      <div className="control-content">
        <div className="pill-group">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              className="pill-btn"
              data-active={value === opt.value}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type DisplayMode = "keyboard" | "both" | "staff";
const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: "keyboard", label: "Diagram" },
  { value: "both", label: "Both" },
  { value: "staff", label: "Notation" },
];

function DisplayToggle({ value, onChange }: { value: DisplayMode; onChange: (v: DisplayMode) => void }) {
  const idx = DISPLAY_MODES.findIndex((m) => m.value === value);
  const next = () => onChange(DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length].value);
  const current = DISPLAY_MODES[idx];

  return (
    <div className="control-item">
      <span className="control-label">Display</span>
      <div className="control-content">
        <button
          onClick={next}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
            fontSize: "0.8rem",
            fontWeight: 500,
            padding: "6px 14px",
            border: "none",
            borderRadius: 8,
            background: "var(--pill-active-bg)",
            color: "var(--pill-active-text)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {(value === "keyboard" || value === "both") && (
            <svg width="16" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              {/* Piano keyboard icon (3 white keys + 2 black keys) */}
              <rect x="1" y="1" width="18" height="18" rx="1.5" />
              <line x1="7" y1="1" x2="7" y2="19" />
              <line x1="13" y1="1" x2="13" y2="19" />
              <rect x="5" y="1" width="3.5" height="11" rx="0.5" fill="currentColor" stroke="none" />
              <rect x="11.5" y="1" width="3.5" height="11" rx="0.5" fill="currentColor" stroke="none" />
            </svg>
          )}
          {(value === "staff" || value === "both") && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {/* Music note icon */}
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" />
              <circle cx="18" cy="16" r="3" fill="currentColor" stroke="none" />
            </svg>
          )}
          {current.label}
        </button>
      </div>
    </div>
  );
}

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

function InteractiveInput({ uiTheme, showOptions, onToggleOptions, onExportStatus }: { uiTheme: UIThemeMode; showOptions: boolean; onToggleOptions: () => void; onExportStatus?: (status: "idle" | "preparing") => void }) {
  const [input, setInput] = useState("Cmaj7#5 starting on G#");
  const [theme, setTheme] = useState<string>("simple");
  const [keyFormat, setKeyFormat] = useState<"compact" | "exact">("compact");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("keyboard");
  const [scale, setScale] = useState(0.7);
  const [highlightColor, setHighlightColor] = useState("#a0c6e8");
  const [octaveShift, setOctaveShift] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isProg = isProgressionRequest(input);

  let progressionResult = null;
  if (isProg) {
    try {
      const parsed = parseProgressionRequest(input);
      progressionResult = resolveProgressionRequest({
        progression: parsed.progression,
        key: parsed.key,
        numExamples: parsed.numExamples,
        styleHint: parsed.styleHint,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
      {/* Animated hint */}
      {SHOW_HINTS && (
        <div style={{ width: "100%", maxWidth: 640, marginBottom: 8 }}>
          <HintRotator />
        </div>
      )}

      {/* Hero input */}
      <div style={{ width: "100%", maxWidth: 640, position: "relative" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          placeholder='Tell me what chord(s) you&apos;d like to visualize..'
          style={{
            width: "100%",
            padding: "1rem 1.25rem",
            fontSize: "1.05rem",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 400,
            background: "var(--input-floating-bg)",
            border: "1px solid var(--input-floating-border)",
            borderRadius: 24,
            color: "var(--text)",
            outline: "none",
            transition: "border-color 0.25s ease, box-shadow 0.25s ease",
            boxShadow: "var(--input-floating-shadow)",
            letterSpacing: "-0.01em",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--input-focus)";
            e.currentTarget.style.boxShadow = "var(--input-floating-shadow-focus)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--input-floating-border)";
            e.currentTarget.style.boxShadow = "var(--input-floating-shadow)";
          }}
        />
        {isProg && (
          <span className="progression-indicator-tag" style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "var(--tag-bg)",
            color: "var(--tag-text)",
            padding: "3px 8px",
            borderRadius: 6,
          }}>
            Progression
          </span>
        )}
      </div>

      {/* Controls row — muted, secondary */}
      {showOptions && <div className="interactive-controls-row" style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "stretch",
        flexWrap: "wrap",
        justifyContent: "center",
        opacity: 0.55,
        transition: "opacity 0.25s ease",
      }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
        onMouseLeave={(e) => e.currentTarget.style.opacity = "0.55"}
      >
        <PillGroup
          label="Theme"
          options={THEME_OPTIONS}
          value={theme}
          onChange={setTheme}
        />
        <PillGroup
          label="Layout"
          options={[
            { label: "Compact", value: "compact" as const },
            { label: "Full", value: "exact" as const },
          ]}
          value={keyFormat}
          onChange={setKeyFormat}
        />
        <div className="control-item">
          <span className="control-label">Size</span>
          <div className="control-content">
            <div className="size-slider-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min={50}
                max={100}
                step={10}
                value={scale * 100}
                onChange={(e) => setScale(parseInt(e.target.value, 10) / 100)}
                style={{
                  width: 100,
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--pill-active-text)", minWidth: 32 }}>
                {Math.round(scale * 100)}%
              </span>
            </div>
          </div>
        </div>
        {theme === "simple" && (
          <div className="control-item">
            <span className="control-label">Color</span>
            <div className="control-content">
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                style={{
                  width: 32,
                  height: 32,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "transparent",
                  padding: 0,
                }}
              />
            </div>
          </div>
        )}
        <DisplayToggle value={displayMode} onChange={setDisplayMode} />
        <div className="control-item">
          <span className="control-label">Octave</span>
          <div className="control-content">
            <div className="octave-button-group" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                className="octave-down pill-btn"
                onClick={() => setOctaveShift((v) => v - 1)}
                style={{
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 8,
                  background: "var(--pill-bg)",
                  color: "var(--pill-text)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ▼
              </button>
              <span className="octave-shift-display" style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--pill-active-text)",
                minWidth: 24,
                textAlign: "center",
              }}>
                {octaveShift === 0 ? "–" : (octaveShift > 0 ? `+${octaveShift}` : octaveShift)}
              </span>
              <button
                className="octave-up pill-btn"
                onClick={() => setOctaveShift((v) => v + 1)}
                style={{
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 8,
                  background: "var(--pill-bg)",
                  color: "var(--pill-text)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ▲
              </button>
            </div>
          </div>
        </div>
      </div>}

      {/* Error */}
      {error && (
        <p style={{
          color: "var(--error)",
          fontSize: "0.85rem",
          fontWeight: 500,
          margin: 0,
          textAlign: "center",
        }}>
          {error}
        </p>
      )}

      {/* Chord output */}
      <div className="chord-output" style={{ width: "100%" }}>
        <ErrorBoundary key={input + theme + keyFormat + scale + highlightColor + displayMode + octaveShift} onError={setError}>
          {isProg && progressionResult ? (
            <ProgressionView result={progressionResult} theme={theme} uiTheme={uiTheme} />
          ) : (
            <VoicingVariantToggle
              chord={octaveShift === 0 ? input : `${input} chord ${octaveShift > 0 ? "up" : "down"} ${Math.abs(octaveShift)} octave${Math.abs(octaveShift) > 1 ? "s" : ""}`}
              theme={theme} format={keyFormat} scale={scale} display={displayMode}
              highlightColor={theme === "simple" ? highlightColor : undefined} uiTheme={uiTheme}
              onExportStatus={onExportStatus}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Toggle for options & examples */}
      <button
        className="btn-toggle-options"
        onClick={onToggleOptions}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "inherit",
          fontSize: "0.8rem",
          fontWeight: 400,
          padding: "6px 16px",
          border: "1px solid var(--btn-border)",
          borderRadius: 20,
          background: "var(--pill-bg)",
          color: "var(--text-muted)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          letterSpacing: "0.01em",
        }}
      >
        <span className="toggle-arrow" style={{
          display: "inline-block",
          transform: showOptions ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          fontSize: "0.65rem",
        }}>&#9654;</span>
        {showOptions ? "Hide" : "Show"} options &amp; examples
      </button>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (msg: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { this.props.onError(err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
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
        <a
          href="https://github.com/pepperhorn/chordl"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-dim)",
            textDecoration: "none",
            fontSize: "0.75rem",
            fontWeight: 400,
            transition: "color 0.2s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
