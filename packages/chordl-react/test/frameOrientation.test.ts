import { describe, expect, it, vi } from "vitest";
import { alignHorizontalFrame } from "../src/frameOrientation";

describe("horizontal frame label placement", () => {
  it.each([300, 120, 0])("keeps full labels inside the SVG at a rendered width of %s", (renderedWidth) => {
    const container = document.createElement("div");
    container.innerHTML = '<svg viewBox="0 0 400 300"><line class="bc-frame-fret" x1="40" x2="40" y1="20" y2="200" /><text class="tuning" x="380" y="20">E</text><text class="tuning" x="380" y="50">long tuning</text></svg>';
    const svg = container.querySelector("svg")!;
    const nut = container.querySelector("line")!;
    const labels = Array.from(container.querySelectorAll("text"));
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: renderedWidth } as DOMRect);
    vi.spyOn(nut, "getBBox").mockReturnValue({ x: 40, y: 20, width: 0, height: 180 } as DOMRect);
    const widths = [10, 80];
    labels.forEach((label, index) => vi.spyOn(label, "getBBox").mockReturnValue({ x: 380, y: 20, width: widths[index], height: 10 } as DOMRect));
    const originalNut = nut.outerHTML;
    alignHorizontalFrame(container);
    const [left, , width] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    const screenScale = (renderedWidth || 400) / width;
    labels.forEach((label, index) => {
      const shift = Number(label.getAttribute("transform")!.match(/translate\(([^ ]+)/)![1]);
      const labelLeft = 380 + shift;
      const labelRight = labelLeft + widths[index];
      expect(labelLeft).toBeGreaterThanOrEqual(left);
      expect(labelRight).toBeLessThan(40);
      expect((40 - labelRight) * screenScale).toBeCloseTo(7);
      expect(label.getAttribute("transform")).not.toContain("scale");
    });
    expect(nut.outerHTML).toBe(originalNut);
  });
});
