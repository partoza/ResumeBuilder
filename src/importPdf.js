// "Import PDF": turn an uploaded PDF back into editable form data.
//
// 1. PDFs made by this app carry the original form data (see extractEmbedded in
//    exportPdf.js), so every field is restored exactly.
// 2. Any other PDF is read as text and parsed heuristically into the fields
//    (name, contact details, sections, dated entries, letter parts). It's a best
//    effort — the user reviews the result.
import { loadPdfjs } from './pdfjs.js';
import { extractEmbedded } from './exportPdf.js';
import { EXPERIENCE_TYPES, LINK_TYPES } from './data.js';
import { COMPLIMENTARY_CLOSES, DEFAULT_GREETING, GREETINGS, autoSalutation } from './letterData.js';
import { splitTopLevel } from './utils.js';

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

/** An expected problem with the file, with a message that can be shown to the user. */
export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns { embedded, lines } where lines are visual text lines in reading order:
 * { text, size, gapBefore, page }. Wide horizontal gaps inside a line become "\t".
 */
export async function readPdf(file) {
  if (!file) throw new ImportError('No file selected.');
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError('That PDF is too large (15 MB max).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new ImportError('That file isn’t a PDF.');

  const lib = await loadPdfjs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ImportError('That PDF is password-protected. Remove the password and try again.');
    throw new ImportError('Couldn’t open that PDF. It may be damaged.');
  }

  try {
    // 1) Our own embedded data (XMP metadata), with a raw-bytes fallback.
    let embedded = null;
    try {
      const meta = await pdf.getMetadata();
      embedded = extractEmbedded(meta?.metadata?.getRaw?.());
    } catch {
      /* no metadata */
    }
    if (!embedded) embedded = extractEmbedded(new TextDecoder('latin1').decode(bytes));
    if (embedded) return { embedded, lines: [] };

    // 2) Text lines for heuristic parsing, plus the profile photo if there is one.
    const lines = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      lines.push(...toLines(content.items, n));
    }
    let photo = '';
    try {
      photo = await extractPhoto(pdf, lib);
    } catch (err) {
      console.warn('Could not extract a photo from the PDF', err);
    }
    return { embedded: null, lines, photo };
  } finally {
    pdf.destroy();
  }
}

/* ------------------------------------------------------------------ */
/* Photo                                                               */
/* ------------------------------------------------------------------ */

const PHOTO_MIN_PX = 120; // ignores icons and small logos
const PHOTO_OUT_PX = 480;

/** Resolve a pdf.js image object (page-level or shared). */
function getImageObj(page, name) {
  const store = String(name).startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    try {
      if (store.has(name)) resolve(store.get(name));
      else store.get(name, resolve);
    } catch {
      resolve(null);
    }
  });
}

/** Draw a decoded pdf.js image onto a canvas. */
function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
    return canvas;
  }
  if (!img.data) return null;
  const out = ctx.createImageData(img.width, img.height);
  const src = img.data;
  const px = img.width * img.height;
  if (src.length === px * 4) out.data.set(src);
  else if (src.length === px * 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      out.data[i * 4] = src[j];
      out.data[i * 4 + 1] = src[j + 1];
      out.data[i * 4 + 2] = src[j + 2];
      out.data[i * 4 + 3] = 255;
    }
  } else return null; // 1-bit masks etc.: not a photo
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/**
 * Find the profile photo: the largest roughly-square picture on page 1.
 * Returns a center-cropped square JPEG data URL, or ''.
 */
async function extractPhoto(pdf, lib) {
  const page = await pdf.getPage(1);
  const ops = await page.getOperatorList();
  const IMAGE_OPS = new Set([lib.OPS.paintImageXObject, lib.OPS.paintInlineImageXObject].filter((x) => x !== undefined));
  let best = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (!IMAGE_OPS.has(ops.fnArray[i])) continue;
    const arg = ops.argsArray[i][0];
    const img = typeof arg === 'string' ? await getImageObj(page, arg) : arg;
    if (!img || !img.width || !img.height) continue;
    const ratio = img.width / img.height;
    if (img.width < PHOTO_MIN_PX || img.height < PHOTO_MIN_PX || ratio < 0.6 || ratio > 1.6) continue;
    if (!best || img.width * img.height > best.width * best.height) best = img;
  }
  if (!best) return '';
  const src = imageToCanvas(best);
  if (!src) return '';
  const size = Math.min(src.width, src.height);
  const outSize = Math.min(PHOTO_OUT_PX, size);
  const out = document.createElement('canvas');
  out.width = out.height = outSize;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.drawImage(src, (src.width - size) / 2, (src.height - size) / 2, size, size, 0, 0, outSize, outSize);
  return out.toDataURL('image/jpeg', 0.9);
}

