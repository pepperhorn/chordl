import React from "react";
import type { ChordSheetProps } from "../types";
import type { ChordData, SectionData, DisplayDefaults } from "@better-chord/core";
import { resolveDefaults, chordRef } from "@better-chord/core";
import { PianoChord } from "./PianoChord";
import { UIThemeProvider, resolveUITheme } from "../ui-theme";

/**
 * Determine how many chords per row based on count.
 * Reuses the same logic as ChordGroup.
 */
function chordsPerRow(count: number): number {
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 3) return 2;
  return 4;
}

/** Error boundary that isolates a single chord from crashing the sheet. */
class ChordErrorBoundary extends React.Component<
  { chordRef: string; children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bc-chord-sheet__chord-error" style={{
          padding: "8px 12px",
          fontSize: "0.75rem",
          color: "#c0392b",
          textAlign: "center",
        }}>
          {this.props.chordRef}: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

export function ChordSheet({ data, printMode, uiTheme, className, style }: ChordSheetProps) {
  const sectionCount = data.sections.length;

  const content = (
    <div
      className={`bc-chord-sheet${className ? ` ${className}` : ""}`}
      style={style}
    >
      {data.heading && (
        <h2 className="bc-chord-sheet__heading" style={{
          margin: "0 0 4px",
          fontSize: "1.3rem",
          fontWeight: 600,
        }}>
          {data.heading}
        </h2>
      )}
      {data.subheading && (
        <p className="bc-chord-sheet__subheading" style={{
          margin: "0 0 16px",
          fontSize: "0.85rem",
          opacity: 0.7,
        }}>
          {data.subheading}
        </p>
      )}

      {data.sections.map((section, si) => (
        <SectionRenderer
          key={section.id ?? si}
          section={section}
          sectionIndex={si}
          sectionCount={sectionCount}
          sheetDefaults={data.defaults}
          printMode={printMode}
          uiTheme={uiTheme}
        />
      ))}
    </div>
  );

  if (!uiTheme) return content;
  const uiCtx = resolveUITheme(uiTheme);
  return <UIThemeProvider value={uiCtx}>{content}</UIThemeProvider>;
}

function SectionRenderer({
  section,
  sectionIndex,
  sectionCount,
  sheetDefaults,
  printMode,
  uiTheme,
}: {
  section: SectionData;
  sectionIndex: number;
  sectionCount: number;
  sheetDefaults?: DisplayDefaults;
  printMode?: boolean;
  uiTheme?: string;
}) {
  const perRow = chordsPerRow(section.chords.length);

  return (
    <section className="bc-chord-sheet__section" style={{ marginBottom: 24 }}>
      {section.heading && (
        <h3 className="bc-chord-sheet__section-heading" style={{
          margin: "0 0 2px",
          fontSize: "1rem",
          fontWeight: 600,
        }}>
          {section.heading}
        </h3>
      )}
      {section.subheading && (
        <p className="bc-chord-sheet__section-subheading" style={{
          margin: "0 0 8px",
          fontSize: "0.8rem",
          opacity: 0.65,
        }}>
          {section.subheading}
        </p>
      )}
      {section.textAbove && (
        <div className="bc-chord-sheet__text--above" style={{
          marginBottom: 8,
          fontSize: "0.85rem",
          whiteSpace: "pre-wrap",
        }}>
          {section.textAbove}
        </div>
      )}

      <div
        className="bc-chord-sheet__grid"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        {section.chords.map((chord, ci) => {
          const ref = chordRef(sectionIndex, ci, sectionCount, section.id);
          const resolved = resolveDefaults(sheetDefaults, section.defaults, chord);

          return (
            <div
              key={ci}
              className="bc-chord-sheet__chord"
              style={{
                textAlign: "center",
                flex: `0 1 calc(${100 / perRow}% - ${((perRow - 1) * 12) / perRow}px)`,
                minWidth: 0,
              }}
            >
              {!printMode && (
                <span className="bc-chord-sheet__chord-ref" style={{
                  display: "inline-block",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  opacity: 0.45,
                  marginBottom: 2,
                }}>
                  {ref}
                </span>
              )}
              {chord.chordHeading && (
                <div className="bc-chord-sheet__chord-heading" style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: 2,
                }}>
                  {chord.chordHeading}
                </div>
              )}
              <ChordErrorBoundary chordRef={ref}>
                <ChordRenderer chord={chord} resolved={resolved} uiTheme={uiTheme} />
              </ChordErrorBoundary>
              {chord.annotationText && (
                <div className="bc-chord-sheet__annotation" style={{
                  fontSize: "0.75rem",
                  opacity: 0.6,
                  marginTop: 2,
                  whiteSpace: "pre-wrap",
                }}>
                  {chord.annotationText}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {section.textBelow && (
        <div className="bc-chord-sheet__text--below" style={{
          marginTop: 8,
          fontSize: "0.85rem",
          whiteSpace: "pre-wrap",
        }}>
          {section.textBelow}
        </div>
      )}
    </section>
  );
}

function ChordRenderer({
  chord,
  resolved,
  uiTheme,
}: {
  chord: ChordData;
  resolved: Required<import("@better-chord/core").DisplayDefaults>;
  uiTheme?: string;
}) {
  return (
    <PianoChord
      chord={chord.chord}
      format={resolved.format}
      theme={resolved.theme}
      highlightColor={resolved.highlightColor}
      padding={resolved.padding}
      scale={resolved.scale}
      display={resolved.display}
      uiTheme={uiTheme as any}
    />
  );
}
