import type { Soundfont } from "smplr";
import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { DEFAULT_ARPEGGIO_BPM, normalizeArpeggioBpm } from "@pepperhorn/chordl-core";
import { diatonicStep } from "../diatonic-step";

export type PlaybackMode = "block" | "arpeggio";

export interface PlaybackEvent {
  index: number;
  note: string | number;
  midi: number;
  time: number;
  duration: number;
  visualEnd: number;
}

export interface PlaybackController {
  events: PlaybackEvent[];
  completion: Promise<void>;
  cancel(): void;
}

export interface StartPlaybackOptions {
  mode: PlaybackMode;
  instrument?: PlaybackInstrument;
  bpm?: number;
  duration?: number;
  onActiveChange?: (indices: number[]) => void;
}

let ctx: AudioContext | null = null;
type PlaybackPlayer = Pick<Soundfont, "start">;

const instruments = new Map<PlaybackInstrument, PlaybackPlayer>();
const loading = new Map<PlaybackInstrument, Promise<PlaybackPlayer>>();
// Kept outside Vite's static `new URL()` transform: library mode otherwise
// base64-inlines every asset. This resolves to the separately published
// package `soundfonts/` directory in production and the same path in dev.
const UKULELE_SOUNDFONT_FILE = "freepats-ukulele-20260811.sf2";
const UKULELE_SOUNDFONT_URL = import.meta.env.DEV
  ? `/soundfonts/${UKULELE_SOUNDFONT_FILE}`
  : new URL("../soundfonts/" + UKULELE_SOUNDFONT_FILE, import.meta.url).href;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function ensureInstrument(instrument: PlaybackInstrument): Promise<PlaybackPlayer> {
  const ready = instruments.get(instrument);
  if (ready) return ready;
  const pending = loading.get(instrument);
  if (pending) return pending;

  const promise = instrument === "ukulele"
    ? Promise.all([import("smplr"), import("soundfont2")]).then(async ([{ Soundfont2Sampler }, { SoundFont2 }]) => {
      const instance = new Soundfont2Sampler(getContext(), {
        url: UKULELE_SOUNDFONT_URL,
        createSoundfont: (data) => new SoundFont2(data),
      });
      await instance.load;
      const voice = instance.instrumentNames[0];
      if (!voice) throw new Error("The ukulele soundfont contains no playable instrument");
      await instance.loadInstrument(voice);
      instruments.set(instrument, instance);
      loading.delete(instrument);
      return instance;
    })
    : import("smplr").then(async ({ Soundfont }) => {
    const instance = new Soundfont(getContext(), { instrument });
    await instance.load;
    instruments.set(instrument, instance);
    loading.delete(instrument);
    return instance;
  });
  const guarded = promise.catch((error) => {
    loading.delete(instrument);
    throw error;
  });
  loading.set(instrument, guarded);
  return guarded;
}

/**
 * Warm a set of patches before they are needed.
 *
 * `ensureInstrument` already de-duplicates in flight, so this is only a public
 * door onto it. It never rejects: a preload is an optimisation, and a failed
 * one must not take down the caller that asked for it — the real
 * `startPlayback` will surface the failure if the patch is actually used.
 */
export async function preloadInstruments(
  // Not `instruments`: that is the module-level cache this function fills, and
  // shadowing it here reads as though the parameter were that map.
  wanted: readonly PlaybackInstrument[],
): Promise<void> {
  await Promise.all(
    [...new Set(wanted)].map((instrument) =>
      ensureInstrument(instrument).catch(() => undefined),
    ),
  );
}

const LETTER_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Semitone offset of a note name's accidentals: "#" is +1, "b" is -1, and a
 * bare letter is 0. Read off the letter rather than looked up in a table of
 * pitch classes, because a table loses which *letter* the note is spelled
 * with — and the octave number belongs to the letter, not to the pitch. Cb4
 * is the B below middle C (MIDI 59); a "Cb → 11" table reads it as B4 (71),
 * an octave above where the staff engraves the same note. Same for B#.
 */
function accidentalOffset(accidentals: string): number {
  let offset = 0;
  for (const character of accidentals) {
    if (character === "#") offset += 1;
    else if (character === "b") offset -= 1;
  }
  return offset;
}

