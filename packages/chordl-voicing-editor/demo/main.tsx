import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { FrettedEditor, KeyboardSpeller, canUse } from "../src";
import type { EditorChecks } from "../src";
import type { Voicing } from "@pepperhorn/chordl-voicing";
import "../src/editor.css";
function App() {
  const [keyboard, setKeyboard] = useState(false);
  const [checks, setChecks] = useState<EditorChecks>();
  const change = useCallback(
    (_v: Voicing | null, c: EditorChecks) => setChecks(c),
    [],
  );
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "auto",
        padding: 8,
        fontFamily: "system-ui",
      }}
    >
      <h1>Build Cmaj7</h1>
      <button type="button" onClick={() => setKeyboard(!keyboard)}>
        Switch to {keyboard ? "strings" : "keyboard"}
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          throw new Error("Editor submitted host form");
        }}
      >
        {keyboard ? (
          <KeyboardSpeller
            chord="Cmaj7"
            face="keyboard-hands"
            onChange={change}
          />
        ) : (
          <FrettedEditor chord="Cmaj7" face="guitar" onChange={change} />
        )}
        <button type="button" disabled={!checks || !canUse(checks)}>
          Use this voicing
        </button>
      </form>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
