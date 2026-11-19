// PDF generator that draws the same design as the on-screen preview (ResumePreview.jsx
// + .paper styles) with jsPDF, in any of the resume designs (designs.js). All words are real, selectable text in embedded Inter,
// so the file stays ATS-readable; only the photo and the small contact icons are images.
import { jsPDF } from 'jspdf';
import inter400 from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import inter400i from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf?url';
import inter500 from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf?url';
import inter600 from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?url';
import inter700 from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import { HEADINGS, SUBHEADINGS } from './model.js';
import { fontByName, isStandardFont, pdfFontFor, registerPdfFonts, styleKey } from './fonts.js';
import { LAYOUT_COLUMNS, designOf } from './designs.js';
import { paperOf } from './paper.js';

export const MAX_PAGES = 2;

/** Fonts and styles a cover letter uses: Map(fontName → Set(style key)). */
function letterFontUsage(m) {
  const usage = new Map();
  const add = (name, k) => (usage.get(name) || usage.set(name, new Set()).get(name)).add(k);
  add(m.font.name, 'r');
  if (m.nameBold) add(m.font.name, 'b');
  for (const p of [...m.paragraphs, ...Object.values(m.parts || {})]) {
    for (const r of p) add(r.font || m.font.name, styleKey(r.bold, r.italic));
  }
  return usage;
}
export const LETTER_MAX_PAGES = 1;
const DOC_LABEL = { resume: 'Resume', letter: 'Cover Letter' };

const PT = 25.4 / 72; // mm per point
const PX = 25.4 / 96; // mm per CSS pixel
const MARGINS = { mx: 56 * PX, mt: 52 * PX, mb: 56 * PX };
const NAME_PT = 20; // the name at the top of the resume (matches .r-name)

const INK = [17, 17, 17];
const INK2 = [63, 63, 70];
const INK3 = [113, 113, 122];
const RULE = [228, 228, 231];

/* ------------------------------------------------------------------ */
/* Assets: fonts and contact icons (loaded once, then cached)          */
/* ------------------------------------------------------------------ */

const FONT_FILES = [
  ['I400', inter400],
  ['I400i', inter400i],
  ['I500', inter500],
  ['I600', inter600],
  ['I700', inter700],
];
// Used only if the Inter files can't be loaded.
const FALLBACK = {
  I400: ['helvetica', 'normal'],
  I400i: ['helvetica', 'italic'],
  I500: ['helvetica', 'normal'],
  I600: ['helvetica', 'bold'],
  I700: ['helvetica', 'bold'],
};

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

let fontsPromise = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map(async ([name, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error('font ' + res.status);
        return [name, toBase64(await res.arrayBuffer())];
      })
    ).catch((err) => {
      console.warn('Inter fonts unavailable, falling back to Helvetica', err);
      return null;
    });
  }
  return fontsPromise;
}

// Same paths as Icons.jsx (Phone, Mail, Pin).
const ICON_SVG = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-8-2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
};

const iconSets = new Map(); // stroke color → Promise({ key: PNG data URL })
function loadIcons(color = '#71717a') {
  if (!iconSets.has(color)) {
    iconSets.set(color, Promise.all(
      Object.entries(ICON_SVG).map(
        ([key, inner]) =>
          new Promise((resolve) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = c.height = 96;
              c.getContext('2d').drawImage(img, 0, 0, 96, 96);
              resolve([key, c.toDataURL('image/png')]);
            };
            img.onerror = () => resolve([key, null]);
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          })
      )
    ).then(Object.fromEntries));
  }
  return iconSets.get(color);
}

/** Start fetching fonts/icons early so the first download is instant. */
export function preloadPdfAssets() {
  loadFonts();
  loadIcons();
}

