// Cover letter: form schema, starting data and the model the preview/PDF render from.
// Standard block-format business letter: date, inside address, Re: line, salutation,
// opening / body / closing paragraphs, complimentary close, signature.
import { fullName, has } from './utils.js';
import { LETTER_FONTS, letterFont } from './fonts.js';
import { RUN_SIZES, paragraphText, parseRich, richPlain } from './rich.js';

export { LETTER_FONTS, letterFont };

export const COMPLIMENTARY_CLOSES = ['Sincerely,', 'Respectfully yours,', 'Very truly yours,', 'Best regards,'];

/** Opening word(s) of the automatic salutation. "To Whom It May Concern" stands alone. */
export const GREETINGS = ['Dear', 'Good day', 'Greetings', 'Hello', 'To Whom It May Concern', 'Other'];
export const DEFAULT_GREETING = 'Dear';

/** Base text sizes for the whole letter (selected text can use any size in RUN_SIZES). */
export const LETTER_SIZES = RUN_SIZES;
export const LETTER_ALIGNS = ['left', 'center', 'right', 'justify'];
export const DEFAULT_FORMAT = { font: 'Times New Roman', size: 12, align: 'left' };

export const LETTER_SECTIONS = [
  {
    id: 'recipient',
    title: 'Recipient',
    desc: 'Date and who the letter is addressed to.',
    kind: 'object',
    fields: [
      { key: 'date', label: 'Date', type: 'date', full: true },
      { key: 'name', label: 'Hiring manager', placeholder: 'Ms. Maria Santos (leave blank if unknown)' },
      { key: 'title', label: 'Their position', placeholder: 'HR Manager' },
      { key: 'company', label: 'Company', placeholder: 'ABC Corporation', full: true },
      { key: 'address', label: 'Company address', placeholder: '25th Floor, Ayala Avenue, Makati City 1226', full: true },
    ],
  },
  {
    id: 'content',
    title: 'Letter',
    desc: 'Three short parts: opening, why you fit, and closing.',
    kind: 'object',
    fields: [
      { key: 'position', label: 'Position applied for', placeholder: 'Junior Web Developer', full: true },
      { key: 'greeting', label: 'Greeting', type: 'select', options: GREETINGS },
      {
        key: 'greetingOther', label: 'Your greeting', placeholder: 'e.g. Good morning, Hi, Magandang araw',
        hint: 'Followed by the recipient’s name, e.g. “Good morning, Ms. Santos:”.',
        showWhen: (c) => c.greeting === 'Other',
      },
      {
        key: 'salutation', label: 'Custom salutation (optional)', placeholder: 'e.g. Dear Search Committee:',
        hint: 'Leave blank to use the greeting with the recipient’s name, e.g. “Dear Ms. Santos:” or “Dear Hiring Manager:”.',
      },
      {
        key: 'opening', label: 'Opening paragraph', type: 'rich', full: true,
        hint: 'Name the position, where you found it, and one line on why you’re a strong fit.',
        placeholder: 'I am writing to apply for the Junior Web Developer position advertised on JobStreet…',
      },
      {
        key: 'body', label: 'Body', type: 'rich', full: true,
        hint: 'Connect your skills and results to what the employer needs. Leave a blank line to start a new paragraph.',
        placeholder: 'During my internship at …, I built … which resulted in …',
      },
      {
        key: 'closing', label: 'Closing paragraph', type: 'rich', full: true,
        hint: 'Restate your interest, ask for an interview, and thank the reader.',
        placeholder: 'I would welcome the opportunity to discuss how I can contribute to your team…',
      },
    ],
  },
  {
    id: 'signoff',
    title: 'Sign-off',
    desc: 'Complimentary close, your name, a line under it, and the enclosure note.',
    kind: 'object',
    fields: [
      { key: 'complimentary', label: 'Complimentary close', type: 'select', options: COMPLIMENTARY_CLOSES, full: true },
      { key: 'name', label: 'Name in signature', placeholder: 'Uses your name from the Resume tab if blank', full: true },
      { key: 'nameBold', label: 'Bold name', type: 'checkbox', full: true },
      { key: 'showTitle', label: 'Add a line under your name', type: 'checkbox', full: true },
      { key: 'title', label: 'Line under your name', placeholder: 'Applicant', full: true, showWhen: (s) => s.showTitle },
      { key: 'enclosure', label: 'Add “Enclosure: Resume” below the signature', type: 'checkbox', full: true },
    ],
  },
];

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function blankLetter() {
  return {
    recipient: { date: todayIso(), name: '', title: '', company: '', address: '' },
    content: { position: '', greeting: DEFAULT_GREETING, greetingOther: '', salutation: '', opening: '', body: '', closing: '' },
    signoff: { name: '', nameBold: true, showTitle: true, title: 'Applicant', complimentary: 'Sincerely,', enclosure: true },
    format: { ...DEFAULT_FORMAT },
    styles: {},
  };
}

