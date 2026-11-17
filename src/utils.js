import { SECTION_BY_ID } from './data.js';

export const has = (v) => (typeof v === 'string' ? v.trim() !== '' : !!v);

/** Split comma- or newline-separated text into trimmed items. */
export const splitList = (s) =>
  String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/** Split text into lines, dropping any bullet characters the user typed. */
export const splitLines = (s) =>
  String(s || '').split('\n').map((x) => x.replace(/^\s*[-•*·]\s*/, '').trim()).filter(Boolean);

export function range(a, b) {
  a = (a || '').trim();
  b = (b || '').trim();
  return a && b ? `${a} – ${b}` : a || b;
}

export function fullName(p) {
  const base = [p.firstName, p.middleName, p.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  const suffix = (p.suffix || '').trim();
  if (!suffix) return base;
  return base + (/^(jr|sr)\.?$/i.test(suffix) ? ', ' : ' ') + suffix;
}

/** Whether a form section has anything the user filled in (drives the ✓ badge). */
export function sectionHasContent(state, id) {
  return sectionFilled(SECTION_BY_ID[id], state[id]);
}

/** Works for any section definition (resume or cover letter). */
export function sectionFilled(s, v) {
  const textual = (f) => f.type !== 'checkbox' && f.type !== 'select' && f.type !== 'date';
  if (s.kind === 'list') return v.some((it) => s.fields.some((f) => textual(f) && has(it[f.key])));
  return s.fields.some((f) => textual(f) && has(v[f.key]));
}

/** Immutably set a value at a path array, e.g. ['experience', 0, 'role']. */
export function setIn(obj, path, value) {
  const [head, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[head] = rest.length ? setIn(obj[head], rest, value) : value;
  return copy;
}

/** Center-crop an image file to a square JPEG data URL (for the 2×2 photo). */
export function cropPhoto(file, max = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const out = Math.min(max, size);
        const c = document.createElement('canvas');
        c.width = c.height = out;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, out, out);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function fileName(p, label = 'Resume') {
  const parts = [p.lastName, p.firstName]
    .map((x) => (x || '').trim().replace(/[^\p{L}\p{N}]+/gu, '_'))
    .filter(Boolean);
  return (parts.length ? parts.join('_') + '_' : '') + label + '.pdf';
}