export function noteToMidi(note: string | number): number {
  if (typeof note === "number") return note;
  const match = note.match(/^([A-Ga-g])([#b]*)(-?\d+)$/);
  if (!match) throw new Error(`Cannot play note '${note}' without an octave`);
  const letter = LETTER_SEMITONES[match[1].toUpperCase()];
  if (letter === undefined) throw new Error(`Unknown note '${note}'`);
  return (Number(match[3]) + 1) * 12 + letter + accidentalOffset(match[2]);
}

export function arpeggioDelayMs(bpm: number = DEFAULT_ARPEGGIO_BPM): number {
  return 60000 / (normalizeArpeggioBpm(bpm) * 4);
}

/**
 * Assign rising octaves to pitch classes in voicing order.
 *
 * The ascent is measured on the **diatonic step** — the note's letter — which
 * is the rule the staff engraver and the keyboard already use
 * (`ascendingOctaves`, `assignOctaves`). It used to step on the semitone here
 * and only here, so the two rules parted company on any chromatic pair: given
 * C, G#, Ab the staff drew 60/68/68 (Ab's letter A rises past G, so it stays
 * in the octave) while playback sounded 60/68/80 (Ab's semitone 8 does not
 * rise past G#'s 8, so it bumped).
 *
 * A name that already carries an octave is passed through untouched — the
 * callers that resolve pitches properly hand this function finished work.
 */
export function toAscendingNotes(notes: string[], baseOctave: number = 4): string[] {
  let octave = baseOctave;
  let prevStep = -1;
  return notes.map((note) => {
    if (/-?\d+$/.test(note)) return note;
    const step = diatonicStep(note);
    if (step < 0) return `${note}${octave}`;
    if (prevStep >= 0 && step <= prevStep) octave++;
    prevStep = step;
    return `${note}${octave}`;
  });
}

export function buildPlaybackEvents(
  notes: Array<string | number>,
  mode: PlaybackMode,
  startTime: number,
  bpm: number = DEFAULT_ARPEGGIO_BPM,
  duration: number = 1.5,
): PlaybackEvent[] {
  const delay = arpeggioDelayMs(bpm) / 1000;
  return notes.map((note, index) => {
    const time = startTime + (mode === "arpeggio" ? index * delay : 0);
    const nextAttack = mode === "arpeggio" && index < notes.length - 1
      ? startTime + (index + 1) * delay
      : time + Math.min(duration, 0.25);
    return { index, note, midi: noteToMidi(note), time, duration, visualEnd: nextAttack };
  });
}

function animationFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
}

function cancelAnimation(handle: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

export async function startPlayback(
  notes: Array<string | number>,
  options: StartPlaybackOptions,
): Promise<PlaybackController> {
  const context = getContext();
  if (context.state === "suspended") await context.resume();
  const player = await ensureInstrument(options.instrument ?? "acoustic_grand_piano");
  const events = buildPlaybackEvents(
    notes,
    options.mode,
    context.currentTime + 0.02,
    options.bpm,
    options.duration,
  );
  // Sound the MIDI number this module resolved, not the name it came from:
  // the sampler parses names with its own spelling rules, and the whole point
  // of the chain above is that one resolution reaches every consumer.
  const stops = events.map((event) => player.start({
    note: event.midi,
    time: event.time,
    duration: event.duration,
  }));

  let frame = 0;
  let cancelled = false;
  let previous = "";
  let resolveCompletion = () => {};
  const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
  const audioEnd = events.reduce((max, event) => Math.max(max, event.time + event.duration), context.currentTime);

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    options.onActiveChange?.([]);
    resolveCompletion();
  };

  const tick = () => {
    if (cancelled) return;
    const now = context.currentTime;
    const active = events
      .filter((event) => now >= event.time && now < event.visualEnd)
      .map((event) => event.index);
    const key = active.join(",");
    if (key !== previous) {
      previous = key;
      options.onActiveChange?.(active);
    }
    if (now >= audioEnd) finish();
    else frame = animationFrame(tick);
  };
  frame = animationFrame(tick);

  return {
    events,
    completion,
    cancel() {
      if (cancelled) return;
      cancelAnimation(frame);
      stops.forEach((stop) => stop(context.currentTime));
      finish();
    },
  };
}

/** Compatibility wrapper: schedules a block chord and returns once scheduled. */
export async function playBlock(notes: string[], octave: number = 4, duration: number = 1.5): Promise<void> {
  await startPlayback(toAscendingNotes(notes, octave), { mode: "block", duration });
}

/** Compatibility wrapper: schedules an arpeggio and returns once scheduled. */
export async function playArpeggiated(
  notes: string[],
  octave: number = 4,
  delayMs: number = 100,
  duration: number = 1.5,
): Promise<void> {
  const bpm = Math.round(60000 / (Math.max(1, delayMs) * 4));
  await startPlayback(toAscendingNotes(notes, octave), { mode: "arpeggio", bpm, duration });
}