export function sampleLetter() {
  return {
    recipient: {
      date: todayIso(),
      name: 'Ms. Patricia Lim',
      title: 'Talent Acquisition Manager',
      company: 'Northwind Digital Inc.',
      address: '12th Floor, One Corporate Center, Ortigas Center, Pasig City 1605',
    },
    content: {
      position: 'Junior Web Developer',
      greeting: DEFAULT_GREETING,
      greetingOther: '',
      salutation: '',
      opening:
        'I am writing to apply for the Junior Web Developer position at Northwind Digital Inc., which I found on JobStreet. As a Cum Laude graduate in Information Technology with hands-on agency experience in React, I am confident I can help your team ship reliable, user-friendly web products from day one.',
      body:
        'During my internship at Bright Pixel Digital Solutions, I built responsive landing pages from Figma designs and developed reusable React components for two client dashboards. I resolved more than 40 UI bugs before launch and reduced page load time by 35% by optimizing images and scripts.\n\nAs lead developer of our capstone project, I guided a four-member team in building a barangay clearance request system that cut processing time from two days to three hours. That experience taught me to communicate clearly, document my work, and stay calm under deadlines. These are habits I would bring to Northwind.',
      closing:
        'I would welcome the opportunity to discuss how my skills can support your development team. Thank you for your time and consideration. I look forward to hearing from you.',
    },
    signoff: { name: 'Andrea Reyes Villanueva', nameBold: true, showTitle: true, title: 'Applicant', complimentary: 'Sincerely,', enclosure: true },
    format: { ...DEFAULT_FORMAT },
    styles: {},
  };
}

const HONORIFIC = /^(mr|ms|mrs|miss|dr|engr|atty|prof|arch|hon)\.?$/i;
const SURNAME_PARTICLE = /^(de|del|dela|della|delos|de los|da|di|san|sta\.?|sto\.?|van|von)$/i;

