// Font library for the cover letter.
//
// Standard PDF fonts (Times, Helvetica = Arial, Courier) need no files. The others are
// embedded TTFs with four styles — regular (r), bold (b), italic (i), bold italic (bi) —
// each loaded only when the letter actually uses it: as base64 for the PDF, and as a CSS
// FontFace for the on-screen editor/preview. ascent/descent (em) come from each font's
// hhea table and place the baseline inside a line box like the browser does.
import interR from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import interB from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import interI from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf?url';
import interBI from '@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf?url';
import robotoR from '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?url';
import robotoB from '@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf?url';
import robotoI from '@expo-google-fonts/roboto/400Regular_Italic/Roboto_400Regular_Italic.ttf?url';
import robotoBI from '@expo-google-fonts/roboto/700Bold_Italic/Roboto_700Bold_Italic.ttf?url';
import openSansR from '@expo-google-fonts/open-sans/400Regular/OpenSans_400Regular.ttf?url';
import openSansB from '@expo-google-fonts/open-sans/700Bold/OpenSans_700Bold.ttf?url';
import openSansI from '@expo-google-fonts/open-sans/400Regular_Italic/OpenSans_400Regular_Italic.ttf?url';
import openSansBI from '@expo-google-fonts/open-sans/700Bold_Italic/OpenSans_700Bold_Italic.ttf?url';
import latoR from '@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf?url';
import latoB from '@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf?url';
import latoI from '@expo-google-fonts/lato/400Regular_Italic/Lato_400Regular_Italic.ttf?url';
import latoBI from '@expo-google-fonts/lato/700Bold_Italic/Lato_700Bold_Italic.ttf?url';
import montserratR from '@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf?url';
import montserratB from '@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf?url';
import montserratI from '@expo-google-fonts/montserrat/400Regular_Italic/Montserrat_400Regular_Italic.ttf?url';
import montserratBI from '@expo-google-fonts/montserrat/700Bold_Italic/Montserrat_700Bold_Italic.ttf?url';
import poppinsR from '@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf?url';
import poppinsB from '@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf?url';
import poppinsI from '@expo-google-fonts/poppins/400Regular_Italic/Poppins_400Regular_Italic.ttf?url';
import poppinsBI from '@expo-google-fonts/poppins/700Bold_Italic/Poppins_700Bold_Italic.ttf?url';
import merriweatherR from '@expo-google-fonts/merriweather/400Regular/Merriweather_400Regular.ttf?url';
import merriweatherB from '@expo-google-fonts/merriweather/700Bold/Merriweather_700Bold.ttf?url';
import merriweatherI from '@expo-google-fonts/merriweather/400Regular_Italic/Merriweather_400Regular_Italic.ttf?url';
import merriweatherBI from '@expo-google-fonts/merriweather/700Bold_Italic/Merriweather_700Bold_Italic.ttf?url';
import loraR from '@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf?url';
import loraB from '@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf?url';
import loraI from '@expo-google-fonts/lora/400Regular_Italic/Lora_400Regular_Italic.ttf?url';
import loraBI from '@expo-google-fonts/lora/700Bold_Italic/Lora_700Bold_Italic.ttf?url';
import garamondR from '@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf?url';
import garamondB from '@expo-google-fonts/eb-garamond/700Bold/EBGaramond_700Bold.ttf?url';
import garamondI from '@expo-google-fonts/eb-garamond/400Regular_Italic/EBGaramond_400Regular_Italic.ttf?url';
import garamondBI from '@expo-google-fonts/eb-garamond/700Bold_Italic/EBGaramond_700Bold_Italic.ttf?url';
import baskervilleR from '@expo-google-fonts/libre-baskerville/400Regular/LibreBaskerville_400Regular.ttf?url';
import baskervilleB from '@expo-google-fonts/libre-baskerville/700Bold/LibreBaskerville_700Bold.ttf?url';
import baskervilleI from '@expo-google-fonts/libre-baskerville/400Regular_Italic/LibreBaskerville_400Regular_Italic.ttf?url';
import baskervilleBI from '@expo-google-fonts/libre-baskerville/700Bold_Italic/LibreBaskerville_700Bold_Italic.ttf?url';
import ptSerifR from '@expo-google-fonts/pt-serif/400Regular/PTSerif_400Regular.ttf?url';
import ptSerifB from '@expo-google-fonts/pt-serif/700Bold/PTSerif_700Bold.ttf?url';
import ptSerifI from '@expo-google-fonts/pt-serif/400Regular_Italic/PTSerif_400Regular_Italic.ttf?url';
import ptSerifBI from '@expo-google-fonts/pt-serif/700Bold_Italic/PTSerif_700Bold_Italic.ttf?url';
import gelasioR from '@expo-google-fonts/gelasio/400Regular/Gelasio_400Regular.ttf?url';
import gelasioB from '@expo-google-fonts/gelasio/700Bold/Gelasio_700Bold.ttf?url';
import gelasioI from '@expo-google-fonts/gelasio/400Regular_Italic/Gelasio_400Regular_Italic.ttf?url';
import gelasioBI from '@expo-google-fonts/gelasio/700Bold_Italic/Gelasio_700Bold_Italic.ttf?url';

const embedded = (name, files, ascent, descent, generic, label) => ({
  name, label: label || name, files, ascent, descent,
  css: `"RB ${name}", ${generic}`,
  key: `F_${name.replace(/[^A-Za-z0-9]/g, '')}`,
});

