import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FormSection from './components/FormSection.jsx';
import ResumePreview from './components/ResumePreview.jsx';
import { Download, Logo, Moon, Sun, Swap } from './components/Icons.jsx';
import { SECTIONS, blankState, sampleState } from './data.js';
import { fileName, sectionHasContent, setIn } from './utils.js';
import { buildModel } from './model.js';
import { MAX_PAGES, createResumePdf, preloadPdfAssets } from './exportPdf.js';

const PAPER_W = 794; // A4 width in CSS px at 96 dpi

// Stable React keys for repeatable entries.
let nextId = 1;
const withIds = (list) => list.map((it) => (it._id ? it : { ...it, _id: nextId++ }));
function withAllIds(state) {
  const out = { ...state };
  for (const s of SECTIONS) if (s.kind === 'list') out[s.id] = withIds(state[s.id]);
  return out;
}

/* ------------------------------ Theme ------------------------------ */
function useTheme() {
  const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || (mql && mql.matches ? 'dark' : 'light')
  );
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('rb-theme', next); } catch { /* theme pref only */ }
    setTheme(next);
  };
  return [theme, toggle];
}

/* ------------------------------ Toast ------------------------------ */
function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const notify = useCallback((msg, actionLabel, onAction) => {
    clearTimeout(timer.current);
    setToast({ msg, actionLabel, onAction, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), actionLabel ? 5000 : 2400);
  }, []);
  const view = (
    <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
      {toast && (
        <>
          {toast.msg}
          {toast.actionLabel && (
            <button type="button" className="toast-action" onClick={() => { toast.onAction(); setToast(null); }}>
              {toast.actionLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
  return [notify, view];
}

/* ------------------------------- App ------------------------------- */
export default function App() {
  const [data, setData] = useState(() => withAllIds(blankState()));
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [swap, setSwap] = useState(false);
  const [view, setView] = useState('edit'); // mobile only
  const [zoom, setZoom] = useState('fit');
  const [scale, setScale] = useState(1);
  const [paperH, setPaperH] = useState(1123);
  const [busy, setBusy] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [notify, toastView] = useToast();

  const paperRef = useRef(null);
  const scrollRef = useRef(null);

  // One normalized model feeds both the preview and the PDF.
  const model = useMemo(() => buildModel(data), [data]);

  // Lay out the real PDF in the background to report its page count.
  const [pages, setPages] = useState(1);
  useEffect(preloadPdfAssets, []);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const doc = await createResumePdf(model);
        if (!cancelled) setPages(doc.getNumberOfPages());
      } catch { /* ignore */ }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [model]);
  const overLimit = pages > MAX_PAGES;

  /* ---- state updates ---- */
  const update = useCallback((path, value) => setData((d) => setIn(d, path, value)), []);

  const setList = useCallback((id, nextOrFn, focusLast) => {
    setData((d) => ({ ...d, [id]: withIds(typeof nextOrFn === 'function' ? nextOrFn(d[id]) : nextOrFn) }));
    if (focusLast) {
      requestAnimationFrame(() => {
        const last = document.querySelector(`#card-${id} .item:last-child`);
        if (!last) return;
        last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const input = last.querySelector('input:not([type="checkbox"]), textarea');
        if (input) input.focus({ preventScroll: true });
      });
    }
  }, []);

  const toggleSection = (id) =>
    setCollapsed((c) => {
      const n = new Set(c);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const anyContent = SECTIONS.some((s) => sectionHasContent(data, s.id));

  function loadSample() {
    if (anyContent && !confirm('Replace your current entries with sample data?')) return;
    setData(withAllIds(sampleState()));
    notify('Sample resume loaded');
  }
  function clearAll() {
    if (!confirm('Clear all fields?')) return;
    setData(withAllIds(blankState()));
    notify('All fields cleared');
  }

  /* ---- preview scaling ---- */
  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return; // hidden on mobile edit view
    const pad = parseFloat(getComputedStyle(el).paddingLeft) * 2;
    const fitScale = Math.max(0.3, Math.min(1, (el.clientWidth - pad) / PAPER_W));
    setScale(zoom === 'fit' ? fitScale : zoom);
    if (paperRef.current) setPaperH(paperRef.current.offsetHeight);
  }, [zoom]);

  useLayoutEffect(fit, [fit, data, view]);

  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (scrollRef.current) ro.observe(scrollRef.current);
    if (paperRef.current) ro.observe(paperRef.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit]);

  const stepZoom = (dir) => setZoom(Math.min(1.5, Math.max(0.3, Math.round((scale + dir * 0.1) * 10) / 10)));

  /* ---- download ---- */
  async function downloadPdf() {
    setBusy(true);
    try {
      const doc = await createResumePdf(model);
      const n = doc.getNumberOfPages();
      doc.save(fileName(data.personal));
      notify(n > MAX_PAGES ? `Downloaded — but it’s ${n} pages. Trim it to ${MAX_PAGES} pages.` : 'PDF downloaded');
    } catch (err) {
      console.error(err);
      notify('Could not generate PDF — try Print → Save as PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Logo /></span>
          <span className="brand-name">Resume Builder</span>
          <span className="badge">PH Standard</span>
        </div>

        <div className="mobile-tabs" role="tablist" aria-label="View">
          {['edit', 'preview'].map((v) => (
            <button
              key={v}
              className={`seg${view === v ? ' active' : ''}`}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
            >
              {v === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="btn btn-ghost icon-only hide-sm" title="Swap sides" aria-label="Swap form and preview sides" onClick={() => setSwap((s) => !s)}>
            <Swap />
          </button>
          <button className="btn btn-ghost icon-only" title="Toggle theme" aria-label="Toggle dark mode" onClick={toggleTheme}>
            {theme === 'dark' ? <Moon /> : <Sun />}
          </button>
          <button className="btn btn-secondary hide-sm" onClick={() => window.print()}>Print</button>
          <button className="btn btn-primary" id="downloadBtn" onClick={downloadPdf} disabled={busy}>
            <Download size={15} />
            <span>{busy ? 'Generating…' : 'Download PDF'}</span>
          </button>
        </div>
      </header>

      <main className={`workspace${swap ? ' swap' : ''}`} data-view={view}>
        <section className="pane pane-form" aria-label="Resume details">
          <div className="form-inner">
            <div className="form-intro">
              <h1>Build your resume</h1>
              <p>Answer the fields below in your own words — the preview formats them into an ATS-friendly resume. Nothing is stored; download your PDF when you’re done.</p>
              <div className="intro-actions">
                <button className="btn btn-secondary btn-sm" onClick={loadSample}>Load sample</button>
                <button className="btn btn-ghost btn-sm danger" onClick={clearAll}>Clear all</button>
              </div>
            </div>

            <form className="form" onSubmit={(e) => e.preventDefault()} autoComplete="on">
              {SECTIONS.map((s, i) => (
                <FormSection
                  key={s.id}
                  section={s}
                  number={i + 1}
                  state={data}
                  done={sectionHasContent(data, s.id)}
                  collapsed={collapsed.has(s.id)}
                  onToggle={() => toggleSection(s.id)}
                  update={update}
                  setList={setList}
                  notify={notify}
                />
              ))}
            </form>
            <footer className="form-footer">
              <span>Runs entirely in your browser — no account, no database.</span>
              <span>
                Developed by{' '}
                <a href="https://portfolio.partoza.dev" target="_blank" rel="noopener noreferrer">
                  John Rex Partoza
                </a>
              </span>
            </footer>
          </div>
        </section>

        <section className="pane pane-preview" aria-label="Resume preview">
          <div className="preview-toolbar">
            <span className={`page-count${overLimit ? ' over' : ''}`}>
              A4 · {pages} {pages === 1 ? 'page' : 'pages'}
              {overLimit ? ` — over the ${MAX_PAGES}-page limit` : ` of ${MAX_PAGES} max`}
            </span>
            <div className="zoom">
              <button className="btn btn-ghost btn-xs" aria-label="Zoom out" onClick={() => stepZoom(-1)}>−</button>
              <span className="zoom-label">{Math.round(scale * 100) + '%'}</span>
              <button className="btn btn-ghost btn-xs" aria-label="Zoom in" onClick={() => stepZoom(1)}>+</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setZoom('fit')}>Fit</button>
            </div>
          </div>
          <div className="preview-scroll" ref={scrollRef}>
            <div className="paper-wrap" style={{ width: PAPER_W * scale, height: paperH * scale }}>
              <ResumePreview ref={paperRef} model={model} style={{ transform: `scale(${scale})` }} />
            </div>
          </div>
        </section>
      </main>

      {toastView}
    </>
  );
}
