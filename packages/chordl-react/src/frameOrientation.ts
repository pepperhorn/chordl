/** Keep the nut on the left and move tuning labels beside the open/muted markers. */
export function alignHorizontalFrame(container: HTMLElement): void {
  const svg = container.querySelector("svg");
  if (!svg) return;
  // Move only tuning labels: retain the native nut-left, frets-right layout.
  const geometry = Array.from(svg.querySelectorAll<SVGGraphicsElement>(
    ".bc-frame-string, .bc-frame-fret, .open-string, line",
  ));
  const labels = Array.from(svg.querySelectorAll<SVGGraphicsElement>("text.tuning"));
  if (geometry.length === 0 || labels.length === 0) return;
  const [left, top, width, height] = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0) return;
  const frameLeft = Math.min(...geometry.map((element) => element.getBBox().x));
  const boxes = labels.map((text) => text.getBBox());
  const labelWidth = Math.max(...boxes.map((box) => box.width));
  const renderedWidth = svg.getBoundingClientRect().width || width;
  // Seven screen pixels between the names and markers, plus two at the outer
  // edge. Account for any extra viewBox width needed to fit the longest name.
  const right = left + width;
  const gapRatio = 7 / Math.max(renderedWidth, 18);
  const outerRatio = 2 / Math.max(renderedWidth, 18);
  const paddingRatio = gapRatio + outerRatio;
  const expandedLeft = Math.min(left,
    (frameLeft - labelWidth - paddingRatio * right) / (1 - paddingRatio));
  const expandedWidth = right - expandedLeft;
  const gap = expandedWidth * gapRatio;
  const labelRight = frameLeft - gap;
  labels.forEach((text, index) => {
    const box = boxes[index];
    text.setAttribute("transform", `translate(${labelRight - box.x - box.width} 0)`);
  });
  svg.setAttribute("viewBox", `${expandedLeft} ${top} ${expandedWidth} ${height}`);
}
