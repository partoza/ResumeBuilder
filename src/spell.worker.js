// Spell-check worker: builds a Hunspell (en_US) checker off the main thread.
import nspell from 'nspell';

let spell = null;
let ready = null;

async function init(affUrl, dicUrl, extra) {
  const [aff, dic] = await Promise.all([
    fetch(affUrl).then((r) => r.text()),
    fetch(dicUrl).then((r) => r.text()),
  ]);
  spell = nspell(aff, dic);
  for (const w of extra) spell.add(w);
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'init') {
      ready = ready || init(e.data.aff, e.data.dic, e.data.extra || []);
      await ready;
      self.postMessage({ id, ok: true });
    } else if (type === 'add') {
      await ready;
      for (const w of e.data.words) spell.add(w);
      self.postMessage({ id, ok: true });
    } else if (type === 'check') {
      await ready;
      self.postMessage({ id, bad: e.data.words.filter((w) => !spell.correct(w)) });
    } else if (type === 'suggest') {
      await ready;
      self.postMessage({ id, suggestions: spell.suggest(e.data.word).slice(0, 6) });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
