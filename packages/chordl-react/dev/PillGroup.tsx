// The site's own pill toggle. BoardEditor keeps a private copy scoped to
// .chordl-board-editor; this one is styled by dev/index.html.
export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="control-item">
      {label && <span className="control-label">{label}</span>}
      <div className="control-content">
        <div className="pill-group">
          {options.map((opt) => (
            <button type="button"
              key={String(opt.value)}
              className="pill-btn"
              data-active={value === opt.value}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

