import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PianoChord } from "../src/components/PianoChord";

describe("PianoChord variation props", () => {
  it("calls onVariation once per render with chord context", async () => {
    const onVariation = vi.fn();
    render(<PianoChord chord="Cmaj7" onVariation={onVariation} voicingId="default" />);
    // onVariation fires in a post-render effect
    await new Promise((r) => setTimeout(r, 0));
    expect(onVariation).toHaveBeenCalledTimes(1);
    const ctx = onVariation.mock.calls[0][0];
    expect(ctx.chordSymbol).toBe("Cmaj7");
    expect(ctx.voicingId).toBe("default");
    expect(ctx.chordIndex).toBe(0);
    expect(Array.isArray(ctx.notes)).toBe(true);
    expect(typeof ctx.svgString).toBe("string");
    expect(ctx.svgString).toContain("<svg");
  });

  it("renders renderVariationExtras output as a sibling to the SVG", async () => {
    render(
      <PianoChord
        chord="Cmaj7"
        renderVariationExtras={(ctx) => (
          <div data-testid="extras">extras for {ctx.chordSymbol}</div>
        )}
      />,
    );
    const el = await screen.findByTestId("extras");
    expect(el.textContent).toBe("extras for Cmaj7");
  });

  it("is a no-op when neither prop is provided", () => {
    const { container } = render(<PianoChord chord="Cmaj7" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
