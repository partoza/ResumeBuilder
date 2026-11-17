import { forwardRef } from 'react';
import { Mail, Phone, Pin } from './Icons.jsx';
import { HEADINGS, SUBHEADINGS } from '../model.js';

const CONTACT_ICON = { phone: Phone, mail: Mail, pin: Pin };

function Section({ title, children }) {
  return (
    <section className="r-sec">
      <h2 className="r-sec-title">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="r-bullets">
      {items.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );
}

function Chips({ label, items, showLabel }) {
  if (!items.length) return null;
  return (
    <div className="r-skillgrp">
      {showLabel && <div className="r-level">{label}</div>}
      <div className="r-chips">
        {items.map((x, i) => <span className="r-chip" key={i}>{x}</span>)}
      </div>
    </div>
  );
}

/** Renders the normalized resume model (see model.js). exportPdf.js draws the same design. */
const ResumePreview = forwardRef(function ResumePreview({ model: m, style }, ref) {
  const { hard, soft } = m.skills;
  const empty = !m.name && !m.contact.length;

  return (
    <article className="paper" ref={ref} style={style}>
      <header className="r-head">
        <div className="r-head-text">
          <h1 className={`r-name${m.name ? '' : ' r-placeholder'}`}>{m.name || 'Your Name'}</h1>
          {m.title ? (
            <div className="r-role">{m.title}</div>
          ) : (
            empty && <div className="r-role r-placeholder">Desired position</div>
          )}
          {m.contact.length > 0 ? (
            <div className="r-contact">
              {m.contact.map(({ type, text }) => {
                const Icon = CONTACT_ICON[type];
                return <span key={type}><Icon size={11} />{text}</span>;
              })}
            </div>
          ) : (
            empty && <div className="r-contact r-placeholder"><span>Contact number</span><span>Email</span><span>Address, ZIP code</span></div>
          )}
        </div>
        {m.photo && <img className="r-photo" src={m.photo} alt="" />}
      </header>

      {m.summary && (
        <Section title={HEADINGS.summary}>
          <p className="r-text">{m.summary}</p>
        </Section>
      )}

      {(hard.length > 0 || soft.length > 0) && (
        <Section title={HEADINGS.skills}>
          <Chips label={SUBHEADINGS.hard} items={hard} showLabel={soft.length > 0} />
          <Chips label={SUBHEADINGS.soft} items={soft} showLabel={hard.length > 0} />
        </Section>
      )}

      {m.experience.length > 0 && (
        <Section title={HEADINGS.experience}>
          {m.experience.map((e, i) => (
            <div className="r-entry" key={i}>
              <div className="r-row">
                <span className="r-strong">{e.role}</span>
                <span className="r-date">{e.dates}</span>
              </div>
              {e.meta && <div className="r-sub">{e.meta}</div>}
              {e.responsibilities.length > 0 && (
                <>
                  <div className="r-level">{SUBHEADINGS.responsibilities}</div>
                  <Bullets items={e.responsibilities} />
                </>
              )}
              {e.accomplishments.length > 0 && (
                <>
                  <div className="r-level">{SUBHEADINGS.accomplishments}</div>
                  <Bullets items={e.accomplishments} />
                </>
              )}
            </div>
          ))}
        </Section>
      )}

      {(m.education.length > 0 || m.credentials.length > 0) && (
        <Section title={HEADINGS.education}>
          {m.education.length > 0 && m.credentials.length > 0 && (
            <div className="r-level r-level-first">{SUBHEADINGS.education}</div>
          )}
          {m.education.map((e, i) => (
            <div className="r-entry" key={i}>
              <div className="r-row">
                <span className="r-strong">{e.degree}</span>
                <span className="r-date">{e.date}</span>
              </div>
              {e.institution && <div className="r-sub">{e.institution}</div>}
              {e.honors && <div className="r-honor">{e.honors}</div>}
            </div>
          ))}
          {m.credentials.length > 0 && (
            <div className={m.education.length ? 'r-gap' : ''}>
              <div className="r-level r-level-first">{SUBHEADINGS.credentials}</div>
              {m.credentials.map((c, i) => (
                <div className="r-entry" key={i}>
                  <div className="r-row">
                    <span className="r-strong">{c.name}</span>
                    <span className="r-date">{c.date}</span>
                  </div>
                  {c.meta && <div className="r-sub">{c.meta}</div>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </article>
  );
});

export default ResumePreview;
