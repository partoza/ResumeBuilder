// Normalizes form data into the exact content shown on the resume.
// Both the on-screen preview and the PDF generator render from this, so they always match.
import { fullName, has, range, splitLines, splitList, toLink } from './utils.js';

// Icon per profile link type (see LINK_TYPES in data.js).
const LINK_ICON = { LinkedIn: 'linkedin', Facebook: 'facebook', GitHub: 'github', Portfolio: 'globe', Website: 'globe', Other: 'link' };

export function buildModel(d) {
  const p = d.personal;
  const address = [p.address, p.zip].map((x) => (x || '').trim()).filter(Boolean).join(' ');

  const experience = d.experience
    .filter((e) => has(e.role) || has(e.organization))
    .map((e) => ({
      role: e.role.trim(),
      meta: [e.organization, e.location, e.type !== 'Work Experience' ? e.type : ''].filter(has).map((x) => x.trim()).join(' | '),
      dates: range(e.start, e.current ? 'Present' : e.end),
      website: toLink(e.website),
      reference: [e.referenceName, e.referenceContact].filter(has).map((x) => x.trim()).join(', '),
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
      { type: 'phone', text: (p.phone || '').trim() },
      { type: 'mail', text: (p.email || '').trim(), href: has(p.email) ? `mailto:${p.email.trim()}` : undefined },
      { type: 'pin', text: address },
      ...(toLink(p.link) ? [{ type: LINK_ICON[p.linkType] || 'link', ...toLink(p.link) }] : []),
    ].filter((c) => c.text),
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
