import { forwardRef } from 'react';
/** Standard block-format cover letter. exportPdf.js (drawLetter) draws the same layout. */
const LetterPreview = forwardRef(function LetterPreview({ model: m, style }, ref) {
  return (
    <article className="paper" ref={ref} style={style}>
      <div className="r-letter">
        {m.date && <p className="l-date">{m.date}</p>}

        {m.recipient.length > 0 ? (
          <address className="l-recipient">
            {m.recipient.map((line, i) => <div key={i} className={i === 0 ? 'l-strong' : undefined}>{line}</div>)}
          </address>
        ) : (
          <address className="l-recipient r-placeholder">
            <div>Hiring Manager</div><div>Company</div><div>Company address</div>
          </address>
        )}

        {m.subject && <p className="l-subject">{m.subject}</p>}

        <p className="l-salutation">{m.salutation}</p>

        {m.paragraphs.length > 0 ? (
          m.paragraphs.map((p, i) => <p key={i} className="l-para">{p}</p>)
        ) : (
          <p className="l-para r-placeholder">
            Your opening, body and closing paragraphs will appear here.
          </p>
        )}

        <p className="l-close">{m.complimentary}</p>
        <div className="l-sign-space" aria-hidden="true" />
        <p className={`l-strong l-name${m.name ? '' : ' r-placeholder'}`}>{m.name || 'Your Name'}</p>

        {m.enclosure && <p className="l-enclosure">{m.enclosure}</p>}
      </div>
    </article>
  );
});

export default LetterPreview;
