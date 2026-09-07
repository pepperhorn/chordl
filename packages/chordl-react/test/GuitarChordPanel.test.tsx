import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";
import {
  lookupGuitarChord,
  INSTRUMENTS,
  positionFacts,
  rootPitchClass,
  selectForExperience,
} from "@pepperhorn/chordl-guitar";

/** The Guitar/Ukulele pills are the first button row in the panel. */
function instrumentButtons(container: HTMLElement) {
  const guitar = within(container).getByText("Guitar").closest("button")!;
  const ukulele = within(container).getByText("Ukulele").closest("button")!;
  return { guitar, ukulele };
}

/** Alternate-placement buttons are labelled A/B/C… plus a "fret N" caption. */
function positionButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).filter((b) =>
    /^fret \d+$/.test(b.querySelectorAll("span")[1]?.textContent ?? ""),
  );
}

describe("GuitarChordPanel", () => {
  it("renders a diagram and the instrument toggle for a known chord", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
    const { guitar, ukulele } = instrumentButtons(container);
    expect(guitar.dataset.active).toBe("true");
    expect(ukulele.dataset.active).toBe("false");
  });

  it("shows a notice in scale mode instead of a diagram", () => {
    const { container } = render(<GuitarChordPanel chord="C major scale" />);
    expect(container.textContent).toContain("switch off scale mode");
    expect(container.querySelector(".bc-guitar-chord")).toBeNull();
  });

  it("shows a notice when no chord has been entered", () => {
    const { container } = render(<GuitarChordPanel chord="" />);
    expect(container.textContent).toContain("Enter a chord");
  });

  it("keeps the instrument toggle visible when a shape is missing", () => {
    // chords-db ships no slash-bass shapes for ukulele, so C/E is guitar-only.
    const { container } = render(<GuitarChordPanel chord="C/E" instrument="ukulele" />);
    expect(container.textContent).toContain("No ukulele shape found");
    // The toggle must still render, otherwise the user is stranded.
    expect(instrumentButtons(container).guitar).toBeTruthy();
  });

  it("switches instrument when the toggle is clicked", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    fireEvent.click(instrumentButtons(container).ukulele);
    const { guitar, ukulele } = instrumentButtons(container);
    expect(ukulele.dataset.active).toBe("true");
    expect(guitar.dataset.active).toBe("false");
  });

  it("follows the instrument prop when the host changes it", () => {
    const { container, rerender } = render(
      <GuitarChordPanel chord="Am" instrument="guitar" />,
    );
    expect(instrumentButtons(container).guitar.dataset.active).toBe("true");
    rerender(<GuitarChordPanel chord="Am" instrument="ukulele" />);
    expect(instrumentButtons(container).ukulele.dataset.active).toBe("true");
  });

  it("selects an alternate placement and resets it when the chord changes", () => {
    const { container, rerender } = render(<GuitarChordPanel chord="Am" />);
    const positions = positionButtons(container);
    expect(positions.length).toBeGreaterThan(1); // Am has alternate placements

    fireEvent.click(positions[1]);
    expect(positionButtons(container)[1].dataset.active).toBe("true");

    rerender(<GuitarChordPanel chord="C" />);
    expect(positionButtons(container)[0].dataset.active).toBe("true");
  });

  it("resets the selected placement when the instrument changes", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    fireEvent.click(positionButtons(container)[1]);
    expect(positionButtons(container)[1].dataset.active).toBe("true");

    fireEvent.click(instrumentButtons(container).ukulele);
    expect(positionButtons(container)[0].dataset.active).toBe("true");
  });

  it("shows a descriptive title above the chord name, not instead of it", () => {
    const { container } = render(<GuitarChordPanel chord="Am" title="bar 1 turnaround" />);
    expect(container.querySelector(".bc-guitar-heading")?.textContent).toBe("bar 1 turnaround");
    expect(container.querySelector(".bc-guitar-chord-name")?.textContent).toBe("Am");
  });

  it("leads with the chord name when no title is given", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    expect(container.querySelector(".bc-guitar-heading")?.textContent).toBe("Am");
    expect(container.querySelector(".bc-guitar-chord-name")).toBeNull();
  });

  it("does not let svguitar draw a second copy of the chord name", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    const occurrences = (container.textContent?.match(/Am/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

/**
 * How a chord-board card renders the panel: a fixed shape, no pickers, with the
 * instrument and position supplied from the saved card.
 */
describe("GuitarChordPanel as a board card (showControls=false)", () => {
  it("draws the diagram but no instrument or position pickers", () => {
    const { container } = render(
      <GuitarChordPanel chord="Am" showControls={false} title="Am" />,
    );
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
    expect(container.textContent).toContain("Am");
    expect(positionButtons(container)).toHaveLength(0);
    expect(within(container).queryByText("Ukulele")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders the fret position it was given, not the first one", () => {
    const withDefault = render(<GuitarChordPanel chord="Am" showControls={false} />);
    const withSecond = render(
      <GuitarChordPanel chord="Am" showControls={false} position={1} />,
    );
    const fretLabel = (c: HTMLElement) =>
      c.querySelector(".bc-guitar-chord")?.textContent ?? "";
    expect(fretLabel(withSecond.container)).not.toBe(fretLabel(withDefault.container));
  });

  it("clamps an out-of-range position instead of blanking the card", () => {
    const { container } = render(
      <GuitarChordPanel chord="Am" showControls={false} position={999} />,
    );
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
  });

  it("falls back to guitar for an instrument this build does not know", () => {
    // Reachable from an imported board file or an older export.
    const { container } = render(
      // @ts-expect-error deliberately outside InstrumentId, as untrusted JSON can be
      <GuitarChordPanel chord="Am" showControls={false} instrument="theremin" />,
    );
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
  });
});

describe("GuitarChordPanel position reporting", () => {
  it("does not clobber a restored position on mount", () => {
    const onPositionChange = vi.fn();
    render(
      <GuitarChordPanel chord="Am" position={1} onPositionChange={onPositionChange} />,
    );
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  // C3 from the whole-branch review: the level filter can move the displayed
  // shape off the `position` a host asked for (or defaulted to), and that
  // used to happen silently — the screen would show one shape while a host
  // that persists `onPositionChange`'s value (a board's "Add to board"
  // payload) recorded a different one. Bm has no beginner shape at all, so a
  // beginner query widens to its two emerging shapes at indices 2 and 3,
  // excluding index 0 (the requested/default position) outright.
  it("notifies the host when the level filter displays a different shape than requested", () => {
    const result = lookupGuitarChord("Bm", "guitar")!;
    const openMidi = INSTRUMENTS.guitar.openMidi;
    const rootPc = rootPitchClass("Bm");
    const facts = result.positions.map((p) => positionFacts(p, openMidi, rootPc));
    const selection = selectForExperience(facts, { level: "beginner" });
    expect(selection.widenedFrom).toBe("beginner"); // guard: Bm really has no beginner shape
    expect(selection.indices).not.toContain(0); // guard: the requested index 0 is excluded

    const onPositionChange = vi.fn();
    render(
      <GuitarChordPanel
        chord="Bm"
        level="beginner"
        position={0}
        onPositionChange={onPositionChange}
      />,
    );
    expect(onPositionChange).toHaveBeenCalledWith(selection.indices[0]);
  });

  // CRITICAL from the whole-branch review: the drift effect above lists
  // `onPositionChange` in its dependency array but never updates `active`.
  // The ordinary React idiom for a host that doesn't feed the reported index
  // back into `position` is an inline callback — `onPositionChange={(i) =>
  // setLog(l => [...l, i])}` — which gets a fresh function identity on every
  // one of the host's own re-renders. Without a guard, each notification
  // triggers the host to re-render (a new inline identity), which re-fires
  // the effect (identity is a dependency) even though nothing about the
  // displayed shape changed, which notifies again — an infinite loop that
  // used to run until React's "Maximum update depth exceeded" guard threw.
  // Bm has no beginner shape at all (see the widen test above), so
  // level="beginner" moves the displayed shape off `active`=0 on the very
  // first render, hitting the drift effect immediately.
  it("settles instead of looping forever when the host's inline onPositionChange never feeds the index back into position", () => {
    const calls: number[] = [];
    let renders = 0;
    function Host() {
      renders++;
      // Real React state, not a vi.fn(): the setter is what makes the host
      // actually re-render on each notification, which is what regrows a
      // fresh `onPositionChange` identity and is the mechanism of the loop.
      const [, setTick] = useState(0);
      return (
        <GuitarChordPanel
          chord="Bm"
          level="beginner"
          position={0}
          onPositionChange={(i) => {
            calls.push(i);
            setTick((t) => t + 1);
          }}
        />
      );
    }
    expect(() => render(<Host />)).not.toThrow();
    // Bounded: one notification for the one divergence, not one per render
    // of a loop (the reviewer's repro logged 60 before its guard threw).
    expect(renders).toBeLessThan(10);
    expect(calls.length).toBe(1);
  });

  it("reports the index when the user picks a placement", () => {
    // The default level ("established") filters Am's positions, so the
    // second *visible* button is not necessarily index 1 in the full list.
    // Derive the expected underlying index from the same public API the
    // panel calls, rather than assuming an unfiltered identity mapping.
    const result = lookupGuitarChord("Am", "guitar")!;
    const openMidi = INSTRUMENTS.guitar.openMidi;
    const rootPc = rootPitchClass("Am");
    const facts = result.positions.map((p) => positionFacts(p, openMidi, rootPc));
    const selection = selectForExperience(facts, { level: "established", shapeClass: "any" });
    expect(selection.indices.length).toBeGreaterThan(1); // guard: needs >1 visible placement

    const onPositionChange = vi.fn();
    const { container } = render(
      <GuitarChordPanel chord="Am" onPositionChange={onPositionChange} />,
    );
    fireEvent.click(positionButtons(container)[1]);
    expect(onPositionChange).toHaveBeenCalledWith(selection.indices[1]);
  });

  it("reports the reset to 0 when the chord changes, so a host cannot drift", () => {
    const onPositionChange = vi.fn();
    const { rerender } = render(
      <GuitarChordPanel chord="Am" position={1} onPositionChange={onPositionChange} />,
    );
    onPositionChange.mockClear();
    rerender(
      <GuitarChordPanel chord="C" position={1} onPositionChange={onPositionChange} />,
    );
    expect(onPositionChange).toHaveBeenCalledWith(0);
  });

  it("reports the instrument the user switched to", () => {
    const onInstrumentChange = vi.fn();
    const { container } = render(
      <GuitarChordPanel chord="Am" onInstrumentChange={onInstrumentChange} />,
    );
    fireEvent.click(instrumentButtons(container).ukulele);
    expect(onInstrumentChange).toHaveBeenCalledWith("ukulele");
  });

  // MINOR from the whole-branch review: every button here (instrument,
  // level, and A/B/C position) omitted `type="button"`, so inside a host
  // `<form>` clicking one submits it instead of just switching state. Am's
  // default (established) has more than one visible placement, so this one
  // render exercises all three button groups.
  it("gives every button an explicit type, so a host form is not submitted by clicking one", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });
});

describe("instrument coverage", () => {
  it("offers guitar, top-3 and ukulele", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    for (const label of ["Guitar", "Guitar (top 3)", "Ukulele"]) {
      expect(within(container).getByText(label), label).toBeTruthy();
    }
  });

  it("does not offer bass, which can never return a shape", () => {
    const { container } = render(<GuitarChordPanel chord="Am" />);
    expect(within(container).queryByText(/Bass/)).toBeNull();
  });

  it("renders a top-3 voicing", () => {
    const { container } = render(<GuitarChordPanel chord="D" instrument="guitar-top3" />);
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
    expect(container.textContent).not.toContain("No guitar (top 3) shape found");
  });

  it("renders a power chord that chords-db cannot supply", () => {
    const { container } = render(<GuitarChordPanel chord="D5" />);
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
    expect(container.textContent).toContain("D5");
  });
});

describe("level control", () => {
  it("is hidden on a board card", () => {
    const { container } = render(<GuitarChordPanel chord="Am" showControls={false} />);
    expect(container.querySelectorAll(".bc-guitar-level-btn")).toHaveLength(0);
  });

  it("changes which positions are offered when the level changes", () => {
    // Am: an open shape (beginner), two barre shapes (established), and one
    // barre-free shape away from the nut (emerging) — a real multi-tier chord.
    const { container } = render(<GuitarChordPanel chord="Am" />);
    const established = positionButtons(container).length;
    fireEvent.click(within(container).getByRole("button", { name: "Beginner" }));
    const beginner = positionButtons(container).length;
    // Am has only one beginner-tier shape, so the toggle row (which needs >1
    // visible placement to appear at all) disappears entirely.
    expect(beginner).toBeLessThan(established);
  });

  /**
   * Regression for the bug the coordinator's ruling identified: the panel
   * used to derive every level from `positionFacts` alone via
   * `selectForExperience`, which can never call a top-3 shape "established"
   * (a top-3 preset never carries a barre) even when the shape's real,
   * stored level — computed on the shape itself by `levelForTop3` — says it
   * is. That made every guitar-top3 chord fail to match the default
   * "established" level and show a spurious widen notice. Cm's top-3 preset
   * is a concrete case: stored level "established", facts-derived level
   * "emerging" (see the `chordl-guitar` `experience.test.ts` test that pins
   * this exact mismatch). Passing `result.levels` to `selectForExperience`
   * must make the authoritative stored level win, so no notice appears.
   */
  it("does not widen a guitar-top3 chord whose stored level already matches", () => {
    const { container } = render(
      <GuitarChordPanel chord="Cm" instrument="guitar-top3" />,
    );
    expect(container.querySelector(".bc-guitar-chord")).toBeTruthy();
    expect(container.textContent).not.toMatch(/no established shape/i);
    // No assertion against "showing every shape instead" here: that string
    // was generated by a branch (`selectForExperience`'s dead step 4, and the
    // panel's dead `else if` mirroring it) that could never actually run —
    // asserting its absence passed vacuously regardless of correctness. Both
    // were deleted rather than kept as an untestable no-op; see
    // `chordl-guitar`'s experience.ts and this file's filterNotice comment.
  });
});
