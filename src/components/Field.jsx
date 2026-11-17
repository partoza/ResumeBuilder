export default function Field({ field: f, id, value, onChange, disabled }) {
  const cls = 'field' + (f.full ? ' span-full' : '');

  if (f.type === 'checkbox') {
    return (
      <div className={cls}>
        <label className="check">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {f.label}
        </label>
      </div>
    );
  }

  // Coaching feedback replaces the static hint once the user has typed something checkable.
  const feedback = f.check ? f.check(value) : null;
  const hint = feedback ? (
    <span className={`hint ${feedback.level}`} role={feedback.level === 'warn' ? 'alert' : undefined}>
      {feedback.text}
    </span>
  ) : f.hint ? (
    <span className="hint">{f.hint}</span>
  ) : null;

  let control;
  if (f.type === 'textarea') {
    control = (
      <textarea
        className={`textarea${feedback?.level === 'warn' ? ' is-warn' : ''}`}
        id={id}
        value={value}
        placeholder={f.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (f.type === 'select') {
    control = (
      <select className="select" id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => (
          <option key={o} value={o}>{o || 'Select…'}</option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        className={`input${feedback?.level === 'warn' ? ' is-warn' : ''}`}
        id={id}
        type={f.type || 'text'}
        inputMode={f.inputMode}
        value={value}
        placeholder={f.placeholder}
        autoComplete={f.ac || 'off'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={cls}>
      <label htmlFor={id}>{f.label}</label>
      {control}
      {hint}
    </div>
  );
}
