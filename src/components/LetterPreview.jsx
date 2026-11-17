import { forwardRef } from 'react';

/**
 * Standard block-format cover letter: 1" margins, chosen font (default Times New Roman 12pt), single-spaced,
 * one blank line between parts and three blank lines for the signature.
 * exportPdf.js (drawLetter) draws the identical layout.
 */
const LetterPreview = forwardRef(function LetterPreview({ model: m, style }, ref) {
  return (
    <article
      className="paper paper-letter"
      ref={ref}
      style={{ ...style, fontFamily: m.font.css, fontSize: `${m.size}pt` }}
    >
      <div className="r-letter">
        {m.date && <p className="l-date">{m.date}</p>}

        {m.recipient.length > 0 ? (
          <address className="l-block">
            {m.recipient.map((line, i) => <div key={i}>{line}</div>)}
          </address>
        ) : (
          <address className="l-block r-placeholder">
            <div>Hiring Manager</div><div>Company</div><div>Company address</div>
          </address>
        )}

        {m.subject && <p className="l-block">{m.subject}</p>}

        <p className="l-block">{m.salutation}</p>

        {m.paragraphs.length > 0 ? (
          m.paragraphs.map((p, i) => <p key={i} className="l-block">{p}</p>)
        ) : (
          <p className="l-block r-placeholder">Your opening, body and closing paragraphs will appear here.</p>
        )}

        <p className="l-block">{m.complimentary}</p>
        <p className={`l-name${m.name ? '' : ' r-placeholder'}`}>{m.name || 'Your Name'}</p>

        {m.enclosure && <p className="l-block">{m.enclosure}</p>}
      </div>
    </article>
  );
});

export default LetterPreview;