export const LETTER_FONTS = [
  { name: 'Times New Roman', css: '"Times New Roman", Times, "Liberation Serif", serif', std: 'times', ascent: 0.891, descent: 0.216 },
  { name: 'Arial', css: 'Arial, Helvetica, "Liberation Sans", sans-serif', std: 'helvetica', ascent: 0.905, descent: 0.212 },
  { name: 'Courier New', css: '"Courier New", Courier, "Liberation Mono", monospace', std: 'courier', ascent: 0.833, descent: 0.3 },
  embedded('Georgia', { r: gelasioR, b: gelasioB, i: gelasioI, bi: gelasioBI }, 0.928, 0.342, 'Georgia, serif', 'Georgia (Gelasio)'),
  embedded('Garamond', { r: garamondR, b: garamondB, i: garamondI, bi: garamondBI }, 1.007, 0.298, 'Garamond, serif', 'Garamond (EB Garamond)'),
  embedded('Libre Baskerville', { r: baskervilleR, b: baskervilleB, i: baskervilleI, bi: baskervilleBI }, 0.97, 0.27, 'Baskerville, serif'),
  embedded('Merriweather', { r: merriweatherR, b: merriweatherB, i: merriweatherI, bi: merriweatherBI }, 0.984, 0.273, 'serif'),
  embedded('Lora', { r: loraR, b: loraB, i: loraI, bi: loraBI }, 1.006, 0.274, 'serif'),
  embedded('PT Serif', { r: ptSerifR, b: ptSerifB, i: ptSerifI, bi: ptSerifBI }, 1.039, 0.286, 'serif'),
  embedded('Inter', { r: interR, b: interB, i: interI, bi: interBI }, 0.969, 0.242, 'sans-serif'),
  embedded('Roboto', { r: robotoR, b: robotoB, i: robotoI, bi: robotoBI }, 0.928, 0.244, 'sans-serif'),
  embedded('Open Sans', { r: openSansR, b: openSansB, i: openSansI, bi: openSansBI }, 1.069, 0.293, 'sans-serif'),
  embedded('Lato', { r: latoR, b: latoB, i: latoI, bi: latoBI }, 0.987, 0.213, 'sans-serif'),
  embedded('Montserrat', { r: montserratR, b: montserratB, i: montserratI, bi: montserratBI }, 0.968, 0.251, 'sans-serif'),
  embedded('Poppins', { r: poppinsR, b: poppinsB, i: poppinsI, bi: poppinsBI }, 1.05, 0.35, 'sans-serif'),
];

export const fontByName = (name) => LETTER_FONTS.find((f) => f.name === name) || null;
export const letterFont = (name) => fontByName(name) || LETTER_FONTS[0];

/** Style key for a run: r, b, i or bi. */
export const styleKey = (bold, italic) => (bold ? (italic ? 'bi' : 'b') : italic ? 'i' : 'r');

/* ---------------- CSS (editor + HTML preview) ---------------- */

const CSS_FACE = { r: ['400', 'normal'], b: ['700', 'normal'], i: ['400', 'italic'], bi: ['700', 'italic'] };
const cssLoads = new Map();

/** Load the on-screen faces of a font (all four styles). Resolves even if loading fails. */
export function ensureCssFont(name) {
  const f = fontByName(name);
  if (!f?.files || typeof FontFace === 'undefined') return Promise.resolve();
  if (!cssLoads.has(name)) {
    cssLoads.set(
      name,
      Promise.all(
        Object.entries(CSS_FACE).map(async ([k, [weight, style]]) => {
          const face = new FontFace(`RB ${name}`, `url(${f.files[k]})`, { weight, style });
          await face.load();
          document.fonts.add(face);
        })
      ).catch(() => {})
    );
  }
  return cssLoads.get(name);
}

/* ---------------- PDF (base64 for jsPDF) ---------------- */

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const fileCache = new Map();
function fontFile(url) {
  if (!fileCache.has(url)) {
    fileCache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`font ${r.status}`);
          return r.arrayBuffer();
        })
        .then(toBase64)
    );
  }
  return fileCache.get(url);
}

/**
 * Register fonts in a jsPDF document. `usage` maps font name → Set of style keys needed.
 * Returns a Set of "name|style" entries that are available. Standard fonts are always available.
 */
export async function registerPdfFonts(doc, usage) {
  const ok = new Set();
  await Promise.all(
    [...usage].flatMap(([name, styles]) => {
      const f = fontByName(name);
      if (!f) return [];
      return [...styles].map(async (k) => {
        if (f.std) { ok.add(`${name}|${k}`); return; }
        try {
          const data = await fontFile(f.files[k]);
          const id = `${f.key}-${k}`;
          doc.addFileToVFS(`${id}.ttf`, data);
          doc.addFont(`${id}.ttf`, id, 'normal');
          ok.add(`${name}|${k}`);
        } catch (err) {
          console.warn(`Font ${name} (${k}) unavailable, using Helvetica`, err);
        }
      });
    })
  );
  return ok;
}

const STD_STYLE = { r: 'normal', b: 'bold', i: 'italic', bi: 'bolditalic' };

/** [fontName, fontStyle] for jsPDF's setFont; falls back to Helvetica if a face couldn't load. */
export function pdfFontFor(name, bold, italic, available) {
  const f = letterFont(name);
  const k = styleKey(bold, italic);
  if (f.std) return [f.std, STD_STYLE[k]];
  if (available.has(`${f.name}|${k}`)) return [`${f.key}-${k}`, 'normal'];
  return ['helvetica', STD_STYLE[k]];
}

export const isStandardFont = (name) => !!letterFont(name).std;
