import type { Soundfont } from "smplr";
import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { DEFAULT_ARPEGGIO_BPM, normalizeArpeggioBpm } from "@pepperhorn/chordl-core";

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
const instruments = new Map<PlaybackInstrument, Soundfont>();
const loading = new Map<PlaybackInstrument, Promise<Soundfont>>();

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function ensureInstrument(instrument: PlaybackInstrument): Promise<Soundfont> {
  const ready = instruments.get(instrument);
  if (ready) return ready;
  const pending = loading.get(instrument);
  if (pending) return pending;

  const promise = import("smplr").then(async ({ Soundfont }) => {
    const instance = new Soundfont(getContext(), { instrument });
    await instance.load;
    instruments.set(instrument, instance);
    loading.delete(instrument);
    return instance;
  }).catch((error) => {
    loading.delete(instrument);
    throw error;
  });
  loading.set(instrument, promise);
  return promise;
}

const PC_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0,
};

export function noteToMidi(note: string | number): number {
  if (typeof note === "number") return note;
  const match = note.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) throw new Error(`Cannot play note '${note}' without an octave`);
  const pc = PC_SEMITONES[match[1]];
  if (pc === undefined) throw new Error(`Unknown note '${note}'`);
  return (Number(match[2]) + 1) * 12 + pc;
}

export function arpeggioDelayMs(bpm: number = DEFAULT_ARPEGGIO_BPM): number {
  return 60000 / (normalizeArpeggioBpm(bpm) * 4);
}

/** Assign rising octaves to pitch classes in voicing order. */
export function toAscendingNotes(notes: string[], baseOctave: number = 4): string[] {
  let octave = baseOctave;
  let prevSemitone = -1;
  return notes.map((note) => {
    if (/-?\d+$/.test(note)) return note;
    const semitone = PC_SEMITONES[note];
    if (semitone == null) return `${note}${octave}`;
    if (prevSemitone >= 0 && semitone <= prevSemitone) octave++;
    prevSemitone = semitone;
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
  const stops = events.map((event) => player.start({
    note: event.note,
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
