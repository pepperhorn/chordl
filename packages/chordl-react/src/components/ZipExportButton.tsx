import { useState } from "react";

export type ZipExportMode = "this" | "all";

export interface ZipExportButtonProps {
  /** Called with the chosen scope once the user picks This or All. */
  onExport: (mode: ZipExportMode) => void;
}

/**
 * The ".zip" button and its This/All popup, shared by the keyboard
 * (`VoicingVariantToggle`) and string (`GuitarChordPanel`) views so the two
 * stay identical. The host owns what gets exported; this only asks.
 */
export function ZipExportButton({ onExport }: ZipExportButtonProps) {
  const [zipMenu, setZipMenu] = useState(false);
  const choose = (mode: ZipExportMode) => {
    setZipMenu(false);
    onExport(mode);
  };

  return (
    <div className="zip-export-container" style={{ position: "relative" }}>
      <button type="button"
        className="variant-pill-zip"
        onClick={() => setZipMenu((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "12px 16px",
          border: "1px solid var(--btn-border)",
          borderRadius: 10,
          background: "var(--pill-bg)",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "0.78rem",
          fontWeight: 500,
          transition: "all 0.2s ease",
          height: 52,
          whiteSpace: "nowrap",
        }}
        title="Download .zip package"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.5 0A1.5 1.5 0 002 1.5v13A1.5 1.5 0 003.5 16h9a1.5 1.5 0 001.5-1.5V4.707A1.5 1.5 0 0013.56 3.65L10.354.44A1.5 1.5 0 009.293 0H3.5zM7 3v1h2V3H7zm0 2v1h2V5H7zm0 2v1h2V7H7zm0 2h2v2H7V9z"/>
        </svg>
        .zip
      </button>
      {zipMenu && (
        <div
          className="zip-menu"
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 6,
            display: "flex",
            gap: 4,
            padding: 4,
            background: "var(--pill-active-bg)",
            border: "1px solid var(--btn-border)",
            borderRadius: 10,
            boxShadow: "0 4px 16px var(--glass-shadow)",
            zIndex: 10,
          }}
        >
          <button type="button"
            className="zip-menu-btn"
            onClick={() => choose("this")}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.8rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
          >
            This
          </button>
          <button type="button"
            className="zip-menu-btn"
            onClick={() => choose("all")}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.8rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
