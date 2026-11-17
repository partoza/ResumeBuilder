import { useRef } from 'react';
import Field from './Field.jsx';
import { Chevron, ChevronUp, Trash, Plus, Check, User } from './Icons.jsx';
import { cropPhoto, has } from '../utils.js';

function PhotoPicker({ photo, onChange, notify }) {
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Please choose an image file');
    try {
      onChange(await cropPhoto(file));
    } catch {
      notify('Could not read that image');
    }
  }

  return (
    <div className="photo-row">
      <div className="photo-box">{photo ? <img src={photo} alt="Profile" /> : <User size={28} />}</div>
      <div className="photo-meta">
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()}>
            {photo ? 'Change photo' : 'Upload 2×2 photo'}
          </button>
          {photo && (
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
        <span className="hint">Optional. JPG or PNG — cropped to a square.</span>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
    </div>
  );
}

function ObjectBody({ section, data, update, notify }) {
  return (
    <>
    {section.photo && (
      <PhotoPicker photo={data.photo} onChange={(v) => update([section.id, 'photo'], v)} notify={notify} />
    )}
    <div className="grid">
      {section.fields.map((f) => (
        <Field
          key={f.key}
          field={f}
          id={`f-${section.id}-${f.key}`}
          value={data[f.key] ?? ''}
          onChange={(v) => update([section.id, f.key], v)}
        />
      ))}
    </div>
    </>
  );
}

function ListBody({ section: s, items, update, setList, notify }) {
  function move(i, dir) {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setList(next);
  }

  function remove(i) {
    const removed = items[i];
    setList(items.filter((_, j) => j !== i));
    notify('Entry removed', 'Undo', (current) => {
      const next = [...current];
      next.splice(i, 0, removed);
      return next;
    });
  }

  return (
    <>
      <div className="items">
        {items.length === 0 && <div className="empty">Nothing added yet.</div>}
        {items.map((it, i) => {
          const [main, sub] = s.itemTitle(it);
          return (
            <div className="item" key={it._id}>
              <div className="item-head">
                <div className="item-title">
                  {main}
                  {has(sub) && <span className="muted"> · {sub}</span>}
                </div>
                <div className="item-tools">
                  <button type="button" className="btn btn-ghost btn-xs" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" title="Move down" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <Chevron size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs danger" title="Remove" aria-label="Remove" onClick={() => remove(i)}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              <div className="item-body">
                <div className="grid">
                  {s.fields.map((f) => (
                    <Field
                      key={f.key}
                      field={f}
                      id={`f-${s.id}-${it._id}-${f.key}`}
                      value={it[f.key] ?? ''}
                      disabled={f.disabledWhen ? !!it[f.disabledWhen] : false}
                      onChange={(v) => update([s.id, i, f.key], v)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-secondary add-btn" onClick={() => setList([...items, s.blank()], true)}>
        <Plus size={14} /> {s.addLabel}
      </button>
    </>
  );
}

export default function FormSection({ section, number, state, done, collapsed, onToggle, update, setList, notify }) {
  return (
    <section id={`card-${section.id}`} className={`card${collapsed ? ' collapsed' : ''}${done ? ' done' : ''}`}>
      <button type="button" className="card-head" aria-expanded={!collapsed} onClick={onToggle}>
        <span className="card-num">{done ? <Check size={12} /> : number}</span>
        <span className="card-titles">
          <span className="card-title">{section.title}</span>
          <span className="card-desc">{section.desc}</span>
        </span>
        <Chevron className="chev" />
      </button>
      {!collapsed && (
        <div className="card-body">
          {section.kind === 'list' ? (
            <ListBody
              section={section}
              items={state[section.id]}
              update={update}
              setList={(next, focusLast) => setList(section.id, next, focusLast)}
              notify={(msg, label, fn) => notify(msg, label, fn && (() => setList(section.id, fn)))}
            />
          ) : (
            <ObjectBody section={section} data={state[section.id]} update={update} notify={notify} />
          )}
        </div>
      )}
    </section>
  );
}
