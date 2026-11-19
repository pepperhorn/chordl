import { ulid } from "ulid";
/** A new permanent identifier; shape hashes remain separate from identity. */
export function newVoicingId(): string {
  return `v_${ulid()}`;
}
