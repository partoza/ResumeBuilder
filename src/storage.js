// Browser persistence (localStorage) so nothing is lost when the tab is hidden,
// discarded by the browser (common on phones after switching apps), or reloaded.
import { SECTIONS, blankState } from './data.js';
import { DEFAULT_FORMAT, blankLetter, letterHasContent } from './letterData.js';
import { sectionHasContent } from './utils.js';

const KEYS = {
  resume: 'resume-builder:resume:v1',
  letter: 'resume-builder:letter:v1',
  ui: 'resume-builder:ui:v1',
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const SAFE_PHOTO = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Copy only the known keys whose value has the same type as the blank default.
 * Saved or imported data is untrusted: anything unexpected falls back to the default.
 */
function pick(base, saved) {
  const out = { ...base };
  if (!isObj(saved)) return out;
  for (const key of Object.keys(base)) {
    const v = saved[key];
    if (v === undefined || typeof v !== typeof base[key]) continue;
    if (typeof v === 'string' && v.length > 200000) continue;
    if (key === 'photo' && v && !SAFE_PHOTO.test(v)) continue;
    out[key] = v;
  }
  return out;
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode / storage full
  }
}
function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------------- resume ---------------- */

/** Saved resume merged onto a blank one, so fields added in later versions always exist. */
export function loadResume() {
  return hydrateResume(read(KEYS.resume));
}

/** Merge any saved/imported resume data onto a blank resume (unknown keys ignored). */
export function hydrateResume(saved) {
  const base = blankState();
  if (!isObj(saved)) return base;
  for (const s of SECTIONS) {
    const v = saved[s.id];
    if (s.kind === 'list') {
      if (Array.isArray(v)) base[s.id] = v.filter(isObj).slice(0, 50).map((it) => pick(s.blank(), it));
    } else if (isObj(v)) {
      base[s.id] = pick(base[s.id], v);
    }
  }
  return base;
}

/** Copy without React list keys. */
export const stripIds = (d) => JSON.parse(JSON.stringify(d, (k, v) => (k === '_id' ? undefined : v)));

export const resumeHasContent = (d) => SECTIONS.some((s) => sectionHasContent(d, s.id));

/** Saves when there's something to keep; otherwise removes the saved copy. */
export function saveResume(d) {
  if (!resumeHasContent(d)) {
    remove(KEYS.resume);
    return true;
  }
  return write(KEYS.resume, stripIds(d));
}
export const clearResume = () => remove(KEYS.resume);

/* ---------------- cover letter ---------------- */

export function loadLetter() {
  return hydrateLetter(read(KEYS.letter));
}

/** Merge any saved/imported letter data onto a blank letter. */
export function hydrateLetter(saved) {
  const base = blankLetter();
  if (!isObj(saved)) return base;
  for (const k of Object.keys(base)) base[k] = pick(base[k], saved[k]);
  return base;
}

const formatChanged = (l) =>
  l.format && (l.format.font !== DEFAULT_FORMAT.font || Number(l.format.size) !== DEFAULT_FORMAT.size || (l.format.align || 'left') !== DEFAULT_FORMAT.align);

export function saveLetter(l) {
  if (!letterHasContent(l) && !formatChanged(l)) {
    remove(KEYS.letter);
    return true;
  }
  return write(KEYS.letter, l);
}
export const clearLetter = () => remove(KEYS.letter);

/* ---------------- UI (active tab, layout) ---------------- */

export function loadUi() {
  const saved = read(KEYS.ui);
  return {
    docTab: saved?.docTab === 'letter' ? 'letter' : 'resume',
    swap: !!saved?.swap,
  };
}
export const saveUi = (ui) => write(KEYS.ui, ui);