/** "Ms. Patricia Lim" → "Ms. Lim"; no title → "Patricia Lim"; blank → "Hiring Manager". */
function addressee(recipientName) {
  const parts = String(recipientName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Hiring Manager';
  if (parts.length > 2 && HONORIFIC.test(parts[0])) {
    const title = parts[0].replace(/\.?$/, '.');
    const rest = parts.slice(1);
    const particle = rest.findIndex((w, i) => i > 0 && i < rest.length - 1 && SURNAME_PARTICLE.test(w));
    const last = particle > 0 ? rest.slice(particle).join(' ') : rest[rest.length - 1];
    return `${title.charAt(0).toUpperCase() + title.slice(1)} ${last}`;
  }
  return parts.join(' ');
}

/**
 * Salutation from a greeting and the recipient's name:
 * Dear → "Dear Ms. Lim:"   Good day → "Good day, Ms. Lim:"   Greetings → "Greetings, Ms. Lim:"
 * Hello → "Hello Ms. Lim:"   To Whom It May Concern → "To Whom It May Concern:"
 * Other + "Good morning" → "Good morning, Ms. Lim:"  (business-letter colon)
 */
export function autoSalutation(recipientName, greeting = DEFAULT_GREETING, other = '') {
  if (greeting === 'Other') {
    const custom = String(other || '').trim().replace(/[,:]+$/, '');
    if (custom) return `${custom}, ${addressee(recipientName)}:`;
  }
  const g = GREETINGS.includes(greeting) && greeting !== 'Other' ? greeting : DEFAULT_GREETING;
  if (g === 'To Whom It May Concern') return `${g}:`;
  const sep = g === 'Good day' || g === 'Greetings' ? ', ' : ' ';
  return `${g}${sep}${addressee(recipientName)}:`;
}

function formatLongDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function letterHasContent(letter) {
  const { recipient: r, content: c, signoff: s } = letter;
  return [r.name, r.title, r.company, r.address, c.position, c.salutation, richPlain(c.opening), richPlain(c.body), richPlain(c.closing), s.name].some(has);
}

/** Normalized cover letter content shared by the preview and the PDF. */
export function buildLetterModel(personal, letter) {
  const { recipient: r, content: c, signoff: s } = letter;
  const name = has(s.name) ? s.name.trim() : fullName(personal);
  const recipientName = (r.name || '').trim();

  // Paragraphs of formatted runs: [[{ text, bold?, italic?, size?, font? }, …], …], and where each
  // one comes from ({ field, index }) so a selection in the preview can be written back.
  const paragraphs = [];
  const paragraphSources = [];
  for (const field of ['opening', 'body', 'closing']) {
    parseRich(c[field]).forEach((p, index) => {
      paragraphs.push(p);
      paragraphSources.push({ field, index });
    });
  }

  const format = letter.format || DEFAULT_FORMAT;
  const font = letterFont(format.font);
  const nameBold = s.nameBold !== false;

  // Every other line of the letter (date, recipient, Re:, salutation, close, signature,
  // enclosure) can be formatted from the preview too. Their text comes from other fields,
  // so formatting is stored per part (letter.styles[key]) and reused while the text matches.
  const partTexts = [
    ['date', formatLongDate(r.date)],
    ['recipient.name', recipientName],
    ['recipient.title', (r.title || '').trim()],
    ['recipient.company', (r.company || '').trim()],
    ['recipient.address', (r.address || '').trim()],
    ['subject', has(c.position) ? `Re: Application for ${c.position.trim()}` : ''],
    ['salutation', has(c.salutation) ? c.salutation.trim() : autoSalutation(recipientName, c.greeting, c.greetingOther)],
    ['complimentary', s.complimentary || 'Sincerely,'],
    ['name', name],
    ['title', s.showTitle ? (s.title || '').trim() : ''],
    ['enclosure', s.enclosure ? 'Enclosure: Resume' : ''],
  ];
  const parts = {};
  for (const [key, text] of partTexts) {
    if (text) parts[key] = partRuns(letter.styles?.[key], text, key === 'name' && nameBold ? { bold: true } : {});
  }

  const fontsUsed = new Set([font.name]);
  for (const runs of [...paragraphs, ...Object.values(parts)]) for (const run of runs) if (run.font) fontsUsed.add(run.font);
  return {
    name,
    font,
    fontsUsed: [...fontsUsed],
    size: LETTER_SIZES.includes(Number(format.size)) ? Number(format.size) : DEFAULT_FORMAT.size,
    align: LETTER_ALIGNS.includes(format.align) ? format.align : 'left',
    parts,
    date: parts.date ? partTexts[0][1] : '',
    recipient: ['recipient.name', 'recipient.title', 'recipient.company', 'recipient.address'].filter((k) => parts[k]).map((k) => paragraphText(parts[k])),
    recipientKeys: ['recipient.name', 'recipient.title', 'recipient.company', 'recipient.address'].filter((k) => parts[k]),
    subject: parts.subject ? paragraphText(parts.subject) : '',
    salutation: paragraphText(parts.salutation || []),
    paragraphs,
    paragraphSources,
    complimentary: paragraphText(parts.complimentary || []),
    nameBold,
    signatureTitle: parts.title ? paragraphText(parts.title) : '',
    enclosure: parts.enclosure ? paragraphText(parts.enclosure) : '',
  };
}

/** Letter lines (besides the paragraphs) that can be formatted from the preview. */
export const LETTER_PART_KEYS = [
  'date', 'recipient.name', 'recipient.title', 'recipient.company', 'recipient.address',
  'subject', 'salutation', 'complimentary', 'name', 'title', 'enclosure',
];

/**
 * Formatted runs for a letter part: the saved formatting if its text still matches; if the text
 * changed, a uniform saved style (e.g. the whole line bold) is kept; otherwise plain `base`.
 */
function partRuns(stored, text, base) {
  const saved = stored ? parseRich(stored)[0] : null;
  if (saved?.length) {
    if (paragraphText(saved) === text) return saved;
    const uniform = saved.every((r) => !!r.bold === !!saved[0].bold && !!r.italic === !!saved[0].italic && r.size === saved[0].size && r.font === saved[0].font);
    if (uniform) {
      const { text: _unused, ...st } = saved[0];
      return [{ ...st, text }];
    }
  }
  return [{ ...base, text }];
}

/** Word count of the letter body, for the toolbar. Standard cover letters run ~250–400 words. */
export const letterWordCount = (m) =>
  m.paragraphs.map((p) => p.map((r) => r.text).join('')).join(' ').split(/\s+/).filter(Boolean).length;
