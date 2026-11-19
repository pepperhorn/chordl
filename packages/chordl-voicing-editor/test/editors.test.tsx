import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import { KeyboardSpeller, parseKeyboard } from "../src/KeyboardSpeller";
import { FrettedEditor, parseFretCode } from "../src/FrettedEditor";
import { editorChecks, canUse } from "../src/checks";
import { parsePitch } from "@pepperhorn/chordl-voicing";
import type { Voicing } from "@pepperhorn/chordl-voicing";
vi.mock("@pepperhorn/chordl-react", () => ({
  PianoChord: ({ chord, ...props }: any) => (
    <div data-testid="piano" data-chord={chord} data-theme={props.theme} />
  ),
  GuitarChord: () => (
    <svg>
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`s${i}`} className="bc-frame-string" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`f${i}`} className="bc-frame-fret" />
      ))}
    </svg>
  ),
  startPlayback: vi.fn(),
}));
it.each([
  "C maj 2nd inversion",
  "E G C",
  "E F# A B",
  "rh G C E lh C",
  "Eb Gb Bb // Db F",
])("parses and draws %s", async (text) => {
  const onChange = vi.fn();
  render(
    <KeyboardSpeller chord="C" face="keyboard-hands" onChange={onChange} />,
  );
  fireEvent.change(screen.getByLabelText("Spell a chord or notes"), {
    target: { value: text },
  });
  expect(screen.getByTestId("piano")).toBeTruthy();
  expect(onChange.mock.lastCall?.[0]).not.toBeNull();
  expect(document.querySelector(".chordl-board")).toBeNull();
});
it("assigns hands and preserves inversions", () => {
  const v = parseKeyboard("rh G C E lh C", "C", "keyboard-hands");
  expect(v.realization.kind).toBe("keyboard");
  if (v.realization.kind === "keyboard") {
    expect(v.realization.hands.left).toEqual(["C3"]);
    expect(v.realization.hands.right).toEqual(["G4", "C5", "E5"]);
  }
  const inv = parseKeyboard("C maj 2nd inversion", "C", "keyboard");
  expect(inv.notes[0].pitch).toMatch(/^G/);
  const plain = parseKeyboard("rh G C E lh C", "C", "keyboard");
  if (plain.realization.kind === "keyboard")
    expect(plain.realization.hands.left).toEqual([]);
});
it("shows unreadable text and null output", () => {
  const onChange = vi.fn();
  render(<KeyboardSpeller chord="C" face="keyboard" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Spell a chord or notes"), {
    target: { value: "nonsense gibberish" },
  });
  expect(screen.getByText(/Can't read that/)).toBeTruthy();
  expect(onChange.mock.lastCall?.[0]).toBeNull();
});
it("wrong notes fail, fifth omission and inversion only warn", () => {
  expect(
    canUse(editorChecks(parseKeyboard("C E G B", "Cmaj7", "keyboard"))),
  ).toBe(true);
  const omitted = editorChecks(parseKeyboard("C E B", "Cmaj7", "keyboard"));
  expect(canUse(omitted)).toBe(true);
  expect(omitted.flags.some((f) => f.code === "omitted-fifth")).toBe(true);
  expect(
    canUse(editorChecks(parseKeyboard("C E F# B", "Cmaj7", "keyboard"))),
  ).toBe(false);
});
it("code, fields, fingers, barre and starting fret stay in sync", () => {
  const change = vi.fn();
  render(<FrettedEditor chord="Cmaj7" face="guitar" onChange={change} />);
  fireEvent.change(screen.getByLabelText(/Fret code/), {
    target: { value: "x32000" },
  });
  let v = change.mock.lastCall![0] as Voicing;
  expect(v.realization.kind === "fretted" && v.realization.strings).toEqual([
    null,
    3,
    2,
    0,
    0,
    0,
  ]);
  expect(canUse(change.mock.lastCall![1])).toBe(true);
  fireEvent.click(screen.getByLabelText("Raise starting fret"));
  expect(
    (screen.getByLabelText("Starting fret") as HTMLInputElement).value,
  ).toBe("2");
  fireEvent.click(screen.getByText("Add barre"));
  fireEvent.change(screen.getByLabelText("Barre 1 fret"), {
    target: { value: "3" },
  });
  v = change.mock.lastCall![0];
  expect(v.realization.kind === "fretted" && v.realization.barres[0].fret).toBe(
    3,
  );
});
it.each(["ukulele", "bass4", "guitar-top3"] as const)(
  "loads %s with locked top3 strings",
  (face) => {
    render(<FrettedEditor chord="C" face={face} onChange={() => {}} />);
    if (face === "guitar-top3")
      expect(
        document.querySelectorAll(".cve-string input:disabled").length,
      ).toBe(3);
    else expect(document.querySelectorAll(".cve-string").length).toBe(4);
  },
);
it("tweak basedOn and large fret codes", () => {
  expect(parseFretCode("x 10 12 12 11 10", 6)).toEqual([
    null,
    10,
    12,
    12,
    11,
    10,
  ]);
  const initial = parseKeyboard("C E G", "C", "keyboard");
  const change = vi.fn();
  render(
    <KeyboardSpeller
      chord="C"
      face="keyboard"
      initial={initial}
      onChange={change}
    />,
  );
  expect(change.mock.lastCall![0].provenance.basedOn).toBe(`${initial.id}@1`);
});

it("keeps a draft identity through edits", () => {
  const onChange = vi.fn();
  render(<KeyboardSpeller chord="C" face="keyboard" onChange={onChange} />);
  const id = onChange.mock.lastCall![0].id;
  fireEvent.change(screen.getByLabelText("Spell a chord or notes"), {
    target: { value: "E G C" },
  });
  expect(onChange.mock.lastCall![0].id).toBe(id);
});
it("emits the exact bare notes and marks unrelated pitches as hard failures", () => {
  const v = parseKeyboard("E F# A B", "C", "keyboard");
  expect(v.notes.map((n) => n.pitch)).toEqual(["E4", "F#4", "A4", "B4"]);
  expect(canUse(editorChecks(v))).toBe(false);
  const hands = parseKeyboard("Eb Gb Bb // Db F", "Ebm7", "keyboard-hands");
  if (hands.realization.kind === "keyboard") {
    expect(hands.realization.hands.left).toEqual(["Db3", "F3"]);
    expect(hands.realization.hands.right).toEqual(["Eb4", "Gb4", "Bb4"]);
  }
});

it("builds Cmaj7 by tapping, mirrors the fields, and seeds a tweak", async () => {
  const change = vi.fn();
  const view = render(
    <FrettedEditor chord="Cmaj7" face="guitar" onChange={change} />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/^String 5 \(A\), fret 3/)).toBeTruthy(),
  );
  for (const name of [
    /^String 5 \(A\), fret 3/,
    /^String 4 \(D\), fret 2/,
    /^String 3 \(G\), open or muted/,
    /^String 2 \(B\), open or muted/,
    /^String 1 \(E\), open or muted/,
  ])
    fireEvent.click(screen.getByLabelText(name));
  expect((screen.getByLabelText(/Fret code/) as HTMLInputElement).value).toBe(
    "x32000",
  );
  expect(canUse(change.mock.lastCall![1])).toBe(true);
  const initial = change.mock.lastCall![0];
  view.unmount();
  render(
    <FrettedEditor
      chord="Cmaj7"
      face="guitar"
      initial={initial}
      onChange={change}
    />,
  );
  expect((screen.getByLabelText(/Fret code/) as HTMLInputElement).value).toBe(
    "x32000",
  );
  expect(change.mock.lastCall![0].provenance.basedOn).toBe(`${initial.id}@1`);
  fireEvent.change(screen.getAllByLabelText("Finger")[1], {
    target: { value: "3" },
  });
  expect(change.mock.lastCall![0].realization.fingers[1]).toBe(3);
});
