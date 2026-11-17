import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FormSection from './components/FormSection.jsx';
import ResumePreview from './components/ResumePreview.jsx';
import LetterPreview from './components/LetterPreview.jsx';
import { useConfirm } from './components/ConfirmDialog.jsx';
import Select from './components/Select.jsx';
import { Download, Logo, Moon, Sun, Swap } from './components/Icons.jsx';
import { SECTIONS, blankState, sampleState } from './data.js';
import {
  LETTER_FONTS, LETTER_SECTIONS, LETTER_SIZES, blankLetter, buildLetterModel, letterHasContent, letterWordCount, sampleLetter,
} from './letterData.js';
import { fileName, sectionFilled, sectionHasContent, setIn } from './utils.js';
import { buildModel } from './model.js';
import { LETTER_MAX_PAGES, MAX_PAGES, createLetterPdf, createResumePdf, preloadPdfAssets } from './exportPdf.js';
import {
  clearLetter, clearResume, loadLetter, loadResume, loadUi, saveLetter, saveResume, saveUi,
} from './storage.js';

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

/* ---------------------------- Documents ---------------------------- */
const DOCS = {
  resume: {
    tab: 'Resume Builder',
    heading: 'Build your resume',
    intro: 'Answer the fields below in your own words — the preview formats them into an ATS-friendly resume. Everything you type is saved in this browser automatically.',
    max: MAX_PAGES,
    fileLabel: 'Resume',
  },
  letter: {
    tab: 'Cover Letter Builder',
    heading: 'Write your cover letter',
    intro: 'A standard block-format business letter: date, recipient, three short paragraphs and your sign-off. Keep it to one page. Saved in this browser automatically.',
    max: LETTER_MAX_PAGES,
    fileLabel: 'Cover_Letter',
  },
};

