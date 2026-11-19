import { useEffect, useRef, useState } from 'react';
import { Check, Close } from './Icons.jsx';
import { RESUME_DESIGNS } from '../designs.js';
import { designThumb, readyThumb } from '../designThumbs.js';

// Each card sits at a slight angle; hovering or selecting straightens it.
const TILTS = ['-4deg', '3deg', '-2.5deg', '3.5deg', '-3deg'];

/**
 * "Select design" window: picture cards of every resume design.
 * Click a card (or Enter) to use it and close; arrow keys move the selection; Esc closes.
 */
export default function DesignDialog({ value, onChange, onClose }) {
  const [thumbs, setThumbs] = useState(() =>
    Object.fromEntries(RESUME_DESIGNS.map((d) => [d.id, readyThumb(d.id)]).filter(([, url]) => url))
  );
  const refs = useRef([]);
  const panelRef = useRef(null);
  const current = Math.max(0, RESUME_DESIGNS.findIndex((d) => d.id === value));

  // Render any thumbnails that aren't ready yet, one after another.
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const d of RESUME_DESIGNS) {
        if (readyThumb(d.id)) continue;
        try {
          const url = await designThumb(d.id);
          if (!alive) return;
          setThumbs((prev) => ({ ...prev, [d.id]: url }));
        } catch (err) {
          console.warn(`Design preview "${d.id}" unavailable`, err);
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Focus the selected card; Esc closes; Tab stays inside the window; focus returns on close.
  useEffect(() => {
    const previous = document.activeElement;
    refs.current[current]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const items = panelRef.current.querySelectorAll('button:not([tabindex="-1"])');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onArrows = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (current + step + RESUME_DESIGNS.length) % RESUME_DESIGNS.length;
    onChange(RESUME_DESIGNS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal design-modal" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="design-title" aria-describedby="design-desc">
        <div className="design-modal-head">
          <div>
            <h2 id="design-title" className="modal-title">Select design</h2>
            <p id="design-desc" className="modal-desc">Pick a look for your resume. Switch any time — your content stays the same.</p>
          </div>
          <button type="button" className="btn btn-ghost icon-only design-close" aria-label="Close" onClick={onClose}>
            <Close size={16} />
          </button>
        </div>
        <div className="design-modal-body">
          <div className="design-gallery" role="radiogroup" aria-labelledby="design-title" onKeyDown={onArrows}>
            {RESUME_DESIGNS.map((d, i) => {
              const selected = i === current;
              return (
                <button
                  key={d.id}
                  ref={(el) => { refs.current[i] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${d.name} — ${d.desc}`}
                  title={d.desc}
                  tabIndex={selected ? 0 : -1}
                  className={`design-option${selected ? ' is-selected' : ''}`}
                  style={{ '--tilt': TILTS[i % TILTS.length] }}
                  onClick={() => { onChange(d.id); onClose(); }}
                >
                  <span className="design-thumb">
                    {thumbs[d.id] ? <img src={thumbs[d.id]} alt="" draggable="false" /> : <span className="design-skeleton" />}
                    {selected && <span className="design-check" aria-hidden="true"><Check size={12} /></span>}
                  </span>
                  <span className="design-name">{d.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
