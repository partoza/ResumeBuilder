// Cover letter: form schema, starting data and the model the preview/PDF render from.
// Standard block-format business letter: date, inside address, Re: line, salutation,
// opening / body / closing paragraphs, complimentary close, signature.
import { fullName, has } from './utils.js';

export const COMPLIMENTARY_CLOSES = ['Sincerely,', 'Respectfully yours,', 'Very truly yours,', 'Best regards,'];

/**
 * Font choices for the letter, like a word processor's font menu.
 * `pdf` is the jsPDF font: the three standard PDF fonts (Times, Helvetica = Arial
 * metrics, Courier) or the embedded Inter. ascent/descent are in em, used to place
 * the baseline inside a 1.15 line box exactly like the browser does.
 */
export const LETTER_FONTS = [
  { name: 'Times New Roman', css: '"Times New Roman", Times, "Liberation Serif", serif', pdf: 'times', ascent: 0.891, descent: 0.216 },
  { name: 'Arial', css: 'Arial, Helvetica, "Liberation Sans", sans-serif', pdf: 'helvetica', ascent: 0.905, descent: 0.212 },
  { name: 'Courier New', css: '"Courier New", Courier, "Liberation Mono", monospace', pdf: 'courier', ascent: 0.833, descent: 0.3 },
  { name: 'Inter', css: '"Inter", Arial, sans-serif', pdf: 'I400', ascent: 0.969, descent: 0.242 },
];
export const LETTER_SIZES = [10, 11, 12];
export const DEFAULT_FORMAT = { font: 'Times New Roman', size: 12 };
export const letterFont = (name) => LETTER_FONTS.find((f) => f.name === name) || LETTER_FONTS[0];

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
      { key: 'salutation', label: 'Salutation', placeholder: 'Leave blank to use “Dear Ms. Santos:” or “Dear Hiring Manager:”', full: true },
      {
        key: 'opening', label: 'Opening paragraph', type: 'textarea', full: true,
        hint: 'Name the position, where you found it, and one line on why you’re a strong fit.',
        placeholder: 'I am writing to apply for the Junior Web Developer position advertised on JobStreet…',
      },
      {
        key: 'body', label: 'Body', type: 'textarea', full: true,
        hint: 'Connect your skills and results to what the employer needs. Leave a blank line to start a new paragraph.',
        placeholder: 'During my internship at …, I built … which resulted in …',
      },
      {
        key: 'closing', label: 'Closing paragraph', type: 'textarea', full: true,
        hint: 'Restate your interest, ask for an interview, and thank the reader.',
        placeholder: 'I would welcome the opportunity to discuss how I can contribute to your team…',
      },
    ],
  },
  {
    id: 'signoff',
    title: 'Sign-off',
    desc: 'Complimentary close, your name and enclosure note.',
    kind: 'object',
    fields: [
      { key: 'name', label: 'Name in signature', placeholder: 'Uses your name from the Resume tab if blank', full: true },
      { key: 'complimentary', label: 'Complimentary close', type: 'select', options: COMPLIMENTARY_CLOSES, full: true },
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
    content: { position: '', salutation: '', opening: '', body: '', closing: '' },
    signoff: { name: '', complimentary: 'Sincerely,', enclosure: true },
    format: { ...DEFAULT_FORMAT },
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
      salutation: '',
      opening:
        'I am writing to apply for the Junior Web Developer position at Northwind Digital Inc., which I found on JobStreet. As a Cum Laude graduate in Information Technology with hands-on agency experience in React, I am confident I can help your team ship reliable, user-friendly web products from day one.',
      body:
        'During my internship at Bright Pixel Digital Solutions, I built responsive landing pages from Figma designs and developed reusable React components for two client dashboards. I resolved more than 40 UI bugs before launch and reduced page load time by 35% by optimizing images and scripts.\n\nAs lead developer of our capstone project, I guided a four-member team in building a barangay clearance request system that cut processing time from two days to three hours. That experience taught me to communicate clearly, document my work, and stay calm under deadlines. These are habits I would bring to Northwind.',
      closing:
        'I would welcome the opportunity to discuss how my skills can support your development team. Thank you for your time and consideration. I look forward to hearing from you.',
    },
    signoff: { name: 'Andrea Reyes Villanueva', complimentary: 'Sincerely,', enclosure: true },
    format: { ...DEFAULT_FORMAT },
  };
}

const HONORIFIC = /^(mr|ms|mrs|miss|dr|engr|atty|prof|arch|hon)\.?$/i;
const SURNAME_PARTICLE = /^(de|del|dela|della|delos|de los|da|di|san|sta\.?|sto\.?|van|von)$/i;

/** "Ms. Patricia Lim" → "Dear Ms. Lim:"; no title → "Dear Patricia Lim:"; blank → "Dear Hiring Manager:". */
export function autoSalutation(recipientName) {
  const parts = String(recipientName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Dear Hiring Manager:';
  if (parts.length > 2 && HONORIFIC.test(parts[0])) {
    const title = parts[0].replace(/\.?$/, '.');
    const rest = parts.slice(1);
    const particle = rest.findIndex((w, i) => i > 0 && i < rest.length - 1 && SURNAME_PARTICLE.test(w));
    const last = particle > 0 ? rest.slice(particle).join(' ') : rest[rest.length - 1];
    return `Dear ${title.charAt(0).toUpperCase() + title.slice(1)} ${last}:`;
  }
  return `Dear ${parts.join(' ')}:`;
}

function formatLongDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function letterHasContent(letter) {
  const { recipient: r, content: c, signoff: s } = letter;
  return [r.name, r.title, r.company, r.address, c.position, c.salutation, c.opening, c.body, c.closing, s.name].some(has);
}

/** Normalized cover letter content shared by the preview and the PDF. */
export function buildLetterModel(personal, letter) {
  const { recipient: r, content: c, signoff: s } = letter;
  const name = has(s.name) ? s.name.trim() : fullName(personal);
  const recipientName = (r.name || '').trim();

  const paragraphs = [
    c.opening,
    ...String(c.body || '').split(/\n\s*\n/),
    c.closing,
  ]
    .map((x) => String(x || '').trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean);

  const format = letter.format || DEFAULT_FORMAT;
  return {
    name,
    font: letterFont(format.font),
    size: LETTER_SIZES.includes(Number(format.size)) ? Number(format.size) : DEFAULT_FORMAT.size,
    date: formatLongDate(r.date),
    recipient: [recipientName, r.title, r.company, r.address].map((x) => (x || '').trim()).filter(Boolean),
    subject: has(c.position) ? `Re: Application for ${c.position.trim()}` : '',
    salutation: has(c.salutation) ? c.salutation.trim() : autoSalutation(recipientName),
    paragraphs,
    complimentary: s.complimentary || 'Sincerely,',
    enclosure: s.enclosure ? 'Enclosure: Resume' : '',
  };
}

/** Word count of the letter body, for the toolbar. Standard cover letters run ~250–400 words. */
export const letterWordCount = (m) =>
  m.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
