import { describe, it, expect } from "vitest";
import { resolveNoteNames } from "../src/note-name-defaults";
import type { NoteNameDefaults } from "../src/note-name-defaults";

type Parsed = Parameters<typeof resolveNoteNames>[0];

describe("resolveNoteNames", () => {
  it.each<[string, Parsed, NoteNameDefaults, NoteNameDefaults]>([
    ["no defaults leaves the NL alone", {}, {}, { showNoteNames: undefined, noteNameMode: undefined, noteNameSize: undefined }],
    ["defaults turn names on", {}, { showNoteNames: true, noteNameSize: "xl" }, { showNoteNames: true, noteNameMode: "pitch-class", noteNameSize: "xl" }],
    ["default mode is used", {}, { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "midi", noteNameSize: undefined }],
    ["NL size wins", { showNoteNames: true, noteNameSize: "base" }, { showNoteNames: true, noteNameSize: "xl" }, { showNoteNames: true, noteNameMode: undefined, noteNameSize: "base" }],
    ["NL without size takes the default size", { showNoteNames: true }, { noteNameSize: "2xl" }, { showNoteNames: true, noteNameMode: undefined, noteNameSize: "2xl" }],
    ["NL mode wins", { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "pitch-class" }, { showNoteNames: true, noteNameMode: "midi", noteNameSize: undefined }],
    ["degrees-only NL gains default names", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: true }, { showNoteNames: true, noteNameMode: "pitch-class+degree", noteNameSize: undefined }],
    ["degrees-only NL with midi default", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "midi+degree", noteNameSize: undefined }],
    ["degrees-only NL, names off", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: false }, { showNoteNames: true, noteNameMode: "degree", noteNameSize: undefined }],
  ])("%s", (_, p, d, want) => expect(resolveNoteNames(p, d)).toEqual(want));
});
