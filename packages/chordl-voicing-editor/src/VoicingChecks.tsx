import type { EditorChecks } from "./checks";
export function VoicingChecks({ checks }: { checks: EditorChecks }) {
  return (
    <div className="cve-checks" aria-live="polite" aria-atomic="true">
      <p>
        Notes heard:{" "}
        {checks.notes.map((n) => `${n.pitch} (${n.degree})`).join(" · ") ||
          "None"}
      </p>
      {checks.level && (
        <p>
          Level: <strong>{checks.level}</strong>
        </p>
      )}
      {checks.hard.map((f, i) => (
        <p key={`h${i}`}>Fix: {f.message}</p>
      ))}
      {checks.flags.map((f, i) => (
        <p key={`w${i}`}>Warning: {f.message}</p>
      ))}
      {checks.valid && !checks.hard.length && <p>Ready to use</p>}
    </div>
  );
}
