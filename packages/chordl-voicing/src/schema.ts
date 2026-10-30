import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv/dist/2020.js";
import chordSchemaJson from "./generated/chord.schema.json" with { type: "json" };
import voicingSchemaJson from "./generated/voicing.schema.json" with { type: "json" };
import type { ChordFile } from "./types.js";

export interface SchemaError {
  path: string;
  message: string;
}

export const chordSchema = chordSchemaJson as Record<string, unknown> & { title: string };
export const voicingSchema = voicingSchemaJson as Record<string, unknown> & { title: string };

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(voicingSchema);
const validate = ajv.compile<ChordFile>(chordSchema);

const PITCH_PATTERN = "^[A-G](bb|b|##|#)?-?\\d$";

function valueAt(data: unknown, instancePath: string): unknown {
  let cur: any = data;
  for (const raw of instancePath.split("/").slice(1)) {
    if (cur == null) return undefined;
    cur = cur[raw.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return cur;
}

function describe(e: ErrorObject, data: unknown): SchemaError {
  if (e.keyword === "pattern" && (e.params as { pattern?: string }).pattern === PITCH_PATTERN) {
    const v = valueAt(data, e.instancePath);
    if (typeof v === "string") {
      const ascii = v.replace(/♭/g, "b").replace(/♯/g, "#");
      const hint = ascii !== v ? ` Use ASCII accidentals, e.g. "${ascii}" not "${v}".` : ' Expected e.g. "Eb4", "F#3", "Bbb3".';
      return { path: e.instancePath, message: `invalid pitch "${v}".${hint}` };
    }
  }
  return { path: e.instancePath, message: e.message ?? "invalid" };
}

export function validateChordFileSchema(
  data: unknown,
): { ok: true; value: ChordFile } | { ok: false; errors: SchemaError[] } {
  if (validate(data)) return { ok: true, value: data };
  return { ok: false, errors: (validate.errors ?? []).map((e) => describe(e, data)) };
}