/** Group pdf.js text items into lines (top-to-bottom, left-to-right). */
function toLines(items, page) {
  const runs = items
    .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10,
    }));

  const rows = [];
  for (const r of runs.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((l) => Math.abs(l.y - r.y) <= Math.max(2, r.size * 0.35));
    if (row) row.runs.push(r);
    else rows.push({ y: r.y, runs: [r] });
  }
  rows.sort((a, b) => b.y - a.y);

  // The page's right text margin: the furthest right any text reaches (right-aligned dates, full lines).
  const pageRight = Math.max(0, ...runs.map((r) => r.x + r.w));
  let prevY = null;
  return rows.map((row) => {
    row.runs.sort((a, b) => a.x - b.x);
    const size = Math.max(...row.runs.map((r) => r.size));
    let text = '';
    let end = null;
    for (const r of row.runs) {
      if (end !== null) {
        const gap = r.x - end;
        if (gap > size * 1.2) text += '\t';
        else if (gap > size * 0.12 && !/\s$/.test(text) && !/^\s/.test(r.str)) text += ' ';
      }
      text += r.str;
      end = r.x + r.w;
    }
    const first = prevY === null; // first line on this page: no gap to measure
    const gapBefore = first ? 0 : prevY - row.y;
    prevY = row.y;
    const x = row.runs[0].x;
    const right = Math.max(...row.runs.map((r) => r.x + r.w));
    return { text: text.replace(/[  ]+/g, ' ').replace(/ ?\t ?/g, '\t').trim(), size, gapBefore, page, first, x, right, pageRight };
  });
}

