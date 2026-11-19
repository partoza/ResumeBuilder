import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FormSection from './components/FormSection.jsx';
import ResumePreview from './components/ResumePreview.jsx';
import LetterPreview from './components/LetterPreview.jsx';
import { useConfirm } from './components/ConfirmDialog.jsx';
import Select from './components/Select.jsx';
import PdfPages from './components/PdfPages.jsx';
import DesignGallery from './components/DesignGallery.jsx';
import { documentText, findMisspellings, ignoreWord, preloadSpellcheck, replaceWordIn } from './spellcheck.js';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Download, Logo, Moon, Sun, Swap, Upload } from './components/Icons.jsx';
import { ensureCssFont, isStandardFont } from './fonts.js';
import { formatRange, mapRichText, parseRich, runsInRange, serializeRich } from './rich.js';
import { selectionToRanges } from './previewSelection.js';
import { PAPERS, paperOf, paperPx } from './paper.js';
import { RESUME_DESIGNS, designOf } from './designs.js';

const ALIGN_BUTTONS = [
  ['left', 'Align left', AlignLeft],
  ['center', 'Center', AlignCenter],
  ['right', 'Align right', AlignRight],
  ['justify', 'Justify', AlignJustify],
];
import { SECTIONS, blankState, sampleState } from './data.js';
import {
  LETTER_FONTS, LETTER_SECTIONS, LETTER_SIZES, blankLetter, buildLetterModel, letterHasContent, letterWordCount, sampleLetter,
} from './letterData.js';
import { fileName, sectionFilled, sectionHasContent, setIn } from './utils.js';
import { buildModel } from './model.js';
import { LETTER_MAX_PAGES, MAX_PAGES, createLetterPdf, createResumePdf, preloadPdfAssets } from './exportPdf.js';
import {
  clearLetter, clearResume, hydrateLetter, hydrateResume, loadLetter, loadResume, loadUi, saveLetter, saveResume, saveUi, stripIds,
} from './storage.js';

