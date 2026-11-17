// Normalizes form data into the exact content shown on the resume.
// Both the on-screen preview and the PDF generator render from this, so they always match.
import { fullName, has, range, splitLines, splitList } from './utils.js';

export function buildModel(d) {
  const p = d.personal;
  const address = [p.address, p.zip].map((x) => (x || '').trim()).filter(Boolean).join(' ');

  const experience = d.experience
    .filter((e) => has(e.role) || has(e.organization))
    .map((e) => ({
      role: e.role.trim(),
      meta: [e.organization, e.location, e.type !== 'Work Experience' ? e.type : ''].filter(has).map((x) => x.trim()).join(' | '),
      dates: range(e.start, e.current ? 'Present' : e.end),
      responsibilities: splitLines(e.responsibilities),
      accomplishments: splitLines(e.accomplishments),
    }));

  const education = d.education
    .filter((e) => has(e.degree) || has(e.institution))
    .map((e) => ({
      degree: e.degree.trim(),
      institution: e.institution.trim(),
      date: e.graduation.trim(),
      honors: e.honors.trim(),
    }));

  const credentials = d.credentials
    .filter((c) => has(c.name))
    .map((c) => ({
      name: c.name.trim(),
      meta: [c.issuer, has(c.number) ? `License No. ${c.number.trim()}` : ''].filter(has).map((x) => x.trim()).join(' | '),
      date: c.date.trim(),
    }));

  return {
    name: fullName(p),
    title: (p.title || '').trim(),
    photo: p.photo || '',
    // Each contact item carries an icon type so preview and PDF draw the same icon.
    contact: [
      ['phone', (p.phone || '').trim()],
      ['mail', (p.email || '').trim()],
      ['pin', address],
    ].filter(([, text]) => text).map(([type, text]) => ({ type, text })),
    summary: (d.summary.text || '').trim().replace(/\s*\n\s*/g, ' '),
    skills: { hard: splitList(d.skills.hard), soft: splitList(d.skills.soft) },
    experience,
    education,
    credentials,
  };
}

/** Section headings — plain, standard wording that ATS parsers recognize. */
export const HEADINGS = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education & Credentials',
};

export const SUBHEADINGS = {
  hard: 'Hard Skills',
  soft: 'Soft Skills',
  responsibilities: 'Job Responsibilities',
  accomplishments: 'Accomplishments',
  education: 'Education',
  credentials: 'Certifications & Licenses',
};
