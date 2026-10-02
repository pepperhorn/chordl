/**
 * Sketch only the neck grid. Deterministic curves keep remounts and SVG/PDF
 * exports identical, and leave finger/barre playback targets and text intact.
 * Coordinates come from SVGuitar after its orientation-aware layout.
 */
export function styleFrameLines(container: HTMLElement, horizontal: boolean, handdrawn: boolean): void {
  // SVGuitar 2.5 passes grid classes to its renderer, but the normal renderer
  // drops them. Axis-aligned lines are the grid/nut; muted Xs are diagonal.
  container.querySelectorAll<SVGLineElement>("svg line").forEach((line, index) => {
    const x1 = Number(line.getAttribute("x1"));
    const y1 = Number(line.getAttribute("y1"));
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (!length || !Number.isFinite(length)) return;
    if (dx !== 0 && dy !== 0) return;
    line.classList.add((horizontal ? dy === 0 : dx === 0) ? "bc-frame-string" : "bc-frame-fret");
    if (!handdrawn) return;
    const normalX = -dy / length;
    const normalY = dx / length;
    // Restrained drift and two fine strokes suggest pencil rather than ink.
    const bend = (index % 2 ? -1 : 1) * (0.75 + (index % 3) * 0.1);
    const point = (t: number, offset: number) =>
      `${x1 + dx * t + normalX * offset} ${y1 + dy * t + normalY * offset}`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    for (const attribute of Array.from(line.attributes)) {
      if (!["x1", "y1", "x2", "y2"].includes(attribute.name)) {
        path.setAttribute(attribute.name, attribute.value);
      }
    }
    path.setAttribute("d", `M ${x1} ${y1} C ${point(0.18, bend * 2)} ${point(0.35, -bend)} ${point(0.5, bend * 0.35)} S ${point(0.82, -bend * 1.5)} ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    const strokeWidth = Number(line.getAttribute("stroke-width")) || 2;
    path.setAttribute("stroke-width", String(strokeWidth * 0.8));
    path.setAttribute("stroke-opacity", "0.82");
    const grain = path.cloneNode() as SVGPathElement;
    grain.removeAttribute("id");
    grain.setAttribute("class", "bc-frame-pencil-grain");
    grain.setAttribute("stroke-width", String(Math.min(strokeWidth * 0.25, 0.65)));
    grain.setAttribute("stroke-opacity", "0.24");
    grain.setAttribute("transform", `translate(${normalX * 0.65} ${normalY * 0.65})`);
    grain.setAttribute("stroke-dasharray", "2.4 0.7 4.1 0.5");
    line.replaceWith(path, grain);
  });
}
