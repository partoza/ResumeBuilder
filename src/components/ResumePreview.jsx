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

function ContactItems({ items }) {
  return items.map(({ type, text, href, ownRow }) => {
    const Icon = CONTACT_ICON[type] || Link;
    const cls = ownRow ? 'r-own-row' : undefined;
    return href ? (
      <a key={type} className={cls} href={href} target="_blank" rel="noopener noreferrer"><Icon size={11} />{text}</a>
    ) : (
      <span key={type} className={cls}><Icon size={11} />{text}</span>
    );
  });
}

/** One dated entry (title row + date); the Timeline layout moves the date into its rail. */
function Entry({ title, date, children }) {
  return (
    <div className={`r-entry${date ? ' r-dated' : ''}`}>
      <div className="r-row">
        <span className="r-strong">{title}</span>
        {date && <span className="r-date">{date}</span>}
      </div>
      {children}
    </div>
  );
}

// Two-column layouts: the main column tells the story, the side column holds the facts.
const MAIN = ['summary', 'experience', 'references'];
const SIDE = ['skills', 'education', 'trainings'];
const ALL = ['summary', 'skills', 'experience', 'education', 'trainings', 'references'];

/** Renders the normalized resume model (see model.js). exportPdf.js draws the same design. */
const ResumePreview = forwardRef(function ResumePreview({ model: m, design, style }, ref) {
  const d = designOf(design);
  const layout = d.layout || 'single';
  const { hard, soft } = m.skills;
  useEffect(() => { if (d.serif) ensureCssFont(d.serif); }, [d.serif]);
  const serifCss = d.serif ? fontByName(d.serif)?.css : null;
  const empty = !m.name && !m.contact.length;
  const sidebar = layout === 'sidebar';

  const nameBlock = (
    <>
      <h1 className={`r-name${m.name ? '' : ' r-placeholder'}`}>{m.name || 'Your Name'}</h1>
      {m.title ? (
        <div className="r-role">{m.title}</div>
      ) : (
        empty && <div className="r-role r-placeholder">Desired position</div>
      )}
    </>
  );
  const contactBlock = m.contact.length > 0 ? (
    <div className="r-contact"><ContactItems items={m.contact} /></div>
  ) : (
    empty && <div className="r-contact r-placeholder"><span>Contact number</span><span>Email</span><span>Link</span><span className="r-own-row">Address, ZIP code</span></div>
  );

  const blocks = {
    summary: m.summary && (
      <Section key="summary" title={HEADINGS.summary}>
        <p className="r-text">{m.summary}</p>
      </Section>
    ),
    skills: (hard.length > 0 || soft.length > 0) && (
      <Section key="skills" title={HEADINGS.skills}>
        <Chips label={SUBHEADINGS.hard} items={hard} showLabel asText={d.skills.style === 'text'} />
        <Chips label={SUBHEADINGS.soft} items={soft} showLabel asText={d.skills.style === 'text'} />
      </Section>
    ),
    experience: m.experience.length > 0 && (
      <Section key="experience" title={HEADINGS.experience}>
        {m.experience.map((e, i) => (
          <Entry key={i} title={e.role} date={e.dates}>
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
          </Entry>
        ))}
      </Section>
    ),
    education: (m.education.length > 0 || m.credentials.length > 0) && (
      <Section key="education" title={HEADINGS.education}>
        {m.education.length > 0 && m.credentials.length > 0 && (
          <div className="r-level r-level-first">{SUBHEADINGS.education}</div>
        )}
        {m.education.map((e, i) => (
          <Entry key={i} title={e.degree} date={e.date}>
            {e.institution && <div className="r-sub">{e.institution}</div>}
            {e.honors && <div className="r-honor">{e.honors}</div>}
          </Entry>
        ))}
        {m.credentials.length > 0 && (
          <div className={m.education.length ? 'r-gap' : ''}>
            <div className="r-level r-level-first">{SUBHEADINGS.credentials}</div>
            {m.credentials.map((c, i) => (
              <Entry key={i} title={c.name} date={c.date}>
                {c.meta && <div className="r-sub">{c.meta}</div>}
              </Entry>
            ))}
          </div>
        )}
      </Section>
    ),
    trainings: m.trainings.length > 0 && (
      <Section key="trainings" title={HEADINGS.trainings}>
        {m.trainings.map((t, i) => (
          <Entry key={i} title={t.name} date={t.date}>
            {t.meta && <div className="r-sub">{t.meta}</div>}
          </Entry>
        ))}
      </Section>
    ),
    references: m.references.length > 0 && (
      <Section key="references" title={HEADINGS.references}>
        {m.references.map((r, i) => (
          <Entry key={i} title={r.name}>
            {r.meta && <div className="r-sub">{r.meta}</div>}
            {r.contact && <div className="r-sub">{r.contact}</div>}
          </Entry>
        ))}
      </Section>
    ),
  };
  const place = (ids) => ids.map((id) => blocks[id]).filter(Boolean);

  return (
    <article
      className={`paper design-${d.id} layout-${layout}`}
      ref={ref}
      style={{ ...designVars(d.id), ...(serifCss ? { fontFamily: serifCss } : null), ...style }}
    >
      {sidebar ? (
        <div className="r-cols">
          <aside className="r-side">
            {m.photo && <img className="r-photo" src={m.photo} alt="" />}
            {(m.contact.length > 0 || empty) && (
              <Section title="Contact">{contactBlock}</Section>
            )}
            {place(SIDE)}
          </aside>
          <div className="r-main">
            <header className="r-head"><div className="r-head-text">{nameBlock}</div></header>
            {place(MAIN)}
          </div>
        </div>
      ) : (
        <>
          <header className="r-head">
            <div className="r-head-text">
              {nameBlock}
              {contactBlock}
            </div>
            {m.photo && <img className="r-photo" src={m.photo} alt="" />}
          </header>
          {layout === 'split' ? (
            <div className="r-cols">
              <div className="r-main">{place(MAIN)}</div>
              <div className="r-side">{place(SIDE)}</div>
            </div>
          ) : (
            place(ALL)
          )}
        </>
      )}
    </article>
  );
});

export default ResumePreview;