/* ------------------------------- App ------------------------------- */
export default function App() {
  // Restore whatever was saved in this browser (falls back to blank forms).
  const [initialUi] = useState(loadUi);
  const [data, setData] = useState(() => withAllIds(loadResume()));
  const [letter, setLetter] = useState(loadLetter);
  const [docTab, setDocTab] = useState(initialUi.docTab);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [swap, setSwap] = useState(initialUi.swap);
  const [view, setView] = useState('edit'); // mobile only
  const [zoom, setZoom] = useState('fit');
  const [scale, setScale] = useState(1);
  const [paperH, setPaperH] = useState(1123);
  const [busy, setBusy] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [notify, toastView] = useToast();
  const [confirm, confirmDialog] = useConfirm();

  /* ---- auto-save to this browser ---- */
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'
  const latest = useRef({ data, letter });
  latest.current = { data, letter };
  const dirty = useRef(false);
  const warnedStorage = useRef(false);

  const flushSave = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const ok = saveResume(latest.current.data) && saveLetter(latest.current.letter);
    setSaveStatus(ok ? 'saved' : 'error');
    if (!ok && !warnedStorage.current) {
      warnedStorage.current = true;
      notify('Couldn’t save in this browser — storage is full or blocked. Download your PDF to keep your work.');
    }
  }, [notify]);

  // Save the latest edit shortly after typing stops…
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    dirty.current = true;
    setSaveStatus('saving');
    const t = setTimeout(flushSave, 400);
    return () => clearTimeout(t);
  }, [data, letter, flushSave]);

  // …and immediately when the tab is hidden, switched away from (Alt+Tab) or closed.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushSave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('blur', flushSave);
    window.addEventListener('beforeunload', flushSave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
      window.removeEventListener('blur', flushSave);
      window.removeEventListener('beforeunload', flushSave);
    };
  }, [flushSave]);

  const paperRef = useRef(null);
  const scrollRef = useRef(null);
  const formScrollRef = useRef(null);

  useEffect(() => { saveUi({ docTab, swap }); }, [docTab, swap]);

  const isLetter = docTab === 'letter';
  const docInfo = DOCS[docTab];

  // One normalized model per document feeds both its preview and its PDF.
  const model = useMemo(() => buildModel(data), [data]);
  const letterModel = useMemo(() => buildLetterModel(data.personal, letter), [data.personal, letter]);
  const words = isLetter ? letterWordCount(letterModel) : 0;

  // Lay out the real PDF in the background to report its page count.
  const [pages, setPages] = useState(1);
  useEffect(preloadPdfAssets, []);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const doc = await (isLetter ? createLetterPdf(letterModel) : createResumePdf(model));
        if (!cancelled) setPages(doc.getNumberOfPages());
      } catch { /* ignore */ }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isLetter, model, letterModel]);
  const overLimit = pages > docInfo.max;

  function switchDoc(next) {
    if (next === docTab) return;
    setDocTab(next);
    setPages(1);
    if (formScrollRef.current) formScrollRef.current.scrollTop = 0;
  }

  /* ---- state updates ---- */
  const update = useCallback((path, value) => setData((d) => setIn(d, path, value)), []);

  const updateLetter = useCallback((path, value) => setLetter((l) => setIn(l, path, value)), []);

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

  const toggleSection = (key) =>
    setCollapsed((c) => {
      const n = new Set(c);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const resumeHasContent = SECTIONS.some((s) => sectionHasContent(data, s.id));

  async function loadSample() {
    if (isLetter) {
      if (
        letterHasContent(letter) &&
        !(await confirm({
          title: 'Load sample cover letter?',
          description: 'This replaces the letter you’ve written with an example.',
          confirmLabel: 'Replace with sample',
        }))
      ) return;
      setLetter((l) => ({ ...sampleLetter(), format: l.format }));
      notify('Sample cover letter loaded');
      return;
    }
    if (
      resumeHasContent &&
      !(await confirm({
        title: 'Load sample resume?',
        description: 'This replaces everything you’ve entered with example data. Your current entries will be lost.',
        confirmLabel: 'Replace with sample',
      }))
    ) return;
    setData(withAllIds(sampleState()));
    notify('Sample resume loaded');
  }

  async function clearAll() {
    if (isLetter) {
      if (!letterHasContent(letter)) {
        notify('Nothing to clear');
        return;
      }
      if (
        !(await confirm({
          title: 'Clear the cover letter?',
          description: 'The recipient, letter text and sign-off will be emptied and removed from this browser. Your resume isn’t affected. This can’t be undone.',
          confirmLabel: 'Clear letter',
          danger: true,
        }))
      ) return;
      setLetter((l) => ({ ...blankLetter(), format: l.format }));
      clearLetter();
      notify('Cover letter cleared');
      return;
    }
    if (!resumeHasContent) {
      notify('Nothing to clear');
      return;
    }
    if (
      !(await confirm({
        title: 'Clear all fields?',
        description: 'Every section will be emptied, including your photo, and the copy saved in this browser is deleted. This can’t be undone.',
        confirmLabel: 'Clear all',
        danger: true,
      }))
    ) return;
    setData(withAllIds(blankState()));
    clearResume();
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

  useLayoutEffect(fit, [fit, data, letter, docTab, view]);

  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (scrollRef.current) ro.observe(scrollRef.current);
    if (paperRef.current) ro.observe(paperRef.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit, docTab]);

  const stepZoom = (dir) => setZoom(Math.min(1.5, Math.max(0.3, Math.round((scale + dir * 0.1) * 10) / 10)));

  /* ---- download ---- */
  /* ---- print: prints the exact PDF that Download saves ---- */
  const [printing, setPrinting] = useState(false);
  const buildPdf = () => (isLetter ? createLetterPdf(letterModel) : createResumePdf(model));
  const printRef = useRef(null);
  printRef.current = async function printPdf() {
    if (printing) return;
    setPrinting(true);
    try {
      const doc = await buildPdf();
      const url = URL.createObjectURL(doc.output('blob'));
      document.getElementById('print-frame')?.remove();
      const frame = document.createElement('iframe');
      frame.id = 'print-frame';
      frame.title = 'Print preview';
      // Must stay rendered (not display:none) for the browser's PDF viewer to load.
      Object.assign(frame.style, {
        position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none',
      });
      frame.onload = () => {
        setTimeout(() => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch {
            // Some browsers can't print an embedded PDF: open it so they can print from the viewer.
            window.open(url, '_blank', 'noopener');
          }
          setPrinting(false);
        }, 300);
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      };
      frame.src = url;
      document.body.appendChild(frame);
    } catch (err) {
      console.error(err);
      notify('Could not prepare the document for printing');
      setPrinting(false);
    }
  };
  const printPdf = () => printRef.current();

  // Ctrl/Cmd+P prints the PDF too, so the printout always matches the download.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function downloadPdf() {
    setBusy(true);
    try {
      const doc = await (isLetter ? createLetterPdf(letterModel) : createResumePdf(model));
      const n = doc.getNumberOfPages();
      doc.save(fileName(data.personal, docInfo.fileLabel));
      const unit = docInfo.max === 1 ? 'page' : 'pages';
      notify(n > docInfo.max ? `Downloaded — but it’s ${n} pages. Trim it to ${docInfo.max} ${unit}.` : 'PDF downloaded');
    } catch (err) {
      console.error(err);
      notify('Could not generate PDF — try Print → Save as PDF');
    } finally {
      setBusy(false);
    }
  }

  const sections = isLetter ? LETTER_SECTIONS : SECTIONS;
  const formState = isLetter ? letter : data;
  const formUpdate = isLetter ? updateLetter : update;
  const paperStyle = { transform: `scale(${scale})` };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Logo /></span>
          <span className="brand-name">Resume Builder</span>
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
          <button className="btn btn-secondary hide-sm" onClick={printPdf} disabled={printing}>
            {printing ? 'Preparing…' : 'Print'}
          </button>
          <button className="btn btn-primary" id="downloadBtn" onClick={downloadPdf} disabled={busy}>
            <Download size={15} />
            <span>{busy ? 'Generating…' : 'Download PDF'}</span>
          </button>
        </div>
      </header>

      <nav className="doc-tabs" role="tablist" aria-label="Document">
        {Object.entries(DOCS).map(([key, d]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={docTab === key}
            className={`doc-tab${docTab === key ? ' active' : ''}`}
            onClick={() => switchDoc(key)}
          >
            {d.tab}
          </button>
        ))}
      </nav>

      <main className={`workspace${swap ? ' swap' : ''}`} data-view={view}>
        <section className="pane pane-form" aria-label={`${docInfo.tab} form`} ref={formScrollRef}>
          <div className="form-inner">
            <div className="form-intro">
              <h1>{docInfo.heading}</h1>
              <p>{docInfo.intro}</p>
              <div className="intro-actions">
                <button className="btn btn-secondary btn-sm" onClick={loadSample}>Load sample</button>
                <button className="btn btn-ghost btn-sm danger" onClick={clearAll}>Clear all</button>
                <span className={`save-status is-${saveStatus}`} role="status" aria-live="polite">
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved in this browser'}
                </span>
              </div>
            </div>

            <form className="form" onSubmit={(e) => e.preventDefault()} autoComplete="on" key={docTab}>
              {sections.map((s, i) => {
                const key = `${docTab}:${s.id}`;
                return (
                  <FormSection
                    key={key}
                    section={s}
                    number={i + 1}
                    state={formState}
                    done={sectionFilled(s, formState[s.id])}
                    collapsed={collapsed.has(key)}
                    onToggle={() => toggleSection(key)}
                    update={formUpdate}
                    setList={setList}
                    notify={notify}
                  />
                );
              })}
            </form>
            <footer className="form-footer">
              <span>
                Developed by{' '}
                <a className="credit" href="https://portfolio.partoza.dev" target="_blank" rel="noopener noreferrer">
                  <img
                    className="credit-avatar"
                    src="/developer.png"
                    alt=""
                    aria-hidden="true"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span>John Rex Partoza</span>
                </a>
              </span>
            </footer>
          </div>
        </section>

        <section className="pane pane-preview" aria-label={`${docInfo.tab} preview`}>
          <div className="preview-toolbar">
            {isLetter && (
              <div className="format-bar" role="group" aria-label="Letter formatting">
                <Select
                  size="sm"
                  className="tool-font"
                  ariaLabel="Font"
                  value={letterModel.font.name}
                  options={LETTER_FONTS.map((f) => ({ value: f.name, label: f.name, style: { fontFamily: f.css } }))}
                  onChange={(v) => updateLetter(['format', 'font'], v)}
                />
                <Select
                  size="sm"
                  className="tool-size"
                  ariaLabel="Font size"
                  value={letterModel.size}
                  options={LETTER_SIZES.map((n) => ({ value: n, label: String(n) }))}
                  onChange={(v) => updateLetter(['format', 'size'], Number(v))}
                />
              </div>
            )}
            <div className="toolbar-right">
            <span className={`page-count${overLimit ? ' over' : ''}`}>
              A4 · {pages} {pages === 1 ? 'page' : 'pages'}
              {overLimit ? ` — over the ${docInfo.max}-page limit` : ` of ${docInfo.max} max`}
              {isLetter && words > 0 && ` · ${words} words`}
            </span>
            <div className="zoom">
              <button className="btn btn-ghost btn-xs" aria-label="Zoom out" onClick={() => stepZoom(-1)}>−</button>
              <span className="zoom-label">{Math.round(scale * 100) + '%'}</span>
              <button className="btn btn-ghost btn-xs" aria-label="Zoom in" onClick={() => stepZoom(1)}>+</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setZoom('fit')}>Fit</button>
            </div>
            </div>
          </div>
          <div className="preview-scroll" ref={scrollRef}>
            <div className="paper-wrap" style={{ width: PAPER_W * scale, height: paperH * scale }}>
              {isLetter ? (
                <LetterPreview ref={paperRef} model={letterModel} style={paperStyle} />
              ) : (
                <ResumePreview ref={paperRef} model={model} style={paperStyle} />
              )}
            </div>
          </div>
        </section>
      </main>

      {toastView}
      {confirmDialog}
    </>
  );
}
