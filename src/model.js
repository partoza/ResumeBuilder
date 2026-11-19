// Normalizes form data into the exact content shown on the resume.
// Both the on-screen preview and the PDF generator render from this, so they always match.
import { experienceLabel } from './data.js';
import { fullName, has, range, splitItems, splitList, toLink } from './utils.js';

// Icon per profile link type (see LINK_TYPES in data.js).
const LINK_ICON = { LinkedIn: 'linkedin', Facebook: 'facebook', GitHub: 'github', Portfolio: 'globe', Website: 'globe', Other: 'link' };

export function buildModel(d) {
  const p = d.personal;
  const address = [p.address, p.zip].map((x) => (x || '').trim()).filter(Boolean).join(' ');

  const experience = d.experience
    .filter((e) => has(e.role) || has(e.organization))
    .map((e) => ({
      role: e.role.trim(),
      meta: [e.organization, e.location, experienceLabel(e)].filter(has).map((x) => x.trim()).join(' | '),
      dates: range(e.start, e.current ? 'Present' : e.end),
      website: toLink(e.website),
      responsibilities: splitItems(e.responsibilities),
      accomplishments: splitItems(e.accomplishments),
    }));

  const trainings = (d.trainings || [])
    .filter((t) => has(t.name))
    .map((t) => ({
      name: t.name.trim(),
      meta: [t.organizer, t.location].filter(has).map((x) => x.trim()).join(' | '),
      date: (t.date || '').trim(),
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

  const references = (d.references || [])
    .filter((r) => has(r.name))
    .map((r) => ({
      name: r.name.trim(),
      meta: [r.position, r.organization].filter(has).map((x) => x.trim()).join(' | '),
      contact: (r.contact || '').trim(),
    }));

  return {
    name: fullName(p),
    title: (p.title || '').trim(),
    photo: p.photo || '',
    // Each contact item carries an icon type so preview and PDF draw the same icon.
    // Order: phone, email, profile link — then the address on its own row at the bottom.
    contact: [
      { type: 'phone', text: (p.phone || '').trim() },
      { type: 'mail', text: (p.email || '').trim(), href: has(p.email) ? `mailto:${p.email.trim()}` : undefined },
      ...(toLink(p.link) ? [{ type: LINK_ICON[p.linkType] || 'link', ...toLink(p.link) }] : []),
      { type: 'pin', text: address, ownRow: true },
    ].filter((c) => c.text),
    summary: (d.summary.text || '').trim().replace(/\s*\n\s*/g, ' '),
    skills: { hard: splitList(d.skills.hard), soft: splitList(d.skills.soft) },
    experience,
    trainings,
    education,
    credentials,
    references,
  };
}

/** Section headings — plain, standard wording that ATS parsers recognize. */
export const HEADINGS = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  trainings: 'Seminars & Trainings',
  education: 'Education & Credentials',
  references: 'References',
};

export const SUBHEADINGS = {
  hard: 'Hard Skills',
  soft: 'Soft Skills',
  responsibilities: 'Job Responsibilities',
  accomplishments: 'Accomplishments',
  education: 'Education',
  credentials: 'Certifications & Licenses',
};
