import { forwardRef, useEffect } from 'react';
import { Facebook, Github, Globe, Link, Linkedin, Mail, Phone, Pin } from './Icons.jsx';
import { HEADINGS, SUBHEADINGS } from '../model.js';
import { designOf, designVars } from '../designs.js';
import { ensureCssFont, fontByName } from '../fonts.js';

const CONTACT_ICON = { phone: Phone, mail: Mail, pin: Pin, linkedin: Linkedin, facebook: Facebook, github: Github, globe: Globe, link: Link };

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

function Chips({ label, items, showLabel, asText }) {
  if (!items.length) return null;
  return (
    <div className="r-skillgrp">
      {showLabel && <div className="r-level">{label}</div>}
      {asText ? (
        <p className="r-text r-skilltext">{items.join('  ·  ')}</p>
      ) : (
        <div className="r-chips">
          {items.map((x, i) => <span className="r-chip" key={i}>{x}</span>)}
        </div>
      )}
    </div>
  );
}

/** Renders the normalized resume model (see model.js). exportPdf.js draws the same design. */
const ResumePreview = forwardRef(function ResumePreview({ model: m, design, style }, ref) {
  const d = designOf(design);
  const { hard, soft } = m.skills;
  useEffect(() => { if (d.serif) ensureCssFont(d.serif); }, [d.serif]);
  const serifCss = d.serif ? fontByName(d.serif)?.css : null;
  const empty = !m.name && !m.contact.length;

  return (
    <article
      className={`paper design-${d.id}`}
      ref={ref}
      style={{ ...designVars(d.id), ...(serifCss ? { fontFamily: serifCss } : null), ...style }}
    >
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
              {m.contact.map(({ type, text, href, ownRow }) => {
                const Icon = CONTACT_ICON[type] || Link;
                const cls = ownRow ? 'r-own-row' : undefined;
                return href ? (
                  <a key={type} className={cls} href={href} target="_blank" rel="noopener noreferrer"><Icon size={11} />{text}</a>
                ) : (
                  <span key={type} className={cls}><Icon size={11} />{text}</span>
                );
              })}
            </div>
          ) : (
            empty && <div className="r-contact r-placeholder"><span>Contact number</span><span>Email</span><span>Link</span><span className="r-own-row">Address, ZIP code</span></div>
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
          <Chips label={SUBHEADINGS.hard} items={hard} showLabel asText={d.skills.style === 'text'} />
          <Chips label={SUBHEADINGS.soft} items={soft} showLabel asText={d.skills.style === 'text'} />
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
              {e.website && (
                <div className="r-extra">
                  <a href={e.website.href} target="_blank" rel="noopener noreferrer">{e.website.text}</a>
                </div>
              )}
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

      {m.trainings.length > 0 && (
        <Section title={HEADINGS.trainings}>
          {m.trainings.map((t, i) => (
            <div className="r-entry" key={i}>
              <div className="r-row">
                <span className="r-strong">{t.name}</span>
                <span className="r-date">{t.date}</span>
              </div>
              {t.meta && <div className="r-sub">{t.meta}</div>}
            </div>
          ))}
        </Section>
      )}

      {m.references.length > 0 && (
        <Section title={HEADINGS.references}>
          {m.references.map((r, i) => (
            <div className="r-entry" key={i}>
              <div className="r-row">
                <span className="r-strong">{r.name}</span>
              </div>
              {r.meta && <div className="r-sub">{r.meta}</div>}
              {r.contact && <div className="r-sub">{r.contact}</div>}
            </div>
          ))}
        </Section>
      )}
    </article>
  );
});

export default ResumePreview;
