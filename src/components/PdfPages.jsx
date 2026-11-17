import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadPdfjs } from '../pdfjs.js';
import { suggestionsFor, wordOf } from '../spellcheck.js';

const A4_RATIO = 297 / 210;
const WORD_RE = /[A-Za-z][A-Za-z'’]*/g;

/**
 * Shows the real PDF, page by page, so the preview's page cuts are exactly the
 * download's. Re-renders shortly after the content or zoom changes and swaps
 * the pages in only when the new render is complete (no flicker).
 *
 * Each page also gets pdf.js's invisible text layer, positioned over the drawn
 * text, which is used to underline misspelled words (Word-style red squiggles).
 *
 * build:      () => Promise<jsPDF>  (the same generator Download/Print use)
 * version:    changes whenever the content changes
 * misspelled: Set of words to underline (empty = none)
 */
export default function PdfPages({ build, version, width, maxPages, onPageCount, onReady, misspelled, onReplace, onIgnore }) {
  const [pages, setPages] = useState([]);
  const [menu, setMenu] = useState(null); // { word, rect }
  const job = useRef(0);
  const buildRef = useRef(build);
  buildRef.current = build;
  const cb = useRef({ onPageCount, onReady });
  cb.current = { onPageCount, onReady };

  useEffect(() => {
    if (!width) return undefined;
    const id = ++job.current;
    const timer = setTimeout(async () => {
      try {
        const doc = await buildRef.current();
        if (id !== job.current) return;
        cb.current.onPageCount?.(doc.getNumberOfPages());
        const lib = await loadPdfjs();
        if (id !== job.current) return;
        // disableFontFace: draw glyphs as paths instead of registering each embedded
        // font with the browser — ~10× faster for the Inter-based resume.
        const pdf = await lib.getDocument({
          data: new Uint8Array(doc.output('arraybuffer')),
          isEvalSupported: false,
          disableFontFace: true,
        }).promise;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rendered = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const baseWidth = page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: (width * dpr) / baseWidth });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          // intent 'print' renders in one pass instead of pacing with requestAnimationFrame,
          // which browsers throttle in background windows (several times faster).
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;

          // Invisible text layer in CSS pixels, lined up with the canvas.
          const cssViewport = page.getViewport({ scale: width / baseWidth });
          const textLayer = document.createElement('div');
          textLayer.className = 'textLayer';
          textLayer.style.setProperty('--scale-factor', String(cssViewport.scale));
          textLayer.style.setProperty('--total-scale-factor', String(cssViewport.scale));
          try {
            const tl = new lib.TextLayer({ textContentSource: await page.getTextContent(), container: textLayer, viewport: cssViewport });
            await tl.render();
          } catch (err) {
            console.warn('Text layer failed', err);
          }
          if (id !== job.current) {
            pdf.destroy();
            return;
          }
          rendered.push({ canvas, textLayer });
        }
        pdf.destroy();
        setPages(rendered);
        cb.current.onReady?.(true);
      } catch (err) {
        console.warn('PDF preview failed; showing the live HTML preview instead', err);
        if (id === job.current) cb.current.onReady?.(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [version, width]);

  // Underline misspelled words inside the text layers.
  useLayoutEffect(() => {
    for (const { textLayer } of pages) {
      for (const span of textLayer.querySelectorAll(':scope span[role="presentation"], :scope > span')) {
        if (span.dataset.orig === undefined) {
          if (span.children.length) continue; // markedContent wrappers
          span.dataset.orig = span.textContent;
        }
        const text = span.dataset.orig;
        if (!misspelled?.size) {
          if (span.textContent !== text || span.children.length) span.textContent = text;
          continue;
        }
        const frag = document.createDocumentFragment();
        let last = 0;
        let hit = false;
        for (const m of text.matchAll(WORD_RE)) {
          const w = wordOf(m[0]);
          if (!w || !misspelled.has(w)) continue;
          hit = true;
          if (m.index > last) frag.append(text.slice(last, m.index));
          const mark = document.createElement('span');
          mark.className = 'spell-err';
          mark.dataset.word = w;
          mark.title = 'Possible spelling mistake — click for suggestions';
          mark.textContent = m[0];
          frag.append(mark);
          last = m.index + m[0].length;
        }
        if (!hit) {
          if (span.children.length) span.textContent = text;
          continue;
        }
        if (last < text.length) frag.append(text.slice(last));
        span.replaceChildren(frag);
      }
    }
  }, [pages, misspelled]);

  function onClick(e) {
    const mark = e.target.closest?.('.spell-err');
    if (!mark) return;
    setMenu({ word: mark.dataset.word, rect: mark.getBoundingClientRect() });
  }

  const height = width * A4_RATIO;
  return (
    <div className="pdf-pages" aria-label="Page preview" onClick={onClick}>
      {pages.map(({ canvas, textLayer }, i) => {
        const over = i >= maxPages;
        return (
          <figure key={i} className={`pdf-page${over ? ' is-over' : ''}`}>
            <div
              className="pdf-sheet"
              style={{ width, height }}
              ref={(el) => {
                if (el && el.firstChild !== canvas) el.replaceChildren(canvas, textLayer);
              }}
            />
            <figcaption className="pdf-page-label">
              Page {i + 1} of {pages.length}
              {over && ` — over the ${maxPages}-page limit`}
            </figcaption>
          </figure>
        );
      })}
      {menu && (
        <SpellMenu
          {...menu}
          onClose={() => setMenu(null)}
          onReplace={(s) => { onReplace?.(menu.word, s); setMenu(null); }}
          onIgnore={() => { onIgnore?.(menu.word); setMenu(null); }}
        />
      )}
    </div>
  );
}

/** Word-style popover: suggestions for a misspelled word, plus "Ignore". */
function SpellMenu({ word, rect, onClose, onReplace, onIgnore }) {
  const [suggestions, setSuggestions] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    suggestionsFor(word).then((s) => alive && setSuggestions(s)).catch(() => alive && setSuggestions([]));
    return () => { alive = false; };
  }, [word]);

  useEffect(() => {
    const down = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.spell-err')) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    const scroll = () => onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 248));
  const below = rect.bottom + 6;
  const style = below + 220 > window.innerHeight ? { left, bottom: window.innerHeight - rect.top + 6 } : { left, top: below };

  return createPortal(
    <div ref={ref} className="spell-menu" role="dialog" aria-label={`Spelling: ${word}`} style={style}>
      <div className="spell-menu-head">
        <span className="spell-menu-word">{word}</span>
        <span className="spell-menu-sub">Not in dictionary</span>
      </div>
      <div className="spell-menu-list">
        {suggestions === null && <div className="spell-menu-empty">Finding suggestions…</div>}
        {suggestions?.length === 0 && <div className="spell-menu-empty">No suggestions</div>}
        {suggestions?.map((s) => (
          <button key={s} type="button" className="spell-menu-item" onClick={() => onReplace(s)}>{s}</button>
        ))}
      </div>
      <div className="spell-menu-foot">
        <button type="button" className="spell-menu-item muted" onClick={onIgnore}>Ignore — add to my dictionary</button>
      </div>
    </div>,
    document.body
  );
}
