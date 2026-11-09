import type { CSSProperties } from "react";

export function GuitarLoading({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`chordl-board-card-loading bc-guitar-loading ${className ?? ""}`.trim()}
    data-chordl-state="loading" role="status"
    style={{ padding: "24px 0", textAlign: "center", fontFamily: "Poppins, system-ui, sans-serif", ...style }}>
    Loading guitar shapes…
  </div>;
}
