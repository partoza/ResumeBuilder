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
  const base = blankState();
  const saved = read(KEYS.resume);
  if (!isObj(saved)) return base;
  for (const s of SECTIONS) {
    const v = saved[s.id];
    if (s.kind === 'list') {
      // eslint-disable-next-line no-unused-vars
      if (Array.isArray(v)) base[s.id] = v.filter(isObj).map(({ _id, ...it }) => ({ ...s.blank(), ...it }));
    } else if (isObj(v)) {
      base[s.id] = { ...base[s.id], ...v };
    }
  }
  return base;
}

export const resumeHasContent = (d) => SECTIONS.some((s) => sectionHasContent(d, s.id));

/** Saves when there's something to keep; otherwise removes the saved copy. */
export function saveResume(d) {
  if (!resumeHasContent(d)) {
    remove(KEYS.resume);
    return true;
  }
  return write(KEYS.resume, JSON.parse(JSON.stringify(d, (k, v) => (k === '_id' ? undefined : v))));
}
export const clearResume = () => remove(KEYS.resume);

/* ---------------- cover letter ---------------- */

export function loadLetter() {
  const base = blankLetter();
  const saved = read(KEYS.letter);
  if (!isObj(saved)) return base;
  for (const k of Object.keys(base)) if (isObj(saved[k])) base[k] = { ...base[k], ...saved[k] };
  return base;
}

const formatChanged = (l) =>
  l.format && (l.format.font !== DEFAULT_FORMAT.font || Number(l.format.size) !== DEFAULT_FORMAT.size);

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