const PAPER_OPTIONS = Object.entries(PAPERS).map(([value, p]) => ({ value, label: p.label }));
const DESIGN_OPTIONS = RESUME_DESIGNS.map((d) => ({ value: d.id, label: d.name }));

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** Runs of a selection target: a paragraph ({ para }) or a letter line ({ part }). */
const runsForTarget = (m, t) => (t.part ? m.parts?.[t.part] : m.paragraphs[t.para]) || [];

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
  const [paper, setPaper] = useState(initialUi.paper); // per document: { resume, letter }
  const [design, setDesign] = useState(initialUi.design); // resume design (designs.js)
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

  useEffect(() => { saveUi({ docTab, swap, paper, design }); }, [docTab, swap, paper, design]);

  const isLetter = docTab === 'letter';
  const docInfo = DOCS[docTab];
  const docPaper = paper[docTab];
  const { w: PAPER_W, h: PAPER_H } = paperPx(docPaper);

  // One normalized model per document feeds both its preview and its PDF.
  const model = useMemo(() => buildModel(data), [data]);
  // Re-render the PDF preview when either the content or the design changes.
  const resumeVersion = useMemo(() => ({ model, design }), [model, design]);
  const letterModel = useMemo(() => buildLetterModel(data.personal, letter), [data.personal, letter]);
  const words = isLetter ? letterWordCount(letterModel) : 0;

  // The preview renders the real PDF page by page (PdfPages), which also reports
  // the page count. Until it's ready — or while the form is empty — the live HTML
  // preview (with placeholders) is shown instead.
  const [pages, setPages] = useState(1);
  const [pdfView, setPdfView] = useState({ tab: null, ok: false });
  useEffect(preloadPdfAssets, []);

  /* ---- spell check (red squiggles in the preview) ---- */
  const [spellOn, setSpellOn] = useState(() => {
    try { return localStorage.getItem('resume-builder:spell') !== 'off'; } catch { return true; }
  });
  const [misspelled, setMisspelled] = useState(() => new Set());
  const [dictVersion, setDictVersion] = useState(0);
  useEffect(() => {
    try { localStorage.setItem('resume-builder:spell', spellOn ? 'on' : 'off'); } catch { /* ignore */ }
    if (spellOn) preloadSpellcheck();
  }, [spellOn]);
  useEffect(() => {
    if (!spellOn) { setMisspelled(new Set()); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      findMisspellings(documentText(docTab, data, letter))
        .then((set) => alive && setMisspelled((prev) => (sameSet(prev, set) ? prev : set)))
        .catch((err) => console.warn('Spell check unavailable', err));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [spellOn, docTab, data, letter, dictVersion]);

  // Fix a word everywhere it appears in the open document's text fields.
  const fixWord = useCallback((word, replacement) => {
    const fix = (t) => replaceWordIn(t, word, replacement);
    if (docTab === 'letter') {
      const RICH = ['opening', 'body', 'closing'];
      setLetter((l) => ({ ...l, content: Object.fromEntries(Object.entries(l.content).map(([k, v]) => [k, k === 'greeting' ? v : RICH.includes(k) ? mapRichText(v, fix) : fix(v)])) }));
    } else {
      setData((d) => ({
        ...d,
        personal: { ...d.personal, title: fix(d.personal.title) },
        summary: { text: fix(d.summary.text) },
        skills: { hard: fix(d.skills.hard), soft: fix(d.skills.soft) },
        experience: d.experience.map((e) => ({ ...e, role: fix(e.role), typeOther: fix(e.typeOther), responsibilities: fix(e.responsibilities), accomplishments: fix(e.accomplishments) })),
        education: d.education.map((e) => ({ ...e, degree: fix(e.degree), honors: fix(e.honors) })),
        trainings: d.trainings.map((t) => ({ ...t, name: fix(t.name) })),
        credentials: d.credentials.map((c) => ({ ...c, name: fix(c.name) })),
      }));
    }
    notify(`Changed “${word}” to “${replacement}”`);
  }, [docTab, notify]);

  const ignoreSpelling = useCallback((word) => {
    ignoreWord(word);
    setDictVersion((v) => v + 1);
    notify(`“${word}” added to your dictionary`);
  }, [notify]);

  /* ---- select text in the preview and format it (cover letter) ---- */
  const previewRef = useRef(null);
  const selRanges = useRef(null); // last selection in the preview's paragraphs: [{ para, a, b }]
  const [selStyle, setSelStyle] = useState(null); // { bold, italic, font, size } of that selection

  useEffect(() => {
    if (!isLetter) { selRanges.current = null; setSelStyle(null); return undefined; }
    const onSel = () => {
      const sel = window.getSelection();
      const inPreview = sel && sel.rangeCount && previewRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer);
      if (inPreview) {
        const ranges = selectionToRanges(previewRef.current);
        selRanges.current = ranges;
        if (!ranges) { setSelStyle(null); return; }
        const pieces = ranges.flatMap((t) => runsInRange(runsForTarget(letterModel, t), t.a, t.b));
        const all = (k) => pieces.length > 0 && pieces.every((r) => !!r[k]);
        const same = (k, dflt) => { const v = new Set(pieces.map((r) => r[k] || dflt)); return v.size === 1 ? [...v][0] : null; };
        setSelStyle({ bold: all('bold'), italic: all('italic'), font: same('font', letterModel.font.name), size: same('size', letterModel.size) });
      } else if (sel && !sel.isCollapsed) {
        // A new selection somewhere else (e.g. the form) replaces the preview selection.
        selRanges.current = null;
        setSelStyle(null);
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [isLetter, letterModel]);

  /** Apply bold / italic (toggle) or a font / size to the text selected in the preview. */
  const formatSelection = useCallback((kind, value) => {
    const ranges = selRanges.current;
    if (!ranges?.length) return false;
    const pieces = ranges.flatMap((t) => runsInRange(runsForTarget(letterModel, t), t.a, t.b));
    let v = value;
    if (kind === 'bold' || kind === 'italic') v = !(pieces.length && pieces.every((r) => !!r[kind]));
    if (kind === 'font') ensureCssFont(v);
    const patch = (r) => {
      const out = { ...r };
      if (v === false || v === null || v === undefined) delete out[kind];
      else out[kind] = v;
      return out;
    };
    const sources = letterModel.paragraphSources;
    setLetter((l) => {
      const content = { ...l.content };
      const styles = { ...(l.styles || {}) };
      const parsed = {};
      for (const t of ranges) {
        if (t.part) {
          // Date, recipient, Re:, salutation, close, name, title, enclosure: stored per part.
          const runs = letterModel.parts?.[t.part];
          if (runs) styles[t.part] = serializeRich([formatRange(runs, t.a, t.b, patch)]);
          continue;
        }
        const src = sources[t.para];
        if (!src) continue;
        parsed[src.field] = parsed[src.field] || parseRich(content[src.field]);
        const runs = parsed[src.field][src.index];
        if (runs) parsed[src.field][src.index] = formatRange(runs, t.a, t.b, patch);
      }
      for (const [field, paras] of Object.entries(parsed)) content[field] = serializeRich(paras);
      return { ...l, content, styles };
    });
    selRanges.current = null;
    setSelStyle(null);
    window.getSelection()?.removeAllRanges();
    return true;
  }, [letterModel]);

  const toggleStyle = (kind) => {
    if (!formatSelection(kind)) notify('Select some text in the letter preview first, then click B or I.');
  };

  // Ctrl/Cmd+B and +I while text is selected in the preview.
  useEffect(() => {
    if (!isLetter) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ((k === 'b' || k === 'i') && selRanges.current) {
        e.preventDefault();
        formatSelection(k === 'b' ? 'bold' : 'italic');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLetter, formatSelection]);
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
  }, [zoom, PAPER_W]);

  useLayoutEffect(fit, [fit, data, letter, docTab, view, docPaper]);

  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (scrollRef.current) ro.observe(scrollRef.current);
    if (paperRef.current) ro.observe(paperRef.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit, docTab]);

  const stepZoom = (dir) => setZoom(Math.min(1.5, Math.max(0.3, Math.round((scale + dir * 0.1) * 10) / 10)));

  /* ---- PDF builders ---- */
  const buildPdf = () => (isLetter ? createLetterPdf(letterModel, { paper: docPaper }) : createResumePdf(model, { paper: docPaper, design }));
  // Download/Print also embed the form data, so "Import PDF" can restore every field later.
  const buildExportPdf = () =>
    isLetter
      ? createLetterPdf(letterModel, { source: letter, paper: docPaper })
      : createResumePdf(model, { source: stripIds(data), paper: docPaper, design });

  /* ---- print: prints the exact PDF that Download saves ---- */
  const [printing, setPrinting] = useState(false);
  const printRef = useRef(null);
  printRef.current = async function printPdf() {
    if (printing) return;
    setPrinting(true);
    try {
      const doc = await buildExportPdf();
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

  /* ---- import a PDF back into the form ---- */
  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function importFile(file) {
    if (!file || importing) return;
    setImporting(true);
    try {
      const { readPdf, parseResume, parseLetter, looksLikeLetter, ImportError } = await import('./importPdf.js');
      const { embedded, lines, photo } = await readPdf(file);
      if (!embedded && !lines.some((l) => l.text)) {
        throw new ImportError('No selectable text found — it may be a scanned image. Please type your details instead.');
      }

      const kind = embedded ? embedded.kind : looksLikeLetter(lines) ? 'letter' : 'resume';
      const label = kind === 'letter' ? 'cover letter' : 'resume';
      const hasExisting = kind === 'letter' ? letterHasContent(letter) : resumeHasContent;
      if (
        hasExisting &&
        !(await confirm({
          title: `Replace your ${label}?`,
          description: `“${file.name}” will replace what you’ve entered in the ${label}. This can’t be undone.`,
          confirmLabel: 'Import and replace',
        }))
      ) return;

      if (kind === 'resume') {
        let source = embedded ? embedded.data : parseResume(lines);
        if (!embedded) {
          // Keep one empty entry in sections the PDF didn't have, like a fresh form.
          source = Object.fromEntries(Object.entries(source).filter(([, v]) => !Array.isArray(v) || v.length));
          if (photo) source.personal = { ...source.personal, photo };
        }
        setData(withAllIds(hydrateResume(source)));
      } else {
        const source = embedded ? embedded.data : { ...parseLetter(lines), format: letter.format };
        setLetter(hydrateLetter(source));
      }
      if (kind !== docTab) switchDoc(kind);
      notify(
        embedded
          ? `Imported “${file.name}” — every field restored.`
          : `Imported “${file.name}”. Review each section — some details may need fixing.`
      );
    } catch (err) {
      console.error(err);
      notify(err?.name === 'ImportError' ? err.message : 'Couldn’t import that PDF.');
    } finally {
      setImporting(false);
    }
  }

  const dragHasFile = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const dropHandlers = {
    onDragOver: (e) => {
      if (!dragHasFile(e)) return;
      e.preventDefault();
      if (!dragging) setDragging(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
    },
    onDrop: (e) => {
      if (!dragHasFile(e)) return;
      e.preventDefault();
      setDragging(false);
      importFile(e.dataTransfer.files[0]);
    },
  };

  async function downloadPdf() {
    setBusy(true);
    try {
      const doc = await buildExportPdf();
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
  const paperStyle = { transform: `scale(${scale})`, width: PAPER_W, minHeight: PAPER_H };
  const docHasContent = isLetter ? letterHasContent(letter) : resumeHasContent;
  const showPdfPages = docHasContent && pdfView.ok && pdfView.tab === docTab;

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
        <section
          className={`pane pane-form${dragging ? ' is-dragging' : ''}`}
          aria-label={`${docInfo.tab} form`}
          ref={formScrollRef}
          {...dropHandlers}
        >
          <div className="form-inner">
            <div className="form-intro">
              <h1>{docInfo.heading}</h1>
              <p>{docInfo.intro}</p>
              <div className="intro-actions">
                <button className="btn btn-secondary btn-sm" onClick={loadSample}>Load sample</button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  title="Import a PDF to edit it — drag and drop works too"
                >
                  <Upload size={14} />
                  {importing ? 'Importing…' : 'Import PDF'}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    importFile(file);
                  }}
                />
                <button className="btn btn-ghost btn-sm danger" onClick={clearAll}>Clear all</button>
                <span className={`save-status is-${saveStatus}`} role="status" aria-live="polite">
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved in this browser'}
                </span>
              </div>
            </div>

            <form className="form" onSubmit={(e) => e.preventDefault()} autoComplete="on" key={docTab}>
              {!isLetter && <DesignGallery value={design} onChange={setDesign} />}
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
                  ariaLabel={selStyle ? 'Font of selected text' : 'Font'}
                  value={selStyle ? selStyle.font || '' : letterModel.font.name}
                  placeholder="Font"
                  options={LETTER_FONTS.map((f) => ({ value: f.name, label: f.label || f.name, style: { fontFamily: f.css } }))}
                  onChange={(v) => {
                    ensureCssFont(v);
                    if (!formatSelection('font', v)) updateLetter(['format', 'font'], v);
                  }}
                />
                <Select
                  size="sm"
                  className="tool-size"
                  ariaLabel={selStyle ? 'Size of selected text' : 'Font size'}
                  value={selStyle ? selStyle.size || '' : letterModel.size}
                  placeholder="–"
                  options={LETTER_SIZES.map((n) => ({ value: n, label: String(n) }))}
                  onChange={(v) => {
                    if (!formatSelection('size', Number(v))) updateLetter(['format', 'size'], Number(v));
                  }}
                />
                <div className="align-group" role="group" aria-label="Text style">
                  <button
                    type="button"
                    className={`align-btn style-btn${selStyle?.bold ? ' is-active' : ''}`}
                    aria-pressed={!!selStyle?.bold}
                    aria-label="Bold"
                    title="Bold (Ctrl+B) — select text in the preview first"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleStyle('bold')}
                  >
                    <b>B</b>
                  </button>
                  <button
                    type="button"
                    className={`align-btn style-btn${selStyle?.italic ? ' is-active' : ''}`}
                    aria-pressed={!!selStyle?.italic}
                    aria-label="Italic"
                    title="Italic (Ctrl+I) — select text in the preview first"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleStyle('italic')}
                  >
                    <i>I</i>
                  </button>
                </div>
                <div className="align-group" role="radiogroup" aria-label="Paragraph alignment">
                  {ALIGN_BUTTONS.map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={letterModel.align === value}
                      aria-label={label}
                      title={`${label} (paragraphs)`}
                      className={`align-btn${letterModel.align === value ? ' is-active' : ''}`}
                      onClick={() => updateLetter(['format', 'align'], value)}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isLetter && (
              <div className="format-bar" role="group" aria-label="Resume design">
                <span className="design-label" aria-hidden="true">Design</span>
                <span className="design-pick" title={designOf(design).desc}>
                  <Select
                    size="sm"
                    className="tool-design"
                    ariaLabel="Resume design"
                    value={design}
                    options={DESIGN_OPTIONS}
                    onChange={setDesign}
                  />
                </span>
              </div>
            )}
            <div className="toolbar-right">
            <button
              type="button"
              className={`spell-toggle${spellOn ? ' is-on' : ''}${spellOn && misspelled.size ? ' has-errors' : ''}`}
              aria-pressed={spellOn}
              title={spellOn ? 'Spell check is on — click to turn it off' : 'Spell check is off — click to turn it on'}
              onClick={() => setSpellOn((v) => !v)}
            >
              <span className="spell-icon" aria-hidden="true">abc</span>
              {spellOn ? (misspelled.size ? `${misspelled.size} spelling` : 'Spelling OK') : 'Spelling off'}
            </button>
            <span className="paper-pick" title={`Paper size: ${paperOf(docPaper).name}`}>
              <Select
                size="sm"
                className="tool-paper"
                ariaLabel="Paper size"
                value={docPaper}
                options={PAPER_OPTIONS}
                onChange={(v) => setPaper((p) => ({ ...p, [docTab]: v }))}
              />
            </span>
            <span className={`page-count${overLimit ? ' over' : ''}`}>
              {pages} {pages === 1 ? 'page' : 'pages'}
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
          <div className="preview-scroll" ref={(el) => { scrollRef.current = el; previewRef.current = el; }}>
            {!showPdfPages && (
              <div className="paper-wrap" style={{ width: PAPER_W * scale, height: paperH * scale }}>
                {isLetter ? (
                  <LetterPreview ref={paperRef} model={letterModel} style={paperStyle} />
                ) : (
                  <ResumePreview ref={paperRef} model={model} design={design} style={paperStyle} />
                )}
              </div>
            )}
            <div hidden={!showPdfPages}>
              <PdfPages
                key={docTab}
                build={buildPdf}
                version={isLetter ? letterModel : resumeVersion}
                paper={docPaper}
                width={PAPER_W * scale}
                maxPages={docInfo.max}
                onPageCount={setPages}
                onReady={(ok) => setPdfView({ tab: docTab, ok })}
                embeddedFonts={!isLetter || letterModel.fontsUsed.every((n) => !isStandardFont(n))}
                misspelled={misspelled}
                onReplace={fixWord}
                onIgnore={ignoreSpelling}
              />
            </div>
          </div>
        </section>
      </main>

      {toastView}
      {confirmDialog}
    </>
  );
}