/* ------------------------------------------------------------------ */
/* Shared patterns                                                     */
/* ------------------------------------------------------------------ */

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE = `(?:${MONTH}\\s+(?:\\d{1,2},?\\s+)?)?(?:19|20)\\d{2}`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:–|—|-|to|until)\\s*(${DATE}|present|current|now|to date)`, 'i');
const DATE_RE = new RegExp(`(${MONTH}\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}|${DATE}|expected\\s+${DATE})`, 'i');
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?63[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}|\+?\d[\d\s()-]{7,}\d/;
const URL_RE = new RegExp(
  '\\b(?:https?:\\/\\/)?(?:www\\.)?(?:[a-z0-9-]+\\.)+(?:' +
    'com|ph|net|org|io|dev|me|co|app|site|xyz|info|online|tech|store|shop|biz|ai|gov|edu|page|link|website|digital|cloud|' +
    'space|pro|design|studio|art|blog|live|life|world|today|agency|solutions|services|business|asia|us|uk|au|ca|sg' +
    ')(?:\\.[a-z]{2})?(?![a-z])(?:\\/[^\\s|·,]*)?',
  'i'
);
const BULLET_RE = /^[•●▪◦‣∙·*\-–]\s*/;

const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const clean = (s) => String(s || '').replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const stripPunct = (s) => s.replace(/^[\s|·•,;:–—-]+|[\s|·•,;:–—-]+$/g, '');

/** Pull a date range ("Jan 2024 – Present") out of a line. */
function takeRange(text) {
  const m = RANGE_RE.exec(text);
  if (!m) return null;
  const end = /present|current|now|to date/i.test(m[2]) ? '' : m[2];
  return { start: clean(m[1]), end: clean(end), current: !end, rest: stripPunct(clean(text.replace(m[0], ' '))) };
}

/** Pull a single trailing/standalone date ("July 2024", "2023") out of a line. */
function takeDate(text) {
  const parts = text.split('\t');
  const last = parts[parts.length - 1];
  if (parts.length > 1 && DATE_RE.test(last) && last.replace(DATE_RE, '').trim().length < 4) {
    return { date: clean(last), rest: stripPunct(clean(parts.slice(0, -1).join(' '))) };
  }
  const m = new RegExp(`(?:^|[\\s,(|·-])(${DATE_RE.source})\\)?\\s*$`, 'i').exec(text);
  if (m) return { date: clean(m[1]), rest: stripPunct(clean(text.slice(0, m.index))) };
  return null;
}

/* ------------------------------------------------------------------ */
/* Document type guess                                                 */
/* ------------------------------------------------------------------ */

export function looksLikeLetter(lines) {
  const text = lines.map((l) => l.text).join('\n');
  const letterish = /^\s*(dear|to whom it may concern)\b/im.test(text) && /^\s*(sincerely|respectfully|very truly yours|best regards|regards|yours (truly|faithfully|sincerely))/im.test(text);
  const sections = lines.filter((l) => headingOf(l.text)).length;
  return letterish && sections < 2;
}

/* ------------------------------------------------------------------ */
/* Resume                                                              */
/* ------------------------------------------------------------------ */

// Section headings, matched on letters only ("E X P E R I E N C E", "Education & Credentials:",
// "WORK-EXPERIENCE" all normalise to the same key), so letter-spacing and punctuation don't matter.
const HEADING_WORDS = {
  summary: ['summary', 'professional summary', 'career summary', 'personal summary', 'summary statement', 'profile', 'professional profile',
    'objective', 'career objective', 'objectives', 'about me', 'about'],
  skills: ['skills', 'key skills', 'technical skills', 'core skills', 'core competencies', 'competencies', 'skills and abilities',
    'skills and competencies', 'areas of expertise', 'expertise', 'qualifications', 'skill set', 'skillset'],
  hard: ['hard skills', 'hard technical skills', 'hard and technical skills'],
  soft: ['soft skills', 'interpersonal skills'],
  experience: ['experience', 'experiences', 'work experience', 'professional experience', 'relevant experience', 'related experience',
    'employment history', 'employment', 'work history', 'internship', 'internships', 'ojt', 'ojt experience', 'internship experience',
    'on the job training', 'projects', 'project', 'academic projects', 'school projects', 'major projects', 'work and projects'],
  responsibilities: ['responsibilities', 'job responsibilities', 'key responsibilities', 'duties', 'duties and responsibilities'],
  accomplishments: ['accomplishments', 'key accomplishments', 'achievements', 'key achievements'],
  education: ['education', 'educational attainment', 'educational background', 'academic background', 'academic history',
    'education and credentials', 'education and training', 'education and certifications'],
  credentials: ['certifications', 'certification', 'certifications and licenses', 'licenses and certifications', 'licenses', 'license',
    'licensure', 'eligibility', 'civil service eligibility', 'credentials'],
  trainings: ['seminars', 'trainings', 'seminars and trainings', 'trainings and seminars', 'seminars and trainings attended',
    'trainings attended', 'seminars attended', 'seminars and workshops', 'workshops', 'trainings and workshops'],
  ignore: ['references', 'reference', 'character references', 'personal information', 'personal data', 'personal details',
    'personal background', 'interests', 'hobbies', 'languages', 'awards', 'affiliations', 'organizations', 'declaration'],
};
const headingKey = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const HEADING_INDEX = new Map(
  Object.entries(HEADING_WORDS).flatMap(([kind, words]) => words.map((w) => [headingKey(w), kind]))
);

function headingOf(text) {
  const t = clean(text);
  if (!t || t.length > 70 || BULLET_RE.test(t)) return null;
  return HEADING_INDEX.get(headingKey(t)) || null;
}

function guessLinkType(url) {
  if (/linkedin\./i.test(url)) return 'LinkedIn';
  if (/facebook\.|fb\.com/i.test(url)) return 'Facebook';
  if (/github\./i.test(url)) return 'GitHub';
  if (/portfolio|behance|dribbble|vercel\.app|netlify\.app/i.test(url)) return 'Portfolio';
  return LINK_TYPES.includes('Website') ? 'Website' : 'Other';
}

function splitName(full) {
  const parts = clean(full).replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const out = { firstName: '', middleName: '', lastName: '', suffix: '' };
  if (!parts.length) return out;
  if (/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1])) out.suffix = parts.pop();
  const fix = (w) => (w === w.toUpperCase() && w.length > 2 ? titleCase(w) : w);
  if (parts.length === 1) out.firstName = fix(parts[0]);
  else if (parts.length === 2) [out.firstName, out.lastName] = parts.map(fix);
  else {
    // Filipino compound surnames: "Juan Santos Dela Cruz"
    const particle = parts.findIndex((w, i) => i > 0 && /^(de|del|dela|delos|de los|san|sta\.?|sto\.?)$/i.test(w));
    const lastStart = particle > 1 ? particle : parts.length - 1;
    out.firstName = parts.slice(0, Math.max(1, lastStart - 1)).map(fix).join(' ');
    out.middleName = lastStart - 1 >= 1 ? fix(parts[lastStart - 1]) : '';
    out.lastName = parts.slice(lastStart).map(fix).join(' ');
  }
  return out;
}

const ADDRESS_HINT = /\b(st\.?|street|ave\.?|avenue|road|rd\.?|brgy\.?|barangay|city|province|purok|sitio|village|subd\.?|subdivision|metro manila|ncr|municipality|blk|lot|zone|phase)\b|\d{4}\s*$/i;

function parseHeader(lines) {
  const personal = {};
  if (!lines.length) return personal;
  const biggest = lines.reduce((a, b) => (b.size > a.size ? b : a), lines[0]);
  const nameLine = biggest.size >= lines[0].size * 1.15 ? biggest : lines[0];
  Object.assign(personal, splitName(nameLine.text.split('\t')[0]));

  const segments = lines
    .filter((l) => l !== nameLine)
    .flatMap((l) => l.text.split(/\t|\s[|•·]\s|\s{3,}/))
    .map(clean)
    .filter(Boolean);

  for (const seg of segments) {
    const email = EMAIL_RE.exec(seg);
    if (email && !personal.email) { personal.email = email[0]; continue; }
    const url = !email && URL_RE.exec(seg);
    if (url && !personal.link) { personal.link = url[0].replace(/[).,]+$/, ''); personal.linkType = guessLinkType(url[0]); continue; }
    const phone = PHONE_RE.exec(seg);
    if (phone && !personal.phone && phone[0].replace(/\D/g, '').length >= 7 && !ADDRESS_HINT.test(seg.replace(phone[0], ''))) {
      personal.phone = clean(phone[0]);
      continue;
    }
    if (!personal.address && (ADDRESS_HINT.test(seg) || (seg.match(/,/g) || []).length >= 2)) {
      const zip = /\b(\d{4})\s*$/.exec(seg);
      personal.address = stripPunct(zip ? seg.slice(0, zip.index) : seg);
      if (zip) personal.zip = zip[1];
      continue;
    }
    if (!personal.title && seg.length <= 60 && !/\d{3}/.test(seg) && !/^(address|email|phone|mobile|contact)\b/i.test(seg)) {
      personal.title = seg;
    }
  }
  return personal;
}

/**
 * Lines → bullet items.
 * - A bullet character always starts a new item.
 * - If the list has two line spacings (wrapped lines tight, items slightly apart — how this
 *   app draws its bullets), the larger gap starts a new item.
 * - Otherwise a line that starts in lowercase continues the previous item.
 */
function toItems(lines) {
  const ls = lines.filter((l) => clean(l.text));
  const wide = (l) => l.gapBefore > l.size * 1.57;
  const rest = ls.slice(1).filter((l) => !BULLET_RE.test(l.text));
  const useGaps = rest.some(wide) && rest.some((l) => !wide(l) && l.gapBefore > 0);

  // A line that ran to (nearly) the page's right text margin was wrapped by the layout.
  const wrapped = (l) => l && l.pageRight && l.right >= l.pageRight - l.size * 4;

  const items = [];
  let prevLine = null;
  for (const l of ls) {
    const t = clean(l.text);
    let continues;
    if (BULLET_RE.test(t) || !items.length) continues = false;
    else if (/^[a-z(&,]/.test(t)) continues = true;
    else if (useGaps && !l.first) continues = !wide(l);
    // Gaps can't decide (page break, or no second spacing seen): a line that ran to the
    // right margin without finishing a sentence means the item wraps onto this line.
    else continues = wrapped(prevLine) && !/[.!?]$/.test(items[items.length - 1]);
    if (continues) items[items.length - 1] += ' ' + t;
    else items.push(t.replace(BULLET_RE, ''));
    prevLine = l;
  }
  return items.map((s) => s.trim()).filter(Boolean);
}

/** Date part of an entry's title row: a range, or a right-aligned single date / "Present". */
function takeEntryDate(text) {
  if (BULLET_RE.test(text)) return null;
  const range = takeRange(text);
  if (range) return range;
  const parts = text.split('\t');
  if (parts.length < 2) return null;
  const last = clean(parts[parts.length - 1]);
  const rest = stripPunct(clean(parts.slice(0, -1).join(' ')));
  if (!rest) return null;
  if (/^(present|current|now|to date|ongoing)$/i.test(last)) return { start: '', end: '', current: true, rest };
  if (new RegExp(`^${DATE}$`, 'i').test(last)) return { start: last, end: '', current: false, rest };
  return null;
}

function splitReference(text) {
  const contact = PHONE_RE.exec(text) || EMAIL_RE.exec(text);
  return {
    referenceName: stripPunct(contact ? text.replace(contact[0], '') : text),
    referenceContact: contact ? clean(contact[0]) : '',
  };
}

function experienceType(text) {
  if (/\b(ojt|on[- ]the[- ]job|intern(ship)?|practicum)\b/i.test(text)) return 'OJT / Internship';
  if (/\bapprentic/i.test(text)) return 'Apprenticeship';
  if (/\b(capstone|thesis|school project|academic project|project)\b/i.test(text)) return 'School Project';
  return EXPERIENCE_TYPES[0];
}

/**
 * Experience entries start at a line with a date range ("Jan 2024 – Present").
 * The next plain line is "Organization | Location | Type"; bullet lines become
 * responsibilities, or accomplishments when they contain a number (unless the
 * PDF labels them explicitly).
 */
function parseExperience(lines) {
  const entries = [];
  let cur = null;
  let bucket = null;
  const pending = []; // plain lines seen before the first dated line

  // A short, plain line right before a date line is usually that entry's title.
  const takeTitleBefore = () => {
    const src = cur ? cur._lines : pending;
    const last = src[src.length - 1];
    if (last && !BULLET_RE.test(last.text) && clean(last.text).length < 70 && !/[.;]$/.test(clean(last.text))) {
      src.pop();
      return clean(last.text);
    }
    return '';
  };

  for (const l of lines) {
    const head = headingOf(l.text);
    if (head === 'responsibilities' || head === 'accomplishments') { bucket = head; continue; }
    const plain = clean(l.text);
    const range = takeEntryDate(l.text);
    if (range) {
      const title = range.rest.split('\t')[0] || takeTitleBefore();
      cur = {
        type: EXPERIENCE_TYPES[0], typeOther: '', role: title, organization: '', location: '', website: '',
        referenceName: '', referenceContact: '', start: range.start, end: range.end, current: range.current, _lines: [],
      };
      bucket = null;
      entries.push(cur);
      continue;
    }
    if (!cur) { pending.push(l); continue; }

    if (/^reference\s*:/i.test(plain)) { Object.assign(cur, splitReference(plain.replace(/^reference\s*:\s*/i, ''))); continue; }
    const url = URL_RE.exec(plain);
    if (url && !cur.website && !cur._lines.length && plain.length < 120 && !BULLET_RE.test(l.text)) {
      cur.website = url[0];
      const ref = /reference\s*:\s*(.+)$/i.exec(plain);
      if (ref) Object.assign(cur, splitReference(ref[1]));
      continue;
    }
    if (!BULLET_RE.test(l.text) && !cur.organization && !cur._lines.length && bucket === null) {
      const parts = plain.split(/\s*[|·•]\s*|\s+[–—]\s+|\s+-\s+/).map(clean).filter(Boolean);
      // "Organization | Location | Type" — the type label is optional and may be custom.
      const known = (p) => EXPERIENCE_TYPES.some((t) => t !== 'Other' && t.toLowerCase() === p.toLowerCase());
      const typeLike = (p) => known(p) || /\b(ojt|intern|apprentic|project|experience|volunteer|freelance|part[- ]time|full[- ]time|contract|seasonal|work)\b/i.test(p);
      cur.organization = parts[0] || '';
      const rest = parts.slice(1);
      let label = '';
      if (rest.length >= 2) label = rest[rest.length - 1];
      else if (rest.length === 1 && typeLike(rest[0])) label = rest[0];
      cur.location = rest.find((p) => p !== label) || '';
      if (label && known(label)) cur.type = EXPERIENCE_TYPES.find((t) => t.toLowerCase() === label.toLowerCase());
      else if (label) { cur.type = 'Other'; cur.typeOther = label; }
      else cur.type = experienceType(`${plain} ${cur.role}`);
      continue;
    }
    cur._lines.push({ ...l, bucket });
  }

  for (const e of entries) {
    const by = (b) => e._lines.filter((l) => l.bucket === b);
    const labelled = by('responsibilities').length || by('accomplishments').length;
    const auto = toItems(by(null));
    const resp = [...toItems(by('responsibilities')), ...(labelled ? auto : auto.filter((s) => !/\d/.test(s)))];
    const acc = [...toItems(by('accomplishments')), ...(labelled ? [] : auto.filter((s) => /\d/.test(s)))];
    e.responsibilities = resp.join('\n');
    e.accomplishments = acc.join('\n');
    delete e._lines;
  }
  return entries;
}

const DEGREE_RE = /\b(bachelor|master|doctor|ph\.?d|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba|associate|diploma|certificate in|senior high|junior high|high school|secondary|elementary|primary|strand|stem|abm|humss|gas|tvl|course)\b/i;
const SCHOOL_RE = /\b(university|college|school|institute|academy|polytechnic|colegio|universidad|lyceum|ateneo|tesda)\b/i;
const HONOR_RE = /\b(laude|honou?rs?|dean['’]?s list(er)?|valedictorian|salutatorian|scholar|with distinction|award(ee)?)\b/i;

// A school level written as the program ("Senior High School - GAS Strand"), not a school name.
const LEVEL_START_RE = /^(senior high|junior high|high school|secondary|elementary|primary|grade school|vocational|tech[- ]?voc)/i;

/**
 * Education entries. A title row with a right-aligned date ("Degree ⇥ June 2023") always
 * starts a new entry; the next line is the institution, then honors. Without that layout,
 * degree/school keywords decide.
 */
function parseEducation(lines) {
  const entries = [];
  let cur = null;
  const start = () => { cur = { degree: '', institution: '', graduation: '', honors: '' }; entries.push(cur); };
  for (const l of lines) {
    let t = clean(l.text.replace(BULLET_RE, ''));
    if (!t) continue;
    const range = takeRange(l.text);
    const single = !range && takeDate(l.text);
    let date = '';
    if (range) { date = range.end || 'Present'; t = range.rest; }
    else if (single) { date = single.date; t = single.rest; }
    if (!t && date) { if (cur && !cur.graduation) cur.graduation = date; continue; }

    if (date && l.text.includes('\t')) {
      start();
      cur.degree = t;
      cur.graduation = date;
      continue;
    }

    const isDegree = LEVEL_START_RE.test(t) || (DEGREE_RE.test(t) && !SCHOOL_RE.test(t.split(/[|,·]/)[0]));
    const isSchool = !LEVEL_START_RE.test(t) && SCHOOL_RE.test(t);
    const isHonor = HONOR_RE.test(t) && t.length < 80;

    if (isHonor && cur && !isDegree) { cur.honors = cur.honors ? `${cur.honors}, ${t}` : t; continue; }
    if (isDegree) {
      if (!cur || cur.degree) start();
      cur.degree = t;
    } else if (isSchool) {
      if (!cur || cur.institution) start();
      cur.institution = t.split(/\s*[|·]\s*/)[0];
    } else if (cur && !cur.institution) cur.institution = t;
    else if (!cur) { start(); cur.degree = t; }
    if (date && cur && !cur.graduation) cur.graduation = date;
  }
  return entries.filter((e) => e.degree || e.institution);
}

/**
 * Certifications: a bullet or dated line starts a new item ("Name  ·  Date");
 * one following plain line is taken as "Issuer | License No. 123".
 */
function parseCredentials(lines) {
  const entries = [];
  let cur = null;
  for (const l of lines) {
    const t = clean(l.text.replace(BULLET_RE, ''));
    if (!t) continue;
    const bullet = BULLET_RE.test(l.text);
    const dated = takeDate(l.text);
    const continuation = cur && !bullet && !dated && !cur._hasDetail && !/[.:]$/.test(cur.name);
    if (continuation) {
      cur._hasDetail = true;
      const license = /(?:license|certificate|cert\.?|reg(?:istration)?)\s*(?:no\.?|number|#)\s*:?\s*([\w-]+)/i.exec(t);
      if (license) cur.number = license[1];
      const parts = t.split(/\s*[|·]\s*/).filter((p) => !/(license|certificate)\s*(no|number|#)/i.test(p));
      if (parts[0]) cur.issuer = parts[0];
      continue;
    }
    let name = dated ? dated.rest || t : t;
    let issuer = '';
    // "Name ⇥ Date" title rows keep the whole name (it may contain " - "); the issuer is on the
    // next line. Single-line items ("• NC II - TESDA (2021)") carry the issuer after a dash.
    const titleRow = dated && l.text.includes('\t');
    const split = !titleRow && /\s+[|·–—]\s+|\s+-\s+/.exec(name);
    if (split) { issuer = clean(name.slice(split.index + split[0].length)); name = clean(name.slice(0, split.index)); }
    cur = { name, issuer, date: dated ? dated.date : '', number: '', _hasDetail: !!issuer };
    entries.push(cur);
  }
  return entries.map(({ _hasDetail, ...e }) => e).filter((e) => e.name);
}

// Common soft skills, matched on letters only ("Problem-Solving" = "problem solving").
const SOFT_SKILLS = new Set([
  'communication', 'clear communication', 'communication skills', 'verbal communication', 'written communication',
  'oral and written communication', 'interpersonal skills', 'interpersonal', 'teamwork', 'team player', 'collaboration',
  'leadership', 'adaptability', 'flexibility', 'problem solving', 'critical thinking', 'analytical thinking',
  'decision making', 'time management', 'organization', 'organizational skills', 'multitasking', 'attention to detail',
  'detail oriented', 'creativity', 'innovation', 'empathy', 'active listening', 'patience', 'customer service',
  'customer focus', 'conflict resolution', 'negotiation', 'public speaking', 'presentation skills', 'emotional intelligence',
  'work ethic', 'strong work ethic', 'reliability', 'dependability', 'dependable', 'punctuality', 'honesty', 'integrity',
  'professionalism', 'respectfulness', 'respect', 'resilience', 'initiative', 'self motivated', 'self motivation',
  'positive attitude', 'willingness to learn', 'eagerness to learn', 'quick learner', 'fast learner', 'coachable',
  'hardworking', 'hard working', 'cooperative', 'stress management', 'working under pressure', 'accountability',
  'resourcefulness', 'open mindedness', 'courtesy', 'friendliness', 'mentoring', 'coaching',
].map(headingKey));
const isSoftSkill = (s) => SOFT_SKILLS.has(headingKey(s));

/** Heuristic resume parser → partial resume state. */
export function parseResume(lines) {
  const sections = { header: [] };
  let current = 'header';
  let skillBucket = 'hard';
  let skillsLabelled = false;
  const skills = { hard: [], soft: [] };

  for (const l of lines) {
    const head = headingOf(l.text);
    if (head === 'hard' || head === 'soft') { current = 'skills'; skillBucket = head; skillsLabelled = true; continue; }
    if (head && head !== 'responsibilities' && head !== 'accomplishments') {
      current = head;
      if (head === 'skills') skillBucket = 'hard';
      sections[current] = sections[current] || [];
      continue;
    }
    if (current === 'skills') { skills[skillBucket].push(l); continue; }
    (sections[current] = sections[current] || []).push(l);
  }

  // Chips are separated by wide gaps (\t); text lists by commas, semicolons, pipes or bullets.
  // Separators inside brackets are kept: "MS Excel (Pivot Tables, VLOOKUP)".
  const splitSkills = (ls) =>
    ls.flatMap((l) => {
      const text = l.text.replace(/^[A-Za-z /&]{3,30}:\s*/, '').replace(/\s{2,}/g, '\t');
      // A row of chips: each chip is one skill, even if it contains ";" or ",".
      if (text.includes('\t')) return text.split('\t');
      return splitTopLevel(text, ',;|•·');
    })
      .map((s) => clean(s.replace(BULLET_RE, '')))
      .filter((s) => s && s.length <= 80);

  // Labelled lists ("Hard Skills" / "Soft Skills") are kept as they are. An unlabelled list is
  // sorted item by item: recognised soft skills go to Soft, everything else to Hard.
  let hard = splitSkills(skills.hard);
  let soft = splitSkills(skills.soft);
  if (!skillsLabelled) {
    soft = hard.filter(isSoftSkill);
    hard = hard.filter((s) => !isSoftSkill(s));
  }

  return {
    personal: parseHeader(sections.header || []),
    summary: { text: clean((sections.summary || []).map((l) => l.text).join(' ')) },
    skills: { hard: hard.join(', '), soft: soft.join(', ') },
    experience: parseExperience(sections.experience || []),
    education: parseEducation(sections.education || []),
    // Seminars & trainings read like certifications: "Title ⇥ Date", then "Organizer | Venue".
    trainings: parseCredentials(sections.trainings || []).map(({ name, issuer, date }) => {
      const [organizer = '', ...venue] = issuer.split(/\s*[|·]\s*/);
      return { name, organizer, location: venue.join(', '), date };
    }),
    credentials: parseCredentials(sections.credentials || []),
  };
}

/* ------------------------------------------------------------------ */
/* Cover letter                                                        */
/* ------------------------------------------------------------------ */

const CLOSE_RE = /^(sincerely|respectfully( yours)?|very truly yours|yours (truly|faithfully|sincerely)|best regards|kind regards|warm regards|regards|thank you|with gratitude)\s*,?$/i;
const LETTER_DATE_RE = new RegExp(`^(${MONTH}\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}|\\d{1,2}\\s+${MONTH}\\s+(?:19|20)\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-](?:19|20)\\d{2})$`, 'i');

function toIsoDate(text) {
  const d = new Date(text.replace(/(\d)(st|nd|rd|th)/, '$1'));
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Group lines into paragraphs using the vertical gap between them. */
function paragraphs(lines) {
  const out = [];
  for (const l of lines) {
    const t = clean(l.text);
    if (!t) continue;
    if (!out.length || l.gapBefore > l.size * 1.75 || l.page !== out[out.length - 1].page && /^[A-Z]/.test(t) && /[.!?]$/.test(out[out.length - 1].text)) {
      out.push({ text: t, page: l.page });
    } else {
      out[out.length - 1].text += (out[out.length - 1].text.endsWith('-') ? '' : ' ') + t;
      out[out.length - 1].page = l.page;
    }
  }
  return out.map((p) => p.text);
}

/** Heuristic cover letter parser → partial letter state. */
export function parseLetter(lines) {
  const texts = lines.map((l) => clean(l.text));
  let salIdx = texts.findIndex((t) => /^(dear|to whom it may concern|good (day|morning|afternoon)|greetings|hello|hi)\b/i.test(t));
  // Any other greeting ("Magandang araw, Hiring Manager,"): the first short line ending in "," or ":".
  if (salIdx < 0) {
    salIdx = texts.findIndex((t, i) => i > 0 && t.length <= 70 && /[,:]$/.test(t) && !/[!?]/.test(t) && !/\.\s+[a-z]/.test(t)
      && !CLOSE_RE.test(t) && !/^(re|subject|subj)\s*:/i.test(t));
  }
  const closeIdx = texts.findIndex((t, i) => i > salIdx && CLOSE_RE.test(t));
  const dateIdx = texts.findIndex((t, i) => (salIdx < 0 || i < salIdx) && LETTER_DATE_RE.test(t));
  const reIdx = texts.findIndex((t, i) => (salIdx < 0 || i < salIdx) && /^(re|subject|subj)\s*:/i.test(t));

  const recipient = { date: '', name: '', title: '', company: '', address: '' };
  if (dateIdx >= 0) recipient.date = toIsoDate(texts[dateIdx]);

  const recStart = dateIdx >= 0 ? dateIdx + 1 : 0;
  const recEnd = [reIdx, salIdx].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), texts.length);
  const rec = texts.slice(recStart, recEnd).filter(Boolean);
  // If there was no date, the lines before the recipient might be the sender's header: keep the last block.
  const block = dateIdx >= 0 ? rec : rec.slice(-4);
  const isCompany = (t) => /\b(inc\.?|corp\.?|corporation|company|co\.|ltd\.?|llc|enterprises?|group|solutions|services|bank|university|college|hospital|agency|digital|technologies|foundation)\b/i.test(t);
  if (block.length) {
    let i = 0;
    const isJobTitle = (t) => !/^(mr|ms|mrs|miss|dr|engr|atty|prof)\.?\s/i.test(t)
      && /\b(manager|officer|director|head|supervisor|specialist|coordinator|recruiter|hr|human resources|lead|assistant|associate|committee|department|president|ceo|cto|owner|principal|dean|chair(person)?|administrator|executive)\b/i.test(t);
    const unCaps = (t) => (/[a-z]/.test(t) ? t : t.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, a, b) => a + b.toUpperCase()));
    if (/^hiring manager$/i.test(block[0])) i++; // the letter's stand-in when no name was given
    else if (!isCompany(block[0]) && !ADDRESS_HINT.test(block[0]) && !isJobTitle(block[0])) recipient.name = unCaps(block[i++]);
    if (block[i] && !isCompany(block[i]) && !ADDRESS_HINT.test(block[i]) && block[i].length < 60) recipient.title = block[i++];
    if (block[i] && !ADDRESS_HINT.test(block[i]) || block[i] && isCompany(block[i])) recipient.company = block[i++];
    recipient.address = block.slice(i).join(', ');
  }

  const content = { position: '', greeting: DEFAULT_GREETING, greetingOther: '', salutation: '', opening: '', body: '', closing: '' };
  if (reIdx >= 0) {
    const re = texts[reIdx].replace(/^(re|subject|subj)\s*:\s*/i, '');
    content.position = clean(re.replace(/^(application|applying)\s+(for|as)\s+(the\s+)?(position\s+of\s+)?/i, '').replace(/\s+position$/i, ''));
  }
  if (salIdx >= 0) {
    const sal = texts[salIdx];
    // If it's exactly what one of the greeting options produces (ending in "," or ":"),
    // select that greeting and keep the salutation automatic; otherwise keep it as written.
    const bare = (x) => x.replace(/[,:]\s*$/, '').replace(/,/g, '').replace(/\s+/g, ' ').toLowerCase();
    const greeting = GREETINGS.find((g) => g !== 'Other' && bare(sal) === bare(autoSalutation(recipient.name, g)));
    // "<own greeting>, <recipient>," (e.g. "Good morning, Ms. Lim,") → Other + that greeting.
    const body = sal.replace(/[,:]\s*$/, '').trim();
    const addressees = [autoSalutation(recipient.name, 'Dear').replace(/^Dear\s+/, '').replace(/[,:]$/, ''), 'Hiring Manager'];
    const addr = !greeting && addressees.find((a) => body.toLowerCase().endsWith(a.toLowerCase()));
    const prefix = addr ? body.slice(0, body.length - addr.length).replace(/[\s,]+$/, '').trim() : '';
    if (greeting) content.greeting = greeting;
    else if (prefix && prefix.length <= 40) { content.greeting = 'Other'; content.greetingOther = prefix; }
    else content.salutation = sal;
  }

  const bodyLines = lines.slice(salIdx >= 0 ? salIdx + 1 : recEnd, closeIdx >= 0 ? closeIdx : lines.length);
  const paras = paragraphs(bodyLines);
  if (!content.position) {
    const m = /(?:apply|application)\s+for\s+(?:the\s+)?(?:position\s+of\s+)?([A-Z][\w/&,.' -]{2,60}?)\s+(?:position|role|at|with|in)\b/.exec(paras[0] || '');
    if (m) content.position = clean(m[1]);
  }
  if (paras.length === 1) content.opening = paras[0];
  else if (paras.length === 2) [content.opening, content.closing] = paras;
  else if (paras.length > 2) {
    content.opening = paras[0];
    content.closing = paras[paras.length - 1];
    content.body = paras.slice(1, -1).join('\n\n');
  }

  const signoff = { name: '', nameBold: true, showTitle: false, title: 'Applicant', complimentary: 'Sincerely,', enclosure: false };
  if (closeIdx >= 0) {
    const close = texts[closeIdx].replace(/,?$/, ',');
    signoff.complimentary = COMPLIMENTARY_CLOSES.find((c) => c.toLowerCase() === close.toLowerCase()) || 'Sincerely,';
    const after = texts.slice(closeIdx + 1).filter(Boolean);
    const nameLine = after.find((t) => !/^enclosures?\s*:/i.test(t) && !EMAIL_RE.test(t) && !PHONE_RE.test(t));
    if (nameLine && nameLine.length < 60) signoff.name = nameLine;
    // A short line right under the name ("Applicant", "Job Applicant") is the signature title.
    const titleLine = nameLine ? after[after.indexOf(nameLine) + 1] : '';
    if (titleLine && titleLine.length <= 40 && !/^enclosures?\s*:/i.test(titleLine) && !EMAIL_RE.test(titleLine) && !PHONE_RE.test(titleLine)) {
      signoff.showTitle = true;
      signoff.title = titleLine;
    }
    signoff.enclosure = after.some((t) => /^enclosures?\s*:/i.test(t));
  }

  return { recipient, content, signoff };
}
