/** Default: show note names below highlighted keys. */
export const SHOW_NOTE_NAMES = false;

/** Additional valid fingering symbols beyond 1–5. */
export const FINGERING_EXTRA_SYMBOLS = ["0", "-", "x"] as const;

/** Show the rotating hint text above the input. */
export const SHOW_HINTS = true;

/** Hint slide-fade transition speed in seconds. */
export const HINT_SPEED = 0.45;

/** Arpeggiation tempo (quarter note = BPM). Each note triggers on a 16th-note grid. */
export const ARPEGGIO_BPM = 120;

/** Compute the ms delay between arpeggiated notes from BPM (16th-note subdivision). */
export function arpeggioDelayMs(bpm: number = ARPEGGIO_BPM): number {
  return 60000 / (bpm * 4);
}

export type UIThemeMode = "light" | "dark";

export interface UIThemeTokens {
  /** Primary text color */
  text: string;
  /** Muted text (labels, secondary info) */
  textMuted: string;
  /** Subtle text (voicing style, hints) */
  textSubtle: string;
  /** Border color for inputs and buttons */
  border: string;
  /** Button background (inactive) */
  btnBg: string;
  /** Button background (active/selected) */
  btnBgActive: string;
  /** Button text (inactive) */
  btnText: string;
  /** Button text (active/selected) */
  btnTextActive: string;
  /** Input/select background */
  inputBg: string;
  /** Input/select text */
  inputText: string;
  /** SVG icon fill for playback controls */
  iconFill: string;
  /** Playback button background */
  playbackBg: string;
  /** Playback button active/playing state */
  playbackActive: string;
  /** Glass tray behind playback buttons */
  playbackTrayBg: string;
  /** Glass tray border */
  playbackTrayBorder: string;
  /** Individual button border for glass edge */
  playbackBtnBorder: string;
  /** Bracket annotation color (L.H./R.H.) */
  bracketColor: string;
  /** Unhighlighted white key fill */
  whiteFill: string;
  /** Unhighlighted black key fill */
  blackFill: string;
  /** Key outline stroke */
  keyStroke: string;
}

export const LIGHT_THEME: UIThemeTokens = {
  text: "#1a1a1a",
  textMuted: "#555",
  textSubtle: "#777",
  border: "#ccc",
  btnBg: "#e8e8e8",
  btnBgActive: "#333",
  btnText: "#333",
  btnTextActive: "#fff",
  inputBg: "#fff",
  inputText: "#333",
  iconFill: "#fff",
  playbackBg: "rgba(100, 100, 115, 0.6)",
  playbackActive: "rgba(74, 144, 217, 0.85)",
  playbackTrayBg: "rgba(200, 210, 225, 0.5)",
  playbackTrayBorder: "rgba(255, 255, 255, 0.7)",
  playbackBtnBorder: "rgba(255, 255, 255, 0.45)",
  bracketColor: "#888",
  whiteFill: "#fafafa",
  blackFill: "#222222",
  keyStroke: "#333333",
};

export const DARK_THEME: UIThemeTokens = {
  text: "#eee",
  textMuted: "#aaa",
  textSubtle: "#888",
  border: "#555",
  btnBg: "rgba(255, 255, 255, 0.08)",
  btnBgActive: "rgba(57, 51, 51, 0.89)",
  btnText: "#aab2c0",
  btnTextActive: "#eef0f4",
  inputBg: "#1e1e2e",
  inputText: "#eee",
  iconFill: "#fff",
  playbackBg: "rgba(70, 70, 90, 0.7)",
  playbackActive: "rgba(74, 144, 217, 0.85)",
  playbackTrayBg: "rgba(50, 55, 75, 0.65)",
  playbackTrayBorder: "rgba(255, 255, 255, 0.18)",
  playbackBtnBorder: "rgba(255, 255, 255, 0.12)",
  bracketColor: "#999",
  whiteFill: "#2a2d35",
  blackFill: "#111118",
  keyStroke: "#555555",
};

/** Default UI theme mode. Change this to switch the library default. */
export const DEFAULT_UI_THEME: UIThemeMode = "light";

export function getUIThemeTokens(mode: UIThemeMode): UIThemeTokens {
  return mode === "dark" ? DARK_THEME : LIGHT_THEME;
}
