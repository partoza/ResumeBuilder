// Map a text selection made on the preview (pdf.js text layer) back to the cover letter:
// [{ para, a, b }] for paragraphs and [{ part, a, b }] for the other lines (date, recipient,
// Re:, salutation, close, name, title, enclosure) — with the character range [a, b).
// Text-layer spans carry data-para or data-part, plus data-start / data-len (see PdfPages).

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

  const byTarget = new Map(); // "p:3" / "t:date" → { para | part, a, b }
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
    const part = span.dataset.part;
    const key = part ? `t:${part}` : `p:${span.dataset.para}`;
    const cur = byTarget.get(key);
    if (cur) {
      cur.a = Math.min(cur.a, start);
      cur.b = Math.max(cur.b, end);
    } else {
      byTarget.set(key, part ? { part, a: start, b: end } : { para: Number(span.dataset.para), a: start, b: end });
    }
  }
  return byTarget.size ? [...byTarget.values()] : null;
}
