// Thumbnail images of each resume design: page 1 of the sample resume, drawn by the real PDF
// generator so the picture is exactly what the design produces. Rendered once per visit.
import { createResumePdf } from './exportPdf.js';
import { buildModel } from './model.js';
import { sampleState } from './data.js';
import { loadPdfjs } from './pdfjs.js';

const THUMB_PX = 280; // image width; shown at ~110 CSS px, so sharp on 2× screens
const cache = new Map(); // design id → Promise<data URL>

/** PNG data URL of the design's first page. */
export function designThumb(id) {
  if (!cache.has(id)) {
    cache.set(id, render(id).catch((err) => {
      cache.delete(id); // let a later visit retry
      throw err;
    }));
  }
  return cache.get(id);
}

async function render(id) {
  const doc = await createResumePdf(buildModel(sampleState()), { paper: 'a4', design: id });
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({
    data: new Uint8Array(doc.output('arraybuffer')),
    isEvalSupported: false,
    disableFontFace: true, // embedded fonts drawn as paths (faster)
  }).promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: THUMB_PX / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
    return canvas.toDataURL('image/png');
  } finally {
    pdf.destroy();
  }
}
