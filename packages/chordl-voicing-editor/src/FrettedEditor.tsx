import { newVoicingId } from "@pepperhorn/chordl-voicing";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { GuitarChord, startPlayback } from "@pepperhorn/chordl-react";
import {
  parseTheme,
  playbackFor,
  requestForVoicing,
  voicingForRealization,
} from "@pepperhorn/chordl-cards";
import type { CardFace, Theme } from "@pepperhorn/chordl-cards";
import themeJson from "@pepperhorn/chordl-cards/themes/crf-default.json";
import type { FrettedRealization, Voicing } from "@pepperhorn/chordl-voicing";
import { editorChecks } from "./checks";
import type { EditorChecks } from "./checks";
import { VoicingChecks } from "./VoicingChecks";
const defaultTheme = parseTheme(themeJson);
type FrettedFace = Extract<
  CardFace,
  "guitar" | "guitar-top3" | "ukulele" | "bass4"
>;
export interface FrettedEditorProps {
  chord: string;
  face: FrettedFace;
  initial?: Voicing;
  onChange: (voicing: Voicing | null, checks: EditorChecks) => void;
  theme?: Theme;
}
function blank(face: FrettedFace): FrettedRealization {
  const cfg = INSTRUMENTS[face];
  const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  return {
    kind: "fretted",
    instrument: face,
    tuning: cfg.openMidi.map(
      (m) => `${names[m % 12]}${Math.floor(m / 12) - 1}`,
    ),
    strings: Array(cfg.strings).fill(null),
    fingers: Array(cfg.strings).fill(null),
    barres: [],
    baseFret: 1,
    capo: null,
  };
}
export function fretCode(r: FrettedRealization): string {
  return r.strings
    .map((f) => (f === null ? "x" : String(f)))
    .join(r.strings.some((f) => f !== null && f >= 10) ? " " : "");
}
export function parseFretCode(
  text: string,
  count: number,
): (number | null)[] | null {
  const tokens =
    count === 1
      ? [text.trim()]
      : /[\s,;|]/.test(text.trim())
        ? text.trim().split(/[\s,;|]+/)
        : text.trim().split("");
  if (tokens.length !== count) return null;
  const out: (number | null)[] = [];
  for (const t of tokens) {
    if (/^x$/i.test(t)) {
      out.push(null);
      continue;
    }
    if (/^o$/i.test(t)) {
      out.push(0);
      continue;
    }
    if (!/^\d+$/.test(t) || Number(t) > 24) return null;
    out.push(Number(t));
  }
  return out;
}
/** Targets follow the actual chordl renderer's string and fret lines. */
function TapDiagram({
  r,
  shape,
  onFret,
  onNut,
}: {
  r: FrettedRealization;
  shape: Parameters<typeof GuitarChord>[0]["chord"];
  onFret: (i: number, f: number) => void;
  onNut: (i: number) => void;
}) {
  const fretsShown = Math.max(
    5,
    ...r.strings.map((f) => (f === null || f === 0 ? 0 : f - r.baseFret + 1)),
  );
  const ref = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<
    { x: number; y: number; w: number; h: number; i: number; f: number }[]
  >([]);
  useEffect(() => {
    const el = ref.current!;
    const measure = () => {
      const frame = el.getBoundingClientRect();
      const strings = [
        ...el.querySelectorAll<SVGGraphicsElement>("svg .bc-frame-string"),
      ]
        .map((s) => s.getBoundingClientRect())
        .sort((a, b) => a.x - b.x);
      const frets = [
        ...el.querySelectorAll<SVGGraphicsElement>("svg .bc-frame-fret"),
      ]
        .map((s) => s.getBoundingClientRect())
        .sort((a, b) => a.y - b.y);
      if (strings.length !== r.strings.length || frets.length < 2) return;
      const step = strings.length > 1 ? strings[1].x - strings[0].x : 44;
      const rows = frets.slice(0, fretsShown).map((f, i) => ({
        y: f.y - frame.y,
        h: Math.max(36, (frets[i + 1]?.y ?? f.y + 44) - f.y),
        f: r.baseFret + i,
      }));
      const next = strings.flatMap((s, i) => [
        {
          x: s.x - frame.x - step / 2,
          y: frets[0].y - frame.y - 44,
          w: Math.max(36, step),
          h: 44,
          i,
          f: 0,
        },
        ...rows.map((row) => ({
          x: s.x - frame.x - step / 2,
          w: Math.max(36, step),
          i,
          ...row,
        })),
      ]);
      setTargets((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    const mutations = new MutationObserver(measure);
    mutations.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "viewBox"],
    });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    measure();
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, [r.baseFret, r.strings.length, fretsShown]);
  return (
    <div className="cve-diagram" ref={ref}>
      <GuitarChord
        chord={shape}
        scale={1.25}
        settings={{
          strings: r.strings.length,
          sidePadding: 0.12,
          tuning: r.tuning.map((p) => p.replace(/-?\d+$/, "")),
          frets: fretsShown,
        }}
      />
      {targets.map((t) => {
        const locked = r.instrument === "guitar-top3" && t.i < 3;
        const active = r.strings[t.i] === t.f;
        return (
          <button
            key={`${t.i}-${t.f}`}
            type="button"
            disabled={locked}
            aria-pressed={active}
            aria-label={`String ${r.strings.length - t.i} (${r.tuning[t.i].replace(/-?\d+$/, "")}), ${t.f === 0 ? "open or muted" : `fret ${t.f}`}, finger ${active ? "on" : "off"}${locked ? ", locked muted" : ""}`}
            className="cve-hit"
            style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
            onClick={() => (t.f === 0 ? onNut(t.i) : onFret(t.i, t.f))}
          />
        );
      })}
    </div>
  );
}
export function FrettedEditor({
  chord,
  face,
  initial,
  onChange,
  theme = defaultTheme,
}: FrettedEditorProps) {
  const id = useId();
  const [draftId] = useState(newVoicingId);
  const [r, setR] = useState<FrettedRealization>(() =>
    initial?.realization.kind === "fretted" &&
    initial.realization.instrument === face
      ? structuredClone(initial.realization)
      : blank(face),
  );
  const [code, setCode] = useState(() => fretCode(r));
  const [error, setError] = useState("");
  const [audioError, setAudioError] = useState("");
  const playback = useRef<Awaited<ReturnType<typeof startPlayback>> | null>(
    null,
  );
  useEffect(
    () => () => {
      playback.current?.cancel();
    },
    [],
  );
  const update = (next: FrettedRealization) => {
    if (face === "guitar-top3") {
      next = {
        ...next,
        strings: next.strings.map((f, i) => (i < 3 ? null : f)),
        fingers: next.fingers.map((f, i) => (i < 3 ? null : f)),
      };
    }
    setR(next);
    setCode(fretCode(next));
    setError("");
  };
  const voicing = useMemo(
    () => ({ ...voicingForRealization(chord, r, initial), id: draftId }),
    [chord, r, initial, draftId],
  );
  const request = useMemo(
    () => requestForVoicing(chord, voicing, face, theme),
    [chord, voicing, face, theme],
  );
  const callback = useRef(onChange);
  callback.current = onChange;
  const checks = useMemo(
    () => editorChecks(error ? null : voicing, error),
    [voicing, error],
  );
  useEffect(
    () => callback.current(error ? null : voicing, checks),
    [voicing, checks, error],
  );
  const setBase = (baseFret: number) => {
    const delta = baseFret - r.baseFret;
    update({
      ...r,
      baseFret,
      strings: r.strings.map((f) =>
        f === null || f === 0 ? f : Math.min(24, Math.max(1, f + delta)),
      ),
      barres: r.barres.map((b) => ({
        ...b,
        fret: Math.min(24, Math.max(1, b.fret + delta)),
      })),
    });
  };
  const setFret = (i: number, f: number | null) =>
    update({
      ...r,
      barres: r.barres.filter(
        (b) =>
          !(
            i >= Math.min(b.fromString, b.toString) &&
            i <= Math.max(b.fromString, b.toString) &&
            f !== null &&
            f < b.fret
          ),
      ),
      strings: r.strings.map((v, j) => (j === i ? f : v)),
      fingers: r.fingers.map((v, j) =>
        j === i && (f === null || f === 0) ? null : v,
      ),
    });
  const changeBarre = (
    index: number,
    patch: Partial<FrettedRealization["barres"][number]>,
  ) => {
    const barres = r.barres.map((b, i) =>
      i === index ? { ...b, ...patch } : b,
    );
    const b = barres[index];
    const lo = Math.min(b.fromString, b.toString),
      hi = Math.max(b.fromString, b.toString);
    update({
      ...r,
      barres,
      strings: r.strings.map((f, i) => (i >= lo && i <= hi ? b.fret : f)),
    });
  };
  return (
    <section className="cve-editor" aria-label="Fretted editor">
      {initial && (
        <p>
          Tweaking {chord} ·{" "}
          <button type="button" onClick={() => update(blank(face))}>
            Start fresh
          </button>
        </p>
      )}
      {request.kind === "guitar" && (
        <TapDiagram
          r={r}
          shape={request.shape}
          onFret={(i, f) => setFret(i, r.strings[i] === f ? null : f)}
          onNut={(i) => setFret(i, r.strings[i] === 0 ? null : 0)}
        />
      )}
      <div className="cve-stepper">
        <button
          type="button"
          aria-label="Lower starting fret"
          disabled={r.baseFret === 1}
          onClick={() => setBase(r.baseFret - 1)}
        >
          −
        </button>
        <label htmlFor={`${id}-start`}>Starting fret</label>
        <input
          id={`${id}-start`}
          type="number"
          min={1}
          max={20}
          value={r.baseFret}
          onChange={(e) =>
            setBase(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
          }
        />
        <button
          type="button"
          aria-label="Raise starting fret"
          disabled={r.baseFret === 20}
          onClick={() => setBase(r.baseFret + 1)}
        >
          +
        </button>
      </div>
      <label htmlFor={`${id}-code`}>
        Fret code (low string first; separate frets ≥ 10 with spaces)
      </label>
      <input
        id={`${id}-code`}
        value={code}
        onChange={(e) => {
          const value = e.target.value;
          setCode(value);
          const strings = parseFretCode(value, r.strings.length);
          if (!strings) {
            setError(`Enter ${r.strings.length} frets: x, o or 0–24`);
            return;
          }
          const played = strings.filter(
            (f): f is number => f !== null && f > 0,
          );
          const baseFret =
            played.length && Math.max(...played) > 5 ? Math.min(...played) : 1;
          update({
            ...r,
            strings,
            fingers: r.fingers.map(() => null),
            barres: [],
            baseFret,
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <details open>
        <summary>Per string · fingers · barre</summary>
        {r.strings.map((f, i) => {
          const locked = face === "guitar-top3" && i < 3;
          const name = `String ${r.strings.length - i}`;
          return (
            <div className="cve-string" key={i}>
              <span>
                {name} ({r.tuning[i]}){locked ? " · locked muted" : ""}
              </span>
              <label htmlFor={`${id}-fret-${i}`}>Fret</label>
              <input
                id={`${id}-fret-${i}`}
                disabled={locked}
                value={f ?? "x"}
                onChange={(e) => {
                  const val = parseFretCode(e.target.value, 1);
                  if (val) setFret(i, val[0]);
                }}
              />
              <label htmlFor={`${id}-finger-${i}`}>Finger</label>
              <select
                id={`${id}-finger-${i}`}
                disabled={locked || f === null || f === 0}
                value={r.fingers[i] ?? ""}
                onChange={(e) =>
                  update({
                    ...r,
                    fingers: r.fingers.map((v, j) =>
                      i === j ? Number(e.target.value) || null : v,
                    ),
                  })
                }
              >
                <option value="">None</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const from = face === "guitar-top3" ? 3 : 0;
            update({
              ...r,
              strings: r.strings.map((f, i) =>
                i >= from ? Math.max(f ?? 0, r.baseFret) : null,
              ),
              barres: [
                ...r.barres,
                {
                  fret: r.baseFret,
                  fromString: from,
                  toString: r.strings.length - 1,
                },
              ],
            });
          }}
        >
          Add barre
        </button>
        {r.barres.map((b, i) => (
          <div className="cve-barre" key={i}>
            {(["fromString", "toString", "fret"] as const).map((key) => (
              <label key={key}>
                {key === "fret"
                  ? "Barre fret"
                  : key === "fromString"
                    ? "From string"
                    : "To string"}
                <input
                  type="number"
                  aria-label={`Barre ${i + 1} ${key}`}
                  min={1}
                  max={
                    key === "fret"
                      ? 24
                      : face === "guitar-top3"
                        ? 3
                        : r.strings.length
                  }
                  value={key === "fret" ? b[key] : r.strings.length - b[key]}
                  onChange={(e) => {
                    const max =
                      key === "fret"
                        ? 24
                        : face === "guitar-top3"
                          ? 3
                          : r.strings.length;
                    const n = Math.min(
                      max,
                      Math.max(1, Number(e.target.value) || 1),
                    );
                    changeBarre(
                      i,
                      Object.assign(
                        {},
                        { [key]: key === "fret" ? n : r.strings.length - n },
                      ) as Partial<typeof b>,
                    );
                  }}
                />
              </label>
            ))}
            <button
              type="button"
              aria-label={`Remove barre ${i + 1}`}
              onClick={() =>
                update({ ...r, barres: r.barres.filter((_, j) => j !== i) })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </details>
      <button
        type="button"
        disabled={!voicing.notes.length || !!error}
        onClick={async () => {
          playback.current?.cancel();
          setAudioError("");
          const spec = playbackFor(request);
          try {
            playback.current = await startPlayback(spec.notes, {
              mode: "block",
              instrument: spec.instrument,
            });
          } catch {
            setAudioError("Playback unavailable. Try again.");
          }
        }}
      >
        Play
      </button>
      {audioError && <p role="status">{audioError}</p>}
      <VoicingChecks checks={checks} />
    </section>
  );
}
