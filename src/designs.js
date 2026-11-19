// Resume designs. Every design is a single column of real text in the same order, so each one
// stays ATS-readable and imports back cleanly (side-by-side columns get merged line by line by
// PDF readers and ATS parsers, so no design uses them) — they differ in header, headings, color and type.
// exportPdf.js draws them; ResumePreview.jsx + .paper.design-* styles mirror them on screen.

const INK = [17, 17, 17];
const INK2 = [63, 63, 70];
const INK3 = [113, 113, 122];
const RULE = [228, 228, 231];

export const RESUME_DESIGNS = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Clean black and white with a strong rule under the header',
    header: { style: 'plain', align: 'left', rule: 'solid', name: INK, title: INK2, contact: INK2, icon: '#71717a' },
    section: { style: 'rule', color: INK, rule: RULE },
    skills: { style: 'chips', bg: [250, 250, 250], border: RULE, text: INK2 },
    bullet: { shape: 'dot', color: INK3 },
    accent: INK,
  },
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Navy header band with blue headings',
    header: { style: 'band', band: [30, 58, 138], align: 'left', name: [255, 255, 255], title: [191, 219, 254], contact: [219, 234, 254], icon: '#bfdbfe' },
    section: { style: 'rule', color: [29, 78, 216], rule: [191, 219, 254] },
    skills: { style: 'chips', bg: [239, 246, 255], border: [191, 219, 254], text: [30, 58, 138] },
    bullet: { shape: 'dot', color: [29, 78, 216] },
    accent: [29, 78, 216],
  },
  {
    id: 'elegant',
    name: 'Elegant',
    desc: 'Centered serif header, formal and timeless',
    serif: 'Lora',
    header: { style: 'plain', align: 'center', rule: 'double', name: INK, title: INK2, titleItalic: true, contact: INK2, icon: '#52525b' },
    section: { style: 'center', color: INK, rule: [161, 161, 170] },
    skills: { style: 'text', text: INK2 },
    bullet: { shape: 'dot', color: INK2 },
    accent: INK,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Airy layout with teal headings and short accent underlines',
    header: { style: 'plain', align: 'left', rule: 'none', name: INK, title: [15, 118, 110], contact: INK2, icon: '#0f766e' },
    section: { style: 'underline', color: [15, 118, 110], rule: [15, 118, 110] },
    skills: { style: 'text', text: INK2 },
    bullet: { shape: 'dot', color: [15, 118, 110] },
    accent: [15, 118, 110],
  },
  {
    id: 'bold',
    name: 'Bold',
    desc: 'Charcoal header band with orange heading bars',
    header: { style: 'band', band: [24, 24, 27], align: 'left', name: [255, 255, 255], title: [253, 186, 116], contact: [228, 228, 231], icon: '#d4d4d8' },
    section: { style: 'bar', color: INK, bar: [255, 237, 213], mark: [194, 65, 12] },
    skills: { style: 'chips', bg: [255, 247, 237], border: [254, 215, 170], text: [154, 52, 18] },
    bullet: { shape: 'square', color: [194, 65, 12] },
    accent: [194, 65, 12],
  },
];

export const DEFAULT_DESIGN = 'classic';
export const designOf = (id) => RESUME_DESIGNS.find((d) => d.id === id) || RESUME_DESIGNS[0];

const rgb = (c) => `rgb(${c.join(' ')})`;

/** CSS custom properties for the on-screen (HTML) preview of a design. */
export function designVars(id) {
  const d = designOf(id);
  return {
    '--d-name': rgb(d.header.name),
    '--d-title': rgb(d.header.title),
    '--d-contact': rgb(d.header.contact),
    '--d-icon': d.header.icon,
    '--d-band': d.header.band ? rgb(d.header.band) : 'transparent',
    '--d-sec': rgb(d.section.color),
    '--d-sec-rule': rgb(d.section.rule || d.section.mark || RULE),
    '--d-sec-bar': d.section.bar ? rgb(d.section.bar) : 'transparent',
    '--d-chip-bg': d.skills.bg ? rgb(d.skills.bg) : 'transparent',
    '--d-chip-border': d.skills.border ? rgb(d.skills.border) : 'transparent',
    '--d-chip-text': rgb(d.skills.text),
    '--d-bullet': rgb(d.bullet.color),
    '--d-accent': rgb(d.accent),
  };
}
