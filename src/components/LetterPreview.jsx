import { forwardRef, useEffect } from 'react';
import { ensureCssFont, letterFont } from '../fonts.js';

/**
 * Standard block-format cover letter: 1" margins, chosen font (default Times New Roman 12pt), single-spaced,
 * one blank line between parts, two above the salutation and the close, three for the signature.
 * The recipient's name (or HIRING MANAGER) is in bold capitals.
 * exportPdf.js (drawLetter) draws the identical layout.
 */
const LetterPreview = forwardRef(function LetterPreview({ model: m, style }, ref) {
  const fontsKey = (m.fontsUsed || []).join('|');
  useEffect(() => {
    for (const f of m.fontsUsed || []) ensureCssFont(f);
  }, [fontsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <article
      className="paper paper-letter"
      ref={ref}
      style={{ ...style, fontFamily: m.font.css, fontSize: `${m.size}pt` }}
    >
      <div className="r-letter">
        {m.date && <p className="l-date">{m.date}</p>}

        <address className="l-block">
          {m.recipient.map((line, i) => <div key={i} className={i === 0 ? 'l-to' : undefined}>{line}</div>)}
          {m.recipient.length < 2 && (
            <div className="r-placeholder"><div>Company</div><div>Company address</div></div>
          )}
        </address>

        {m.subject && <p className="l-block">{m.subject}</p>}

        <p className="l-gap2">{m.salutation}</p>

        {m.paragraphs.length > 0 ? (
          m.paragraphs.map((runs, i) => (
            <p key={i} className="l-block l-para" style={{ textAlign: m.align }}>
              {runs.map((r, j) => {
                const f = r.font ? letterFont(r.font) : null;
                const style = {
                  fontWeight: r.bold ? 700 : undefined,
                  fontStyle: r.italic ? 'italic' : undefined,
                  fontSize: r.size ? `${r.size}pt` : undefined,
                  fontFamily: f ? f.css : undefined,
                };
                return <span key={j} style={style}>{r.text}</span>;
              })}
            </p>
          ))
        ) : (
          <p className="l-block r-placeholder">Your opening, body and closing paragraphs will appear here.</p>
        )}

        <p className="l-gap2">{m.complimentary}</p>
        <p className={`l-name${m.nameBold ? ' l-bold' : ''}${m.name ? '' : ' r-placeholder'}`}>{m.name || 'Your Name'}</p>
        {m.signatureTitle && <p className="l-sig-title">{m.signatureTitle}</p>}

        {m.enclosure && <p className="l-block">{m.enclosure}</p>}
      </div>
    </article>
  );
});

export default LetterPreview;
