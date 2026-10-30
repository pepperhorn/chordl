#!/usr/bin/env node
import { run } from "./run.js";

run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (s) => { process.stdout.write(s); },
  stderr: (s) => { process.stderr.write(s); },
}).then(
  (code) => { process.exitCode = code; },
  (e) => { process.stderr.write(`chordl-voicing: ${(e as Error).message}\n`); process.exitCode = 1; },
);
