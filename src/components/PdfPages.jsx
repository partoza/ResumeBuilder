import { useEffect, useRef, useState } from 'react';
import { loadPdfjs } from '../pdfjs.js';

const A4_RATIO = 297 / 210;

/**
 * Shows the real PDF, page by page, so the preview's page cuts are exactly the
 * download's. Re-renders shortly after the content or zoom changes and swaps
 * the pages in only when the new render is complete (no flicker).
 *
 * build:   () => Promise<jsPDF>  (the same generator Download/Print use)
 * version: changes whenever the content changes
 */
export default function PdfPages({ build, version, width, maxPages, onPageCount, onReady }) {
  const [pages, setPages] = useState([]);
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
        const canvases = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: (width * dpr) / page.getViewport({ scale: 1 }).width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          // intent 'print' renders in one pass instead of pacing with requestAnimationFrame,
          // which browsers throttle in background windows (several times faster).
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
          if (id !== job.current) {
            pdf.destroy();
            return;
          }
          canvases.push(canvas);
        }
        pdf.destroy();
        setPages(canvases);
        cb.current.onReady?.(true);
      } catch (err) {
        console.warn('PDF preview failed; showing the live HTML preview instead', err);
        if (id === job.current) cb.current.onReady?.(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [version, width]);

  const height = width * A4_RATIO;
  return (
    <div className="pdf-pages" aria-label="Page preview">
      {pages.map((canvas, i) => {
        const over = i >= maxPages;
        return (
          <figure key={i} className={`pdf-page${over ? ' is-over' : ''}`}>
            <div
              className="pdf-sheet"
              style={{ width, height }}
              ref={(el) => {
                if (el && el.firstChild !== canvas) el.replaceChildren(canvas);
              }}
            />
            <figcaption className="pdf-page-label">
              Page {i + 1} of {pages.length}
              {over && ` — over the ${maxPages}-page limit`}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
