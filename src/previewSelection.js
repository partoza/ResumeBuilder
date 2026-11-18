// Map a text selection made on the preview (pdf.js text layer) back to the cover letter's
// paragraphs: [{ para, a, b }] — paragraph index and character range [a, b) in its text.
// Text-layer spans carry data-para / data-start / data-len (see tagSegments in PdfPages).

const offsetIn = (span, node, offset) => {
  const r = document.createRange();
  r.setStart(span, 0);
  r.setEnd(node, offset);
  return r.toString().length;
};

export function selectionToRanges(root) {
  const sel = window.getSelection();
  if (!root || !sel || !sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const byPara = new Map();
  for (const span of root.querySelectorAll('.textLayer span[data-start]')) {
    if (!range.intersectsNode(span)) continue;
    const len = span.textContent.length;
    let a = 0;
    let b = len;
    if (span.contains(range.startContainer)) a = offsetIn(span, range.startContainer, range.startOffset);
    if (span.contains(range.endContainer)) b = offsetIn(span, range.endContainer, range.endOffset);
    if (b <= a) continue;
    // The drawn string can differ slightly in length from the source (Latin-1 cleanup).
    const segLen = Number(span.dataset.len) || len;
    const scale = segLen === len ? 1 : segLen / len;
    const start = Number(span.dataset.start) + Math.round(a * scale);
    const end = Number(span.dataset.start) + Math.round(b * scale);
    const para = Number(span.dataset.para);
    const cur = byPara.get(para);
    byPara.set(para, cur ? [Math.min(cur[0], start), Math.max(cur[1], end)] : [start, end]);
  }
  return byPara.size ? [...byPara].map(([para, [a, b]]) => ({ para, a, b })) : null;
}
