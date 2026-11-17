import Select from './Select.jsx';
import { splitItems, splitList } from '../utils.js';

// Live count of what the text will become on the resume.
const COUNTERS = {
  skills: { split: splitList, one: 'skill', many: 'skills' },
  items: { split: splitItems, one: 'bullet', many: 'bullets' },
};

/** Always-visible formatting instruction, e.g. "Separate each skill with a comma  [ , ]   3 skills". */
function Instruction({ instruction, split, value }) {
  const counter = COUNTERS[split];
  const n = counter ? counter.split(value).length : 0;
  return (
    <div className="field-instruction">
      <span className="instr-text">
        {instruction.text}
        {instruction.mark && <kbd className="instr-mark" aria-label={instruction.mark === ',' ? 'comma' : 'period'}>{instruction.mark}</kbd>}
      </span>
      {counter && n > 0 && (
        <span className="instr-count" aria-live="polite">
          {n} {n === 1 ? counter.one : counter.many}
        </span>
      )}
    </div>
  );
}

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

  // Coaching feedback replaces the static tip once the user has typed something checkable.
  // The formatting instruction (if any) stays visible regardless.
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
    control = <Select id={id} value={value} options={f.options} onChange={onChange} ariaLabel={f.label} />;
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
      {f.instruction && <Instruction instruction={f.instruction} split={f.split} value={value} />}
      {control}
      {hint}
    </div>
  );
}
