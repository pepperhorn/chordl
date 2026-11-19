import { render, waitFor } from "@testing-library/react";
import { it, expect } from "vitest";
import { ChordCardPlayer } from "../src/ChordCardPlayer";
import { parseTheme } from "../src/theme";
import json from "../themes/crf-default.json";
import { requestFor } from "../src/faces";
import type { CardFace } from "../src/faces";
import { requestForVoicing, voicingFromRequest } from "../src/voicing";
const theme = parseTheme(json);
it("renders identical SVG on all six faces and six chords after conversion", async () => {
  for (const face of [
    "keyboard",
    "keyboard-hands",
    "guitar",
    "guitar-top3",
    "ukulele",
    "bass4",
  ] as CardFace[])
    for (const chord of ["C", "G", "Am", "F", "D7", "Em"]) {
      const original = requestFor(chord, face, theme);
      const converted = requestForVoicing(
        chord,
        voicingFromRequest(chord, original, face),
        face,
        theme,
      );
      const renderSvg = async (request: typeof original) => {
        const view = render(
          <ChordCardPlayer
            chord={chord}
            face={face}
            theme={theme}
            request={request}
          />,
        );
        await waitFor(() =>
          expect(view.container.querySelector("svg")).not.toBeNull(),
        );
        const svg = view.container.querySelector("svg")!.outerHTML;
        view.unmount();
        return svg;
      };
      expect(await renderSvg(converted), `${chord} ${face}`).toBe(
        await renderSvg(original),
      );
    }
}, 30000);
