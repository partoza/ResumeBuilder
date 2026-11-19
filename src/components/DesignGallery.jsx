import { useEffect, useRef, useState } from 'react';
import { Check } from './Icons.jsx';
import { RESUME_DESIGNS } from '../designs.js';
import { designThumb } from '../designThumbs.js';

// Each card sits at a slight angle; hovering or selecting straightens it.
const TILTS = ['-4deg', '3deg', '-2.5deg', '3.5deg', '-3deg'];

/** Picture cards of the resume designs (a radio group: click, or arrow keys to move). */
export default function DesignGallery({ value, onChange }) {
  const [thumbs, setThumbs] = useState({});
  const refs = useRef([]);

  // Render the thumbnails one after another, shortly after the page settles.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      for (const d of RESUME_DESIGNS) {
        try {
          const url = await designThumb(d.id);
          if (!alive) return;
          setThumbs((prev) => ({ ...prev, [d.id]: url }));
        } catch (err) {
          console.warn(`Design preview "${d.id}" unavailable`, err);
        }
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const current = Math.max(0, RESUME_DESIGNS.findIndex((d) => d.id === value));

  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (current + step + RESUME_DESIGNS.length) % RESUME_DESIGNS.length;
    onChange(RESUME_DESIGNS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <section className="card design-card" aria-labelledby="design-gallery-title">
      <div className="card-head card-head-static">
        <span className="card-titles">
          <span className="card-title" id="design-gallery-title">Design</span>
          <span className="card-desc">Pick a look for your resume. Switch any time — your content stays the same.</span>
        </span>
      </div>
      <div className="card-body">
        <div className="design-gallery" role="radiogroup" aria-labelledby="design-gallery-title" onKeyDown={onKeyDown}>
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
                onClick={() => onChange(d.id)}
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
    </section>
  );
}
