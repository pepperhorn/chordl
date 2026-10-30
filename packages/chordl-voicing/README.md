# @pepperhorn/chordl-voicing

An open JSON format for chord voicings (fretted, keyboard, bowed), with TypeScript
types and JSON Schemas (`chordl.chord/1`, `chordl.voicing/1`, draft 2020-12).

```ts
import { validateChordFileSchema } from "@pepperhorn/chordl-voicing";

const result = validateChordFileSchema(json);
if (!result.ok) console.error(result.errors); // [{ path, message }]
```

The schemas are also shipped as `schema/chord.schema.json` and `schema/voicing.schema.json`.
Pitches are ASCII scientific pitch (`Eb4`, never `E♭4`).