/** Built-in PDF fonts only cover Latin-1 (used only in the Helvetica fallback). */
export function pdfText(s) {
  return String(s ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/₱\s?/g, 'PHP ')
    .replace(/[^\x00-\xFF]/g, '');
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Embedded form data — lets "Import PDF" restore every field exactly  */
/* ------------------------------------------------------------------ */

const EMBED_TAG = 'RBX1';
const EMBED_NS = 'https://portfolio.partoza.dev/resume-builder/ns/1.0/';

const toBase64Utf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64Utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** Find this app's embedded form data in raw PDF/XMP text. */
export function extractEmbedded(text) {
  const match = new RegExp(`${EMBED_TAG}:([A-Za-z0-9+/=]+):${EMBED_TAG}`).exec(text || '');
  if (!match) return null;
  try {
    const payload = JSON.parse(fromBase64Utf8(match[1]));
    if (payload?.app === 'resume-builder' && (payload.kind === 'resume' || payload.kind === 'letter') && payload.data) return payload;
  } catch {
    /* not ours / corrupted */
  }
  return null;
}

async function createPdf(kind, m, { source, paper, design } = {}) {
  const D = designOf(design);
  const [fonts, icons] = await Promise.all([loadFonts(), loadIcons(kind === 'resume' ? D.header.icon : undefined)]);

  const size = paperOf(paper);
  const PAGE = { w: size.w, h: size.h, ...MARGINS };
  const doc = new jsPDF({ unit: 'mm', format: [size.w, size.h], orientation: 'portrait', compress: true });
  if (source) {
    // Stored in the PDF's XMP metadata (not visible on the page).
    const payload = JSON.stringify({ app: 'resume-builder', v: 1, kind, data: source });
    doc.addMetadata(`${EMBED_TAG}:${toBase64Utf8(payload)}:${EMBED_TAG}`, EMBED_NS);
  }
  const plain = (s) => String(s ?? '');
  // A serif design draws with its embedded serif (regular, bold, italic) in place of Inter.
  const serif = kind === 'resume' && D.serif ? fontByName(D.serif) : null;
  const serifOk = serif ? await registerPdfFonts(doc, new Map([[serif.name, new Set(['r', 'b', 'i'])]])) : new Set();
  const useSerif = !!serif && ['r', 'b', 'i'].every((k) => serifOk.has(`${serif.name}|${k}`));
  const SERIF_FACE = useSerif
    ? { I400: `${serif.key}-r`, I400i: `${serif.key}-i`, I500: `${serif.key}-r`, I600: `${serif.key}-b`, I700: `${serif.key}-b` }
    : null;
  const T = useSerif ? (s) => plain(s).replace(/₱\s?/g, 'PHP ') : fonts ? plain : pdfText;
  // The resume uses Inter; a cover letter registers only the fonts and styles it actually uses.
  const needsInter = kind === 'resume';
  const letterFaces = kind === 'letter' ? await registerPdfFonts(doc, letterFontUsage(m)) : null;
  if (fonts && needsInter) {
    for (const [name, data] of fonts) {
      doc.addFileToVFS(`${name}.ttf`, data);
      doc.addFont(`${name}.ttf`, name, 'normal');
    }
  }
  doc.setProperties({
    title: T(m.name ? `${m.name} - ${DOC_LABEL[kind]}` : DOC_LABEL[kind]),
    subject: DOC_LABEL[kind],
    author: T(m.name),
    creator: 'Resume Builder',
  });

  // The drawing helpers work inside a column (left…right); two-column layouts move it.
  let left = PAGE.mx;
  let right = PAGE.w - PAGE.mx;
  let width = right - left;
  const bottom = PAGE.h - PAGE.mb;
  let y = PAGE.mt;
  const column = (l, r) => {
    left = l;
    right = r;
    width = r - l;
  };
  const pageNo = () => doc.getCurrentPageInfo().pageNumber;
  // Layouts that paint page furniture (the sidebar's background) hook in here.
  let onEnterPage = null;
  /** Continue on the next page — an existing one when another column already made it. */
  const nextPage = () => {
    const n = pageNo();
    if (n < doc.getNumberOfPages()) doc.setPage(n + 1);
    else doc.addPage();
    y = PAGE.mt;
    onEnterPage?.(n + 1);
  };

  const font = (name, size, color = INK) => {
    if (SERIF_FACE) doc.setFont(SERIF_FACE[name], 'normal');
    else if (fonts) doc.setFont(name, 'normal');
    else doc.setFont(...FALLBACK[name]);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  // Line box height and where the baseline sits inside it, matching CSS line-height
  // for Inter (ascent 0.969em, content height 1.21em, centered in the line box).
  // A serif design uses its own font's metrics.
  const ASC = useSerif ? serif.ascent : 0.969;
  const CONTENT = useSerif ? serif.ascent + serif.descent : 1.21;
  const lh = (size, f = 1.5) => size * f * PT;
  const baseline = (size, f = 1.5) => ((f * size - CONTENT * size) / 2 + ASC * size) * PT;
  const text = (s, x, top, size, f = 1.5, opts = {}) =>
    doc.text(T(s), x, top + baseline(size, f), { baseline: 'alphabetic', ...opts });
  const wrap = (s, w) => doc.splitTextToSize(T(s), w);
  const rule = (yy, h, color) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(left, yy, width, h, 'F');
  };
  const ensure = (h) => {
    if (y + h > bottom + 0.01) nextPage();
  };

  /* ---------- building blocks ---------- */

  const S = D.section;
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);

  function sectionTitle(title, keepWith) {
    const label = title.toUpperCase();
    const spacing = 9 * 0.12 * PT;

    y += 20 * PX;
    if (S.style === 'bar') {
      // A tinted bar with an accent block on the left.
      const h = lh(9) + 8 * PX;
      ensure(h + 10 * PX + keepWith);
      fill(S.bar);
      doc.rect(left, y, width, h, 'F');
      fill(S.mark);
      doc.rect(left, y, 3.5 * PX, h, 'F');
      font('I700', 9, S.color);
      text(label, left + 12 * PX, y + 4 * PX, 9, 1.5, { charSpace: spacing });
      y += h + 10 * PX;
      return;
    }

    ensure(lh(9) + 6 * PX + 10 * PX + keepWith);
    font('I700', 9, S.color);
    if (S.style === 'center') {
      // ——— TITLE ———
      const tw = doc.getTextWidth(T(label)) + spacing * (label.length - 1);
      const x = left + (width - tw) / 2;
      text(label, x, y, 9, 1.5, { charSpace: spacing });
      fill(S.rule);
      const mid = y + lh(9) / 2;
      doc.rect(left, mid, Math.max(0, x - 10 * PX - left), 0.75 * PX, 'F');
      doc.rect(x + tw + 10 * PX, mid, Math.max(0, right - (x + tw + 10 * PX)), 0.75 * PX, 'F');
      y += lh(9) + 10 * PX;
      return;
    }

    if (S.style === 'underline') {
      // Title with a short accent underline.
      text(label, left, y, 9, 1.5, { charSpace: spacing });
      y += lh(9) + 4 * PX;
      fill(S.rule);
      doc.rect(left, y, 28 * PX, 2 * PX, 'F');
      y += 2 * PX + 9 * PX;
      return;
    }

    // 'rule': title, then a full-width hairline.
    text(label, left, y, 9, 1.5, { charSpace: spacing });
    y += lh(9) + 6 * PX;
    rule(y, 1 * PX, S.rule);
    y += 1 * PX + 10 * PX;
  }

  function level(label, marginTop = 6 * PX) {
    y += marginTop;
    ensure(lh(8.5) + lh(10.5));
    font('I600', 8.5, INK3);
    text(label.toUpperCase(), left, y, 8.5, 1.5, { charSpace: 8.5 * 0.06 * PT });
    y += lh(8.5) + 1 * PX;
  }

  function paragraph(s, size = 10.5, color = INK2, name = 'I400') {
    font(name, size, color);
    for (const ln of wrap(s, width)) {
      ensure(lh(size));
      text(ln, left, y, size);
      y += lh(size);
    }
  }

  function bullets(items) {
    const indent = 20 * PX;
    y += 2 * PX;
    items.forEach((item, i) => {
      if (i > 0) y += 2 * PX;
      font('I400', 10.5, INK2);
      const lines = wrap(item, width - indent);
      ensure(lh(10.5) * Math.min(lines.length, 2));
      const { shape, color } = D.bullet;
      const cx = left + 9 * PX;
      const cy = y + baseline(10.5) - 10.5 * 0.3 * PT;
      fill(color);
      if (shape === 'square') doc.rect(cx - 0.55, cy - 0.55, 1.1, 1.1, 'F');
      else doc.circle(cx, cy, 0.55, 'F');
      lines.forEach((ln, j) => {
        if (j > 0) ensure(lh(10.5));
        font('I400', 10.5, INK2);
        text(ln, left + indent, y, 10.5);
        y += lh(10.5);
      });
    });
  }

  function chips(items) {
    const K = D.skills;
    if (K.style === 'text') {
      // A plain list: "HTML5 · CSS3 · React"
      paragraph(items.join('  ·  '), 10, K.text);
      return;
    }
    const padX = 10 * PX;
    const padY = 3 * PX;
    const gap = 6 * PX;
    let x = left;
    let rowH = 0; // tallest chip in the current row
    for (const item of items) {
      // A skill too long for the column wraps inside a taller chip.
      font('I400', 9.5, K.text);
      const lines = wrap(item, width - padX * 2);
      const w = Math.min(Math.max(...lines.map((l) => doc.getTextWidth(l))) + padX * 2, width);
      const h = padY * 2 + lines.length * lh(9.5);
      if (x > left && x + w > right + 0.01) {
        x = left;
        y += rowH + gap;
        rowH = 0;
      }
      if (x === left) ensure(h);
      doc.setFillColor(...K.bg);
      doc.setDrawColor(...K.border);
      doc.setLineWidth(1 * PX);
      doc.roundedRect(x + 0.5 * PX, y + 0.5 * PX, w - PX, h - PX, 4 * PX, 4 * PX, 'FD');
      lines.forEach((ln, i) => {
        font('I400', 9.5, K.text);
        text(ln, x + padX, y + padY + i * lh(9.5), 9.5);
      });
      x += w + gap;
      rowH = Math.max(rowH, h);
    }
    y += rowH;
  }

  const NARROW = 80; // mm — columns narrower than this put entry dates under the title

  // Timeline layout: dates sit in a rail left of the entries, beside a line with a dot per entry.
  const RAIL_W = 100 * PX; // rail width (entries start after it)
  const RAIL_DATE_W = 70 * PX;
  const RAIL_X = PAGE.mx + 84 * PX; // the line
  let rail = false; // drawing rail entries right now
  let railMark = null; // where the current entry's title row started: { page, y }

  /** Title in the entry column, date wrapped in the rail. */
  function railTitleRow(title, date) {
    font('I600', 10.5, INK);
    const lines = wrap(title, width);
    font('I400', 9, INK3);
    const dateLines = date ? wrap(date, RAIL_DATE_W) : [];
    ensure(Math.max(lh(10.5) * lines.length, lh(9) * dateLines.length));
    railMark = { page: pageNo(), y };
    dateLines.forEach((ln, i) => {
      font('I400', 9, INK3);
      text(ln, PAGE.mx, y + baseline(10.5) - baseline(9) + i * lh(9), 9);
    });
    lines.forEach((ln) => {
      font('I600', 10.5, INK);
      text(ln, left, y, 10.5);
      y += lh(10.5);
    });
  }

  /** Draw a list of dated entries; on the Timeline layout they get the rail, line and dots. */
  function railEntries(items, drawOne) {
    if (D.layout !== 'timeline') {
      items.forEach(drawOne);
      return;
    }
    const outer = [left, right];
    column(PAGE.mx + RAIL_W, outer[1]);
    rail = true;
    const R = D.rail;
    items.forEach((it, i) => {
      railMark = null;
      drawOne(it, i);
      if (!railMark) return;
      const last = i === items.length - 1;
      const dotY = railMark.y + baseline(10.5) - 10.5 * 0.33 * PT;
      // The line runs from this dot to just under the next one (a page break splits it).
      const end = { page: pageNo(), y: last ? y : y + 12 * PX + 2 };
      for (let pg = railMark.page; pg <= end.page; pg++) {
        doc.setPage(pg);
        const top = pg === railMark.page ? dotY : PAGE.mt;
        const bot = pg === end.page ? end.y : bottom;
        if (bot > top) {
          fill(R.line);
          doc.rect(RAIL_X - 0.75 * PX, top, 1.5 * PX, bot - top, 'F');
        }
      }
      doc.setPage(railMark.page);
      doc.setFillColor(255, 255, 255);
      doc.circle(RAIL_X, dotY, 1.55, 'F');
      fill(R.dot);
      doc.circle(RAIL_X, dotY, 1.05, 'F');
      doc.setPage(end.page);
    });
    rail = false;
    column(...outer);
  }

  /** Bold title left, muted date right, sharing a baseline (in a narrow column, the date goes under the title). */
  function titleRow(title, date) {
    if (rail) return railTitleRow(title, date);
    if (date && width < NARROW) {
      font('I600', 10.5, INK);
      const lines = wrap(title, width);
      ensure(lh(10.5) * lines.length + lh(9.5));
      lines.forEach((ln) => {
        font('I600', 10.5, INK);
        text(ln, left, y, 10.5);
        y += lh(10.5);
      });
      font('I400', 9.5, INK3);
      text(date, left, y, 9.5);
      y += lh(9.5);
      return;
    }
    font('I400', 9.5, INK3);
    const dateW = date ? doc.getTextWidth(T(date)) : 0;
    font('I600', 10.5, INK);
    const lines = wrap(title, width - dateW - (date ? 16 * PX : 0));
    ensure(lh(10.5) * lines.length);
    lines.forEach((ln, i) => {
      font('I600', 10.5, INK);
      text(ln, left, y, 10.5);
      if (i === 0 && date) {
        font('I400', 9.5, INK3);
        doc.text(T(date), right, y + baseline(10.5), { baseline: 'alphabetic', align: 'right' });
      }
      y += lh(10.5);
    });
  }

  // Cover letters have no letterhead: they start with the date.
  if (kind === 'letter') {
    drawLetter();
    return doc;
  }

  /* ---------- header ---------- */

  const H = D.header;

  /**
   * Name, title and contact rows (+ photo) across the current column, then the design's rule.
   * The Sidebar layout leaves out the photo and contact (they go in its side column).
   */
  function drawHeader({ withPhoto = true, withContact = true } = {}) {
    const band = H.style === 'band';
    const center = H.align === 'center';
    const photo = withPhoto ? m.photo : '';
    const photoSize = 1.5 * 25.4; // 1.5in, like the preview
    const photoAbove = center && !!photo; // a centered header puts the photo above the name
    const textW = photo && !photoAbove ? width - photoSize - 28 * PX : width;

    /** Lays out the name, title and contact rows from `top` (drawing them when `paint`); returns the bottom. */
    function header(top, paint) {
      let hy = top;
      const put = (s, size, f, opts = {}) => {
        if (!paint) return;
        let x = left;
        if (center) x = left + (textW - doc.getTextWidth(T(s)) - (opts.charSpace || 0) * Math.max(0, T(s).length - 1)) / 2;
        text(s, x, hy, size, f, opts);
      };
      if (m.name) {
        font('I700', NAME_PT, H.name);
        for (const ln of wrap(m.name, textW)) {
          put(ln, NAME_PT, 1.1, { charSpace: -NAME_PT * 0.03 * PT });
          hy += lh(NAME_PT, 1.1);
        }
      }
      if (m.title) {
        hy += 6 * PX;
        font(H.titleItalic ? 'I400i' : 'I500', 11.5, H.title);
        for (const ln of wrap(m.title, textW)) {
          put(ln, 11.5);
          hy += lh(11.5);
        }
      }
      if (withContact && m.contact.length) {
        hy += 12 * PX;
        const icon = 11 * PX;
        const iconGap = 6 * PX;
        const itemGap = 16 * PX;
        const rowH = lh(9.5);
        // Group items into rows: wrap when an item doesn't fit; the address always starts its own (bottom) row.
        font('I400', 9.5, H.contact);
        const rows = [];
        let row = null;
        for (const c of m.contact) {
          const lines = wrap(c.text, textW - icon - iconGap);
          const w = icon + iconGap + Math.max(...lines.map((l) => doc.getTextWidth(l)));
          if (!row || (row.items.length && (c.ownRow || row.w + itemGap + w > textW + 0.01))) {
            row = { items: [], w: 0, lines: 1 };
            rows.push(row);
          }
          row.w += (row.items.length ? itemGap : 0) + w;
          row.lines = Math.max(row.lines, lines.length);
          row.items.push({ ...c, lines, w });
        }
        rows.forEach((r, ri) => {
          if (ri > 0) hy += 4 * PX;
          let x = center ? left + (textW - r.w) / 2 : left;
          for (const { type, lines, href, w } of r.items) {
            if (paint) {
              if (icons[type]) doc.addImage(icons[type], 'PNG', x, hy + (rowH - icon) / 2, icon, icon);
              font('I400', 9.5, H.contact);
              lines.forEach((ln, i) => {
                text(ln, x + icon + iconGap, hy + i * rowH, 9.5);
                // Clickable area over the icon and text.
                if (href) doc.link(i === 0 ? x : x + icon + iconGap, hy + i * rowH, (i === 0 ? icon + iconGap : 0) + doc.getTextWidth(ln), rowH, { url: href });
              });
            }
            x += w + itemGap;
          }
          hy += r.lines * rowH;
        });
      }
      return hy;
    }

    const headTop = y;
    const textTop = photoAbove ? headTop + photoSize + 14 * PX : headTop;
    const headBottom = Math.max(header(textTop, false), photo ? headTop + photoSize : headTop);
    const bandPad = 30 * PX;

    // A band design fills the top of the first page behind the header.
    if (band) {
      fill(H.band);
      doc.rect(0, 0, PAGE.w, headBottom + bandPad, 'F');
    }
    if (photo) {
      const px = photoAbove ? left + (width - photoSize) / 2 : right - photoSize;
      drawPhoto(px, headTop, photoSize, band);
    }
    header(textTop, true);

    if (band) {
      y = headBottom + bandPad;
    } else {
      y = headBottom + 18 * PX;
      const color = H.ruleColor || INK;
      if (H.rule === 'solid') {
        rule(y, 2 * PX, color);
        y += 2 * PX;
      } else if (H.rule === 'double') {
        rule(y, 1.5 * PX, color);
        y += 1.5 * PX + 2.5 * PX;
        rule(y, 0.75 * PX, color);
        y += 0.75 * PX;
      } else {
        y -= 8 * PX; // no rule: the first section's own rule follows
      }
    }
  }

  function drawPhoto(x, top, size, onColor) {
    try {
      doc.addImage(m.photo, 'JPEG', x, top, size, size);
      doc.setDrawColor(...(onColor ? [255, 255, 255] : RULE));
      doc.setLineWidth((onColor ? 2 : 1) * PX);
      doc.rect(x, top, size, size, 'S');
    } catch (err) {
      console.warn('Could not embed photo', err);
    }
  }

  /** Sidebar layout: photo and contact details stacked in the side column. */
  function drawSideContact() {
    if (m.photo) {
      const size = Math.min(width, 1.5 * 25.4);
      drawPhoto(left + (width - size) / 2, y, size, true);
      y += size;
    } else {
      y -= 20 * PX; // let the first heading start at the top margin
    }
    if (!m.contact.length) return;
    sectionTitle('Contact', lh(9.5));
    const icon = 11 * PX;
    const iconGap = 6 * PX;
    const rowH = lh(9.5);
    m.contact.forEach(({ type, text: value, href }, i) => {
      if (i > 0) y += 5 * PX;
      font('I400', 9.5, H.contact);
      const lines = wrap(value, width - icon - iconGap);
      ensure(rowH * lines.length);
      if (icons[type]) doc.addImage(icons[type], 'PNG', left, y + (rowH - icon) / 2, icon, icon);
      lines.forEach((ln, j) => {
        font('I400', 9.5, H.contact);
        text(ln, left + icon + iconGap, y + j * rowH, 9.5);
        if (href) doc.link(j === 0 ? left : left + icon + iconGap, y + j * rowH, (j === 0 ? icon + iconGap : 0) + doc.getTextWidth(ln), rowH, { url: href });
      });
      y += rowH * lines.length;
    });
  }

  /**
   * Standard business-letter format (mirrors .paper-letter styles):
   * 1in margins, chosen font and size (default Times 12pt), black, single-spaced (1.15),
   * one blank line between parts, two above the salutation and the complimentary close,
   * and three blank lines for the signature. The recipient's name is in bold capitals. Text is
   * real PDF text in every font, so it stays extractable for ATS.
   *
   * Paragraphs are rich: each run can have its own bold / italic / size / font. Every
   * piece of text drawn is recorded in doc.__segments (in drawing order) with the
   * paragraph and character offset it came from, so a selection made on the preview's
   * text layer can be mapped back to the letter's text.
   */
  function drawLetter() {
    const SIZE = m.size;
    const LINE = SIZE * 1.15 * PT; // single spacing at the base size
    const M = 25.4; // 1 inch
    const lx = M;
    const lw = PAGE.w - 2 * M;
    const lbottom = PAGE.h - M;
    const base = m.font; // default font entry (name, std?, ascent, descent)
    const segments = [];
    doc.__segments = segments;
    let ly = M;

    const styleOf = (r = {}) => ({
      font: r.font || base.name,
      bold: !!r.bold,
      italic: !!r.italic,
      size: r.size || SIZE,
    });
    const use = (st) => {
      const [name, style] = pdfFontFor(st.font, st.bold, st.italic, letterFaces);
      doc.setFont(name, style);
      doc.setFontSize(st.size);
    };
    // Standard fonts (and any embedded face that failed to load) only cover Latin-1.
    const cleanFor = (st) =>
      isStandardFont(st.font) || !letterFaces.has(`${st.font}|${styleKey(st.bold, st.italic)}`) ? pdfText : plain;
    const width = (str, st) => {
      use(st);
      return doc.getTextWidth(cleanFor(st)(str));
    };
    const sameSt = (a, b) => a.font === b.font && a.bold === b.bold && a.italic === b.italic && a.size === b.size;
    // Baseline inside a 1.15 line box at a given size, matching the browser.
    const baselineAt = (size) => ((1.15 - (base.ascent + base.descent)) / 2 + base.ascent) * size * PT;
    const newPageIfNeeded = (h) => {
      if (ly + h > lbottom + 0.01) {
        doc.addPage();
        ly = M;
      }
    };
    const draw = (str, x, y, st, rec, opts = {}) => {
      use(st);
      const out = cleanFor(st)(str);
      if (!out) return;
      doc.text(out, x, y, { baseline: 'alphabetic', ...opts });
      segments.push({ page: doc.getNumberOfPages(), str: out, ...rec });
    };

    doc.setTextColor(0, 0, 0);

    /**
     * A rich block (paragraph or letter line): word wrap across styles, aligned; records
     * each drawn string with `rec` ({ para } or { part }) plus its character offset.
     */
    const richParagraph = (runs, rec, align = m.align) => {
      // Words: groups of styled pieces with no whitespace between them.
      const words = [];
      let pendingSpace = null;
      let offset = 0;
      let forcedBreaks = new Set();
      for (const run of runs) {
        const st = styleOf(run);
        for (const m2 of run.text.matchAll(/\n|[^\S\n]+|[^\s]+/g)) {
          const tok = m2[0];
          const start = offset + m2.index;
          if (tok === '\n') {
            forcedBreaks.add(words.length);
            pendingSpace = null;
          } else if (/^\s+$/.test(tok)) {
            pendingSpace = { st, text: tok };
          } else {
            const piece = { text: tok, st, start, w: width(tok, st) };
            const last = words[words.length - 1];
            if (last && !pendingSpace && !forcedBreaks.has(words.length)) last.pieces.push(piece);
            else words.push({ pieces: [piece], space: pendingSpace ? width(pendingSpace.text.replace(/\s+/g, ' '), pendingSpace.st) : 0 });
            pendingSpace = null;
          }
        }
        offset += run.text.length;
      }

      // Lines.
      const lines = [];
      let cur = { words: [], w: 0 };
      words.forEach((word, i) => {
        const ww = word.pieces.reduce((s, p) => s + p.w, 0);
        const sp = cur.words.length ? word.space : 0;
        if (cur.words.length && (forcedBreaks.has(i) || cur.w + sp + ww > lw)) {
          lines.push(cur);
          cur = { words: [], w: 0 };
        }
        cur.w += (cur.words.length ? word.space : 0) + ww;
        cur.words.push(word);
      });
      if (cur.words.length) lines.push(cur);
      if (!lines.length) return;

      lines.forEach((line, li) => {
        const maxSize = Math.max(SIZE, ...line.words.flatMap((w) => w.pieces.map((p) => p.st.size)));
        const lineH = maxSize * 1.15 * PT;
        newPageIfNeeded(lineH);
        const y = ly + baselineAt(maxSize);
        const last = li === lines.length - 1;
        const justify = align === 'justify' && !last && line.words.length > 1;
        const extra = justify ? (lw - line.w) / (line.words.length - 1) : 0;
        let x = lx;
        if (align === 'center') x = lx + (lw - line.w) / 2;
        else if (align === 'right') x = lx + lw - line.w;

        // Draw: consecutive same-style pieces are merged into one string (exact source slice,
        // spaces included) except when justifying, where each word is placed on its own.
        const text = runs.map((r) => r.text).join('');
        let chunk = null;
        const flush = () => {
          if (chunk) draw(text.slice(chunk.start, chunk.end), chunk.x, y, chunk.st, { ...rec, start: chunk.start });
          chunk = null;
        };
        line.words.forEach((word, wi) => {
          if (wi > 0) x += word.space + extra;
          word.pieces.forEach((p, pi) => {
            const joinable = chunk && !justify && sameSt(chunk.st, p.st) && (pi > 0 || chunk.spaceStyleOk(word));
            if (joinable) chunk.end = p.start + p.text.length;
            else {
              flush();
              chunk = { st: p.st, x, start: p.start, end: p.start + p.text.length, spaceStyleOk: (w) => sameSt(p.st, w.pieces[0].st) };
            }
            x += p.w;
          });
          if (justify) flush();
        });
        flush();
        ly += lineH;
      });
    };

    const blank = (n = 1) => { ly += LINE * n; };
    let first = true;
    // A letter part (date, recipient lines, Re:, …) — left-aligned, formattable from the preview.
    const line = (key) => {
      if (m.parts?.[key]) richParagraph(m.parts[key], { part: key }, 'left');
    };
    const part = (keys, gap = 1) => {
      const present = keys.filter((k) => m.parts?.[k]);
      if (!present.length) return;
      if (!first) blank(gap);
      first = false;
      present.forEach(line);
    };

    part(['date']);
    part(m.recipientKeys || []);
    part(['subject']);
    part(['salutation'], 2); // two blank lines above the salutation
    m.paragraphs.forEach((runs, i) => {
      if (!first) blank();
      first = false;
      richParagraph(runs, { para: i });
    });
    // Keep the close (with its two blank lines), signature space, name and title together on one page.
    if (ly + LINE * 8 > lbottom) {
      doc.addPage();
      ly = M;
      first = true;
    }
    part(['complimentary'], 2); // two blank lines above "Sincerely,"
    blank(3);
    line('name');
    line('title');
    part(['enclosure']);
  }

  /* ---------- sections (each a block a layout can place in any column) ---------- */

  const BLOCKS = {
    summary() {
      if (!m.summary) return;
      sectionTitle(HEADINGS.summary, lh(10.5) * 2);
      paragraph(m.summary);
    },

    skills() {
      const { hard, soft } = m.skills;
      if (!hard.length && !soft.length) return;
      sectionTitle(HEADINGS.skills, 25 * PX);
      // Both groups are always labelled, so the PDF says which skills are which
      // (and imports back into the right fields).
      if (hard.length) {
        level(SUBHEADINGS.hard, 0);
        y += 3 * PX;
        chips(hard);
      }
      if (soft.length) {
        level(SUBHEADINGS.soft, hard.length ? 8 * PX : 0);
        y += 3 * PX;
        chips(soft);
      }
    },

    experience() {
      if (!m.experience.length) return;
      sectionTitle(HEADINGS.experience, 22);
      railEntries(m.experience, (e, i) => {
        if (i > 0) y += 12 * PX;
        ensure(e.responsibilities.length || e.accomplishments.length ? 24 : lh(10.5) + lh(10));
        titleRow(e.role, e.dates);
        if (e.meta) paragraph(e.meta, 10);
        if (e.website) {
          font('I400', 9.5, INK3);
          wrap(e.website.text, width).forEach((ln, j) => {
            ensure(lh(9.5));
            text(ln, left, y, 9.5);
            if (j === 0) {
              const w = Math.min(doc.getTextWidth(T(e.website.text)), width);
              doc.link(left, y, w, lh(9.5), { url: e.website.href });
            }
            y += lh(9.5);
          });
        }
        if (e.responsibilities.length) {
          level(SUBHEADINGS.responsibilities);
          bullets(e.responsibilities);
        }
        if (e.accomplishments.length) {
          level(SUBHEADINGS.accomplishments);
          bullets(e.accomplishments);
        }
      });
    },

    education() {
      if (!m.education.length && !m.credentials.length) return;
      sectionTitle(HEADINGS.education, 12);
      if (m.education.length && m.credentials.length) level(SUBHEADINGS.education, 0);
      railEntries(m.education, (e, i) => {
        if (i > 0) y += 12 * PX;
        ensure(lh(10.5) + lh(10) * 2);
        titleRow(e.degree, e.date);
        if (e.institution) paragraph(e.institution, 10);
        if (e.honors) {
          y += 1 * PX;
          paragraph(e.honors, 9.5, INK2, 'I400i');
        }
      });
      if (m.credentials.length) {
        if (m.education.length) y += 14 * PX;
        level(SUBHEADINGS.credentials, 0);
        railEntries(m.credentials, (c, i) => {
          if (i > 0) y += 12 * PX;
          ensure(lh(10.5) + lh(10));
          titleRow(c.name, c.date);
          if (c.meta) paragraph(c.meta, 10);
        });
      }
    },

    trainings() {
      if (!m.trainings.length) return;
      sectionTitle(HEADINGS.trainings, lh(10.5) + lh(10));
      railEntries(m.trainings, (t, i) => {
        if (i > 0) y += 12 * PX;
        ensure(lh(10.5) + (t.meta ? lh(10) : 0));
        titleRow(t.name, t.date);
        if (t.meta) paragraph(t.meta, 10);
      });
    },

    references() {
      if (!m.references.length) return;
      const entryH = (r) => lh(10.5) + (r.meta ? lh(10) : 0) + (r.contact ? lh(10) : 0);
      sectionTitle(HEADINGS.references, entryH(m.references[0]));
      m.references.forEach((r, i) => {
        if (i > 0) y += 12 * PX;
        ensure(entryH(r));
        titleRow(r.name, '');
        if (r.meta) paragraph(r.meta, 10);
        if (r.contact) paragraph(r.contact, 10);
      });
    },
  };
  const draw = (ids) => ids.forEach((id) => BLOCKS[id]());

  /* ---------- layouts ---------- */

  // Two-column layouts: which sections go in each column (designs.js).
  const { main: MAIN, side: SIDE } = LAYOUT_COLUMNS[D.layout] || {};
  const pageLeft = PAGE.mx;
  const pageRight = PAGE.w - PAGE.mx;

  if (D.layout === 'sidebar') {
    // A tinted column down the left edge of every page.
    const sideW = PAGE.w * 0.31;
    column(sideW + 30 * PX, pageRight);
    drawHeader({ withPhoto: false, withContact: false });
    draw(MAIN);

    const painted = new Set();
    const paintSide = (pg) => {
      if (painted.has(pg)) return;
      painted.add(pg);
      fill(D.side.bg);
      doc.rect(0, 0, sideW, PAGE.h, 'F');
    };
    doc.setPage(1);
    paintSide(1);
    onEnterPage = paintSide;
    column(24 * PX, sideW - 22 * PX);
    y = PAGE.mt;
    drawSideContact();
    draw(SIDE);
    onEnterPage = null;
    // Pages only the main column reached still get the side panel (it never overlaps their text).
    for (let pg = 1; pg <= doc.getNumberOfPages(); pg++) {
      doc.setPage(pg);
      paintSide(pg);
    }
  } else if (D.layout === 'split') {
    // Full-width header, then a wide main column and a narrow side column with a divider.
    drawHeader();
    const gutter = 28 * PX;
    const split = pageLeft + (pageRight - pageLeft) * 0.63;
    const start = { page: pageNo(), y };
    column(pageLeft, split - gutter / 2);
    draw(MAIN);
    const ends = [{ page: pageNo(), y }];
    doc.setPage(start.page);
    y = start.y;
    column(split + gutter / 2, pageRight);
    draw(SIDE);
    ends.push({ page: pageNo(), y });

    const lastPage = Math.max(...ends.map((e) => e.page));
    const lastY = Math.max(...ends.filter((e) => e.page === lastPage).map((e) => e.y));
    fill(D.divider);
    for (let pg = start.page; pg <= lastPage; pg++) {
      doc.setPage(pg);
      const top = pg === start.page ? start.y + 20 * PX : PAGE.mt;
      const bot = pg === lastPage ? lastY : bottom;
      if (bot > top) doc.rect(split - 0.5 * PX, top, 1 * PX, bot - top, 'F');
    }
  } else {
    // Single column (Timeline adds its date rail inside the dated sections).
    drawHeader();
    draw(['summary', 'skills', 'experience', 'education', 'trainings', 'references']);
  }

  return doc;
}

/**
 * opts.source: the raw form data to embed so the PDF can be imported back for editing.
 * opts.paper: 'a4' (default), 'letter' or 'long' (see paper.js).
 */
export const createResumePdf = (model, opts) => createPdf('resume', model, opts);
export const createLetterPdf = (model, opts) => createPdf('letter', model, opts);
