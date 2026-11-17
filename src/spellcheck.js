// Spell checking for the preview (Word-style red underlines).
//
// Only "prose" is checked — summary, roles, bullets, degrees, letter paragraphs —
// never names, places or companies. Words the user typed in those name-like fields,
// acronyms (SEO), mixed-case tech names (JavaScript), and words with digits or
// dots (Node.js) are skipped. "Ignore" adds a word to a personal dictionary saved
// in this browser.
import affUrl from './assets/dictionary/en_US.aff?url';
import dicUrl from './assets/dictionary/en_US.dic?url';
import { has } from './utils.js';

const DICT_KEY = 'resume-builder:dictionary:v1';

// Common resume / tech / Philippine terms missing from a general English dictionary.
const EXTRA_WORDS = [
  'frontend', 'backend', 'fullstack', 'devops', 'chatbot', 'chatbots', 'dataset', 'datasets', 'onboarding', 'upskilling',
  'recordkeeping', 'workflow', 'workflows', 'webpage', 'webpages', 'website', 'websites', 'email', 'emails', 'online',
  'login', 'logins', 'dropdown', 'checkout', 'signup', 'analytics', 'scalable', 'responsive', 'reusable', 'deployable',
  'figma', 'canva', 'photoshop', 'wordpress', 'shopify', 'laravel', 'django', 'firebase', 'supabase', 'tailwind',
  'zendesk', 'freshdesk', 'salesforce', 'quickbooks', 'xero', 'jira', 'trello', 'github', 'gitlab', 'javascript',
  'typescript', 'python', 'kotlin', 'flutter', 'react', 'vue', 'angular', 'nodejs', 'mysql', 'postgresql', 'mongodb',
  'barangay', 'barangays', 'purok', 'sitio', 'poblacion', 'paluwagan', 'capstone', 'pickleball', 'cum', 'laude', 'magna',
  'summa', 'lister', 'listers', 'practicum', 'sari', 'jeepney', 'peso', 'pesos', 'kababayan', 'agile', 'scrum', 'kanban',
];

/* ---------------- personal dictionary (this browser) ---------------- */

function loadPersonal() {
  try {
    const list = JSON.parse(localStorage.getItem(DICT_KEY) || '[]');
    return new Set(Array.isArray(list) ? list.filter((w) => typeof w === 'string') : []);
  } catch {
    return new Set();
  }
}
let personal = loadPersonal();

export function ignoreWord(word) {
  personal.add(word.toLowerCase());
  try {
    localStorage.setItem(DICT_KEY, JSON.stringify([...personal]));
  } catch {
    /* ignore */
  }
}

/* ---------------- worker ---------------- */

let worker = null;
let seq = 0;
const pending = new Map();
let initPromise = null;

function call(msg) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id });
  });
}

function ensureWorker() {
  if (!initPromise) {
    worker = new Worker(new URL('./spell.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    initPromise = call({
      type: 'init',
      aff: new URL(affUrl, location.href).href,
      dic: new URL(dicUrl, location.href).href,
      extra: EXTRA_WORDS,
    });
  }
  return initPromise;
}

/* ---------------- tokenising ---------------- */

/** Normalise a raw token to the word we check ("Develped," → "Develped"), or '' to skip it. */
export function wordOf(token) {
  const core = String(token).replace(/[’‘]/g, "'").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/'s$/i, '');
  if (core.length < 3) return '';
  if (/[^A-Za-z']/.test(core)) return ''; // digits, dots (Node.js), @, / …
  if (/[A-Z]/.test(core.slice(1))) return ''; // acronyms (SEO) and mixed case (JavaScript)
  return core;
}

const words = (text) =>
  String(text || '')
    .split(/[\s/–—-]+/)
    .map(wordOf)
    .filter(Boolean);

/** The prose fields of a document, and the name-like fields whose words are never flagged. */
export function documentText(kind, data, letter) {
  if (kind === 'letter') {
    const r = letter.recipient;
    const c = letter.content;
    return {
      prose: [c.position, c.salutation, c.opening, c.body, c.closing, letter.signoff.complimentary],
      // A custom greeting may be in another language ("Magandang araw") — never flag it.
      names: [c.greetingOther, r.name, r.title, r.company, r.address, letter.signoff.name, data.personal.firstName, data.personal.middleName, data.personal.lastName],
    };
  }
  const p = data.personal;
  const prose = [p.title, data.summary.text, data.skills.hard, data.skills.soft];
  const names = [p.firstName, p.middleName, p.lastName, p.suffix, p.address, p.email, p.link];
  for (const e of data.experience) {
    prose.push(e.role, e.typeOther, e.responsibilities, e.accomplishments);
    names.push(e.organization, e.location, e.website, e.referenceName, e.referenceContact);
  }
  for (const e of data.education) {
    prose.push(e.degree, e.honors);
    names.push(e.institution);
  }
  for (const c of data.credentials) {
    prose.push(c.name);
    names.push(c.issuer, c.number);
  }
  return { prose: prose.filter(has), names: names.filter(has) };
}

/**
 * Returns the set of misspelled words (exact forms as they appear) for a document.
 */
export async function findMisspellings({ prose, names }) {
  await ensureWorker();
  const skip = new Set(names.flatMap(words).map((w) => w.toLowerCase()));
  const candidates = [...new Set(prose.flatMap(words))].filter((w) => !skip.has(w.toLowerCase()) && !personal.has(w.toLowerCase()));
  if (!candidates.length) return new Set();
  const { bad } = await call({ type: 'check', words: candidates });
  return new Set(bad);
}

export async function suggestionsFor(word) {
  await ensureWorker();
  const { suggestions } = await call({ type: 'suggest', word });
  return suggestions;
}

/** Start loading the dictionary early (it's ~550 KB). */
export function preloadSpellcheck() {
  ensureWorker().catch(() => {});
}

/**
 * Replace a whole word everywhere in the prose fields of a document, keeping its
 * capitalisation ("Develped" → "Developed", "develped" → "developed").
 */
export function replaceWordIn(text, word, replacement) {
  if (!text) return text;
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(`(^|[^A-Za-z'])(${esc})(?![A-Za-z'])`, 'gi'), (m, pre, found) => {
    let rep = replacement;
    if (found === found.toUpperCase() && found.length > 1) rep = replacement.toUpperCase();
    else if (found[0] === found[0].toUpperCase()) rep = replacement[0].toUpperCase() + replacement.slice(1);
    return pre + rep;
  });
}
