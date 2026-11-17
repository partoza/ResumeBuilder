// PDF generator that draws the same design as the on-screen preview (ResumePreview.jsx
// + .paper styles) with jsPDF. All words are real, selectable text in embedded Inter,
// so the file stays ATS-readable; only the photo and the small contact icons are images.
import { jsPDF } from 'jspdf';
import inter400 from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import inter400i from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf?url';
import inter500 from '@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf?url';
import inter600 from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?url';
import inter700 from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import { HEADINGS, SUBHEADINGS } from './model.js';

export const MAX_PAGES = 2;
export const LETTER_MAX_PAGES = 1;
const DOC_LABEL = { resume: 'Resume', letter: 'Cover Letter' };

const PT = 25.4 / 72; // mm per point
const PX = 25.4 / 96; // mm per CSS pixel
const PAGE = { w: 210, h: 297, mx: 56 * PX, mt: 52 * PX, mb: 56 * PX };

const INK = [17, 17, 17];
const INK2 = [63, 63, 70];
const INK3 = [113, 113, 122];
const RULE = [228, 228, 231];
const CHIP_BG = [250, 250, 250];

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
};

let iconsPromise = null;
function loadIcons() {
  if (!iconsPromise) {
    iconsPromise = Promise.all(
      Object.entries(ICON_SVG).map(
        ([key, inner]) =>
          new Promise((resolve) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
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
    ).then(Object.fromEntries);
  }
  return iconsPromise;
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

async function createPdf(kind, m) {
  const [fonts, icons] = await Promise.all([loadFonts(), loadIcons()]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const plain = (s) => String(s ?? '');
  const T = fonts ? plain : pdfText;
  if (fonts) {
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

  const left = PAGE.mx;
  const right = PAGE.w - PAGE.mx;
  const width = right - left;
  const bottom = PAGE.h - PAGE.mb;
  let y = PAGE.mt;

  const font = (name, size, color = INK) => {
    if (fonts) doc.setFont(name, 'normal');
    else doc.setFont(...FALLBACK[name]);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  // Line box height and where the baseline sits inside it, matching CSS line-height
  // for Inter (ascent 0.969em, content height 1.21em, centered in the line box).
  const lh = (size, f = 1.5) => size * f * PT;
  const baseline = (size, f = 1.5) => ((f * size - 1.21 * size) / 2 + 0.969 * size) * PT;
  const text = (s, x, top, size, f = 1.5, opts = {}) =>
    doc.text(T(s), x, top + baseline(size, f), { baseline: 'alphabetic', ...opts });
  const wrap = (s, w) => doc.splitTextToSize(T(s), w);
  const rule = (yy, h, color) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(left, yy, width, h, 'F');
  };
  const ensure = (h) => {
    if (y + h > bottom + 0.01) {
      doc.addPage();
      y = PAGE.mt;
    }
  };

  /* ---------- building blocks ---------- */

  function sectionTitle(title, keepWith) {
    y += 20 * PX;
    ensure(lh(9) + 6 * PX + 10 * PX + keepWith);
    font('I700', 9, INK);
    text(title.toUpperCase(), left, y, 9, 1.5, { charSpace: 9 * 0.12 * PT });
    y += lh(9) + 6 * PX;
    rule(y, 1 * PX, RULE);
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
      doc.setFillColor(INK3[0], INK3[1], INK3[2]);
      doc.circle(left + 9 * PX, y + baseline(10.5) - 10.5 * 0.3 * PT, 0.55, 'F');
      lines.forEach((ln, j) => {
        if (j > 0) ensure(lh(10.5));
        font('I400', 10.5, INK2);
        text(ln, left + indent, y, 10.5);
        y += lh(10.5);
      });
    });
  }

  function chips(items) {
    const h = 25 * PX;
    const padX = 10 * PX;
    const gap = 6 * PX;
    font('I400', 9.5, INK2);
    let x = left;
    ensure(h);
    for (const item of items) {
      const w = Math.min(doc.getTextWidth(T(item)) + padX * 2, width);
      if (x > left && x + w > right + 0.01) {
        x = left;
        y += h + gap;
        ensure(h);
      }
      doc.setFillColor(...CHIP_BG);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(1 * PX);
      doc.roundedRect(x + 0.5 * PX, y + 0.5 * PX, w - PX, h - PX, 4 * PX, 4 * PX, 'FD');
      font('I400', 9.5, INK2);
      text(item, x + padX, y + 3 * PX, 9.5);
      x += w + gap;
    }
    y += h;
  }

  /** Bold title left, muted date right, sharing a baseline. */
  function titleRow(title, date) {
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

  const photoSize = 1.5 * 25.4; // 1.5in, like the preview
  const headTop = y;
  const textW = m.photo ? width - photoSize - 28 * PX : width;

  if (m.photo) {
    try {
      doc.addImage(m.photo, 'JPEG', right - photoSize, headTop, photoSize, photoSize);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(1 * PX);
      doc.rect(right - photoSize, headTop, photoSize, photoSize, 'S');
    } catch (err) {
      console.warn('Could not embed photo', err);
    }
  }

  if (m.name) {
    font('I700', 26, INK);
    for (const ln of wrap(m.name, textW)) {
      text(ln, left, y, 26, 1.1, { charSpace: -26 * 0.03 * PT });
      y += lh(26, 1.1);
    }
  }
  if (m.title) {
    y += 6 * PX;
    font('I500', 11.5, INK2);
    for (const ln of wrap(m.title, textW)) {
      text(ln, left, y, 11.5);
      y += lh(11.5);
    }
  }
  if (m.contact.length) {
    y += 12 * PX;
    const icon = 11 * PX;
    const iconGap = 6 * PX;
    const itemGap = 16 * PX;
    const rowH = lh(9.5);
    let x = left;
    font('I400', 9.5, INK2);
    for (const { type, text: value } of m.contact) {
      const lines = wrap(value, textW - icon - iconGap);
      const w = icon + iconGap + Math.max(...lines.map((l) => doc.getTextWidth(l)));
      if (x > left && x + w > left + textW + 0.01) {
        x = left;
        y += rowH + 4 * PX;
      }
      if (icons[type]) doc.addImage(icons[type], 'PNG', x, y + (rowH - icon) / 2, icon, icon);
      font('I400', 9.5, INK2);
      lines.forEach((ln, i) => text(ln, x + icon + iconGap, y + i * rowH, 9.5));
      if (lines.length > 1) {
        y += (lines.length - 1) * rowH;
        x = left + textW; // force the next item onto a new row
      } else {
        x += w + itemGap;
      }
    }
    y += rowH;
  }

  y = Math.max(y, m.photo ? headTop + photoSize : y) + 18 * PX;
  rule(y, 2 * PX, INK);
  y += 2 * PX;

  /** Block-format business letter body (mirrors .r-letter styles). */
  function drawLetter() {
    const block = (lines, first = 'I400', firstColor = INK2) =>
      lines.forEach((ln, i) => {
        const [name, color] = i === 0 ? [first, firstColor] : ['I400', INK2];
        font(name, 10.5, color);
        for (const w of wrap(ln, width)) {
          ensure(lh(10.5));
          text(w, left, y, 10.5);
          y += lh(10.5);
        }
      });

    if (m.date) block([m.date]);
    if (m.recipient.length) {
      if (m.date) y += 20 * PX;
      block(m.recipient, 'I600', INK);
    }
    if (m.subject) {
      y += 20 * PX;
      block([m.subject], 'I600', INK);
    }
    y += 16 * PX;
    block([m.salutation], 'I400', INK);
    for (const para of m.paragraphs) {
      y += 12 * PX;
      paragraph(para);
    }
    y += 20 * PX;
    ensure(lh(10.5) * 2 + 44 * PX);
    font('I400', 10.5, INK);
    text(m.complimentary, left, y, 10.5);
    y += lh(10.5) + 44 * PX;
    if (m.name) {
      font('I600', 10.5, INK);
      text(m.name, left, y, 10.5);
      y += lh(10.5);
    }
    if (m.enclosure) {
      y += 20 * PX;
      ensure(lh(9.5));
      font('I400', 9.5, INK3);
      text(m.enclosure, left, y, 9.5);
      y += lh(9.5);
    }
  }

  /* ---------- summary ---------- */

  if (m.summary) {
    sectionTitle(HEADINGS.summary, lh(10.5) * 2);
    paragraph(m.summary);
  }

  /* ---------- skills ---------- */

  const { hard, soft } = m.skills;
  if (hard.length || soft.length) {
    sectionTitle(HEADINGS.skills, 25 * PX);
    const both = hard.length && soft.length;
    if (hard.length) {
      if (both) level(SUBHEADINGS.hard, 0);
      if (both) y += 3 * PX;
      chips(hard);
    }
    if (soft.length) {
      if (both) {
        level(SUBHEADINGS.soft, 8 * PX);
        y += 3 * PX;
      }
      chips(soft);
    }
  }

  /* ---------- experience ---------- */

  if (m.experience.length) {
    sectionTitle(HEADINGS.experience, 22);
    m.experience.forEach((e, i) => {
      if (i > 0) y += 12 * PX;
      ensure(e.responsibilities.length || e.accomplishments.length ? 24 : lh(10.5) + lh(10));
      titleRow(e.role, e.dates);
      if (e.meta) paragraph(e.meta, 10);
      if (e.responsibilities.length) {
        level(SUBHEADINGS.responsibilities);
        bullets(e.responsibilities);
      }
      if (e.accomplishments.length) {
        level(SUBHEADINGS.accomplishments);
        bullets(e.accomplishments);
      }
    });
  }

  /* ---------- education & credentials ---------- */

  if (m.education.length || m.credentials.length) {
    sectionTitle(HEADINGS.education, 12);
    if (m.education.length && m.credentials.length) level(SUBHEADINGS.education, 0);
    m.education.forEach((e, i) => {
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
      m.credentials.forEach((c, i) => {
        if (i > 0) y += 12 * PX;
        ensure(lh(10.5) + lh(10));
        titleRow(c.name, c.date);
        if (c.meta) paragraph(c.meta, 10);
      });
    }
  }

  return doc;
}

export const createResumePdf = (model) => createPdf('resume', model);
export const createLetterPdf = (model) => createPdf('letter', model);
