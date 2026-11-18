// Rich text for the cover letter's paragraphs (bold, italic, size and font on any part of the text).
//
// Stored format: a canonical HTML subset produced only by serializeRich():
//   <p><span data-size="14" data-font="Lora" style="…"><b><i>text</i></b></span></p>
// Plain strings from older letters (paragraphs separated by blank lines) are still accepted.
// Anything else — pasted, imported or tampered HTML — is parsed with an inert DOMParser
// and rebuilt from text plus whitelisted styles, so no foreign markup ever survives.
import { fontByName } from './fonts.js';

export const RUN_SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const isRich = (v) => typeof v === 'string' && /^\s*<p[\s>]/i.test(v);

const sameStyle = (a, b) =>
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && (a.size || 0) === (b.size || 0) && (a.font || '') === (b.font || '');

function pushRun(runs, r) {
  const text = String(r.text || '').replace(/ /g, ' ');
  if (!text) return;
  const run = { text };
  if (r.bold) run.bold = true;
  if (r.italic) run.italic = true;
  if (r.size) run.size = r.size;
  if (r.font) run.font = r.font;
  const last = runs[runs.length - 1];
  if (last && sameStyle(last, run)) last.text += run.text;
  else runs.push(run);
}

/** Style of an element on top of its parent's style. Only known fonts and sane sizes are kept. */
function styleOf(el, parent) {
  const s = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') s.bold = true;
  const fw = el.style?.fontWeight;
  if (fw) s.bold = fw === 'bold' || fw === 'bolder' || Number(fw) >= 600;
  if (tag === 'I' || tag === 'EM') s.italic = true;
  const fs = el.style?.fontStyle;
  if (fs) s.italic = fs === 'italic' || fs === 'oblique';
  const font = el.dataset?.font || (tag === 'FONT' ? el.getAttribute('face') : '');
  if (font && fontByName(font)) s.font = font;
  const size = Number(el.dataset?.size);
  if (size >= 6 && size <= 72) s.size = size;
  return s;
}

function collectRuns(root, base = {}) {
  const runs = [];
  const walk = (node, st) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) pushRun(runs, { ...st, text: n.nodeValue.replace(/[\t\r\n]+/g, ' ') });
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') pushRun(runs, { ...st, text: '\n' });
        else if (!['SCRIPT', 'STYLE', 'TEMPLATE'].includes(n.tagName)) walk(n, styleOf(n, st));
      }
    }
  };
  walk(root, base);
  // Trim the paragraph's outer whitespace.
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, '');
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
  }
  return runs.filter((r) => r.text);
}

const BLOCKS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

/** Paragraphs (arrays of runs) from any DOM root: blocks become paragraphs, loose inline content too. */
function paragraphsFrom(root) {
  const paras = [];
  let loose = null;
  const flushLoose = () => {
    if (loose) {
      const runs = collectRuns(loose);
      if (runs.length) paras.push(runs);
      loose = null;
    }
  };
  for (const n of [...root.childNodes]) {
    if (n.nodeType === 1 && BLOCKS.has(n.tagName)) {
      flushLoose();
      // Nested blocks (e.g. Chrome's <div><div>) are flattened into separate paragraphs.
      if ([...n.children].some((c) => BLOCKS.has(c.tagName))) paras.push(...paragraphsFrom(n));
      else {
        const runs = collectRuns(n, styleOf(n, {}));
        if (runs.length) paras.push(runs);
      }
    } else {
      loose = loose || document.createElement('div');
      loose.append(n.cloneNode(true));
    }
  }
  flushLoose();
  return paras;
}

/** Paragraphs of runs: [[{ text, bold?, italic?, size?, font? }, …], …] from a stored value (rich or plain). */
export function parseRich(value) {
  if (!value) return [];
  if (!isRich(value)) {
    return String(value)
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
      .filter(Boolean)
      .map((text) => [{ text }]);
  }
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${value}</body>`, 'text/html');
  return paragraphsFrom(doc.body);
}

function runHtml(r) {
  const f = r.font && fontByName(r.font);
  const style = [r.size ? `font-size:${r.size}pt` : '', f ? `font-family:${f.css}` : ''].filter(Boolean).join(';');
  const attrs = `${r.size ? ` data-size="${r.size}"` : ''}${f ? ` data-font="${esc(f.name)}"` : ''}${style ? ` style="${esc(style)}"` : ''}`;
  let inner = esc(r.text).replace(/\n/g, '<br>');
  if (r.italic) inner = `<i>${inner}</i>`;
  if (r.bold) inner = `<b>${inner}</b>`;
  return attrs ? `<span${attrs}>${inner}</span>` : inner;
}

/** Canonical stored HTML for paragraphs of runs ('' when empty). */
export function serializeRich(paras) {
  return paras.filter((p) => p.some((r) => r.text.trim())).map((p) => `<p>${p.map(runHtml).join('')}</p>`).join('');
}

/** Read the editor's DOM (whatever the browser produced) into canonical stored HTML. */
export const sanitizeEditor = (root) => serializeRich(paragraphsFrom(root));

/** Canonical HTML to load into the editor. */
export const toEditorHtml = (value) => serializeRich(parseRich(value));

/** Plain text (paragraphs separated by blank lines) — for word count, spell check, emptiness. */
export const richPlain = (value) => parseRich(value).map((p) => p.map((r) => r.text).join('')).join('\n\n');

/** Apply a text transform to every run's text, keeping formatting (e.g. spelling fixes). */
export function mapRichText(value, fn) {
  if (!value) return value;
  if (!isRich(value)) return fn(value);
  return serializeRich(parseRich(value).map((p) => p.map((r) => ({ ...r, text: fn(r.text) }))));
}

/** Names of fonts used inside rich values. */
export function richFonts(values) {
  const out = new Set();
  for (const v of values) for (const p of parseRich(v)) for (const r of p) if (r.font) out.add(r.font);
  return out;
}

/* ---------------- formatting a character range ---------------- */

/** Split a paragraph's runs so that offsets a and b fall on run boundaries. */
function splitAt(runs, a, b) {
  const out = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    const cuts = [a, b].filter((x) => x > pos && x < end).map((x) => x - pos);
    let last = 0;
    for (const c of [...cuts, r.text.length]) {
      if (c > last) out.push({ ...r, text: r.text.slice(last, c), _start: pos + last });
      last = c;
    }
    pos = end;
  }
  return out;
}

/** The runs (pieces) of paragraph runs between character offsets a and b. */
export function runsInRange(runs, a, b) {
  return splitAt(runs, a, b).filter((r) => r._start >= a && r._start < b);
}

/**
 * Apply `patch(run) → run` to the characters [a, b) of a paragraph's runs.
 * Returns new runs (adjacent identical styles merged).
 */
export function formatRange(runs, a, b, patch) {
  const pieces = splitAt(runs, a, b).map((r) => {
    const { _start, ...run } = r;
    return _start >= a && _start < b ? patch(run) : run;
  });
  const merged = [];
  for (const r of pieces) pushRun(merged, r);
  return merged;
}

/** Plain text of a paragraph's runs (offsets used by formatRange). */
export const paragraphText = (runs) => runs.map((r) => r.text).join('');
