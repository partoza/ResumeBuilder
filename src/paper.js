// Paper sizes offered for the resume and the cover letter. A4 is the default.
// "Long" is long bond paper (8.5 × 13 in), common for documents in the Philippines.
export const PAPERS = {
  a4: { label: 'A4', name: 'A4', w: 210, h: 297 },
  letter: { label: 'Letter', name: 'Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
  long: { label: 'Long', name: 'Long (8.5 × 13 in)', w: 215.9, h: 330.2 },
};
export const DEFAULT_PAPER = 'a4';

export const paperOf = (key) => PAPERS[key] || PAPERS[DEFAULT_PAPER];

const MM_TO_PX = 96 / 25.4;
/** Page size in CSS pixels at 96 dpi. */
export const paperPx = (key) => {
  const p = paperOf(key);
  return { w: Math.round(p.w * MM_TO_PX), h: Math.round(p.h * MM_TO_PX) };
};
