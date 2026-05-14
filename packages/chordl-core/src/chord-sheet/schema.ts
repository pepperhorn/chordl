export const CHORD_SHEET_SCHEMA_VERSION = "1.0";

/**
 * Validate that a token's version is compatible with the current schema.
 * Rejects incompatible major versions; minor differences are OK.
 */
export function validateVersion(v: string): void {
  if (!v || typeof v !== "string") {
    throw new Error("Missing or invalid schema version");
  }
  const [major] = v.split(".");
  const [currentMajor] = CHORD_SHEET_SCHEMA_VERSION.split(".");
  if (major !== currentMajor) {
    throw new Error(
      `Incompatible schema version "${v}" (current: "${CHORD_SHEET_SCHEMA_VERSION}"). ` +
      `Major version mismatch — this sheet was created with a newer or older format.`
    );
  }
}
