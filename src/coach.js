// Lightweight resume-coaching checks shown under form fields.
// Each returns null (nothing to say) or { level: 'ok' | 'warn', text }.
import { splitLines } from './utils.js';

const WEAK_OPENERS = [
  /^responsible for\b/i,
  /^duties\b/i,
  /^in charge of\b/i,
  /^tasked (with|to)\b/i,
  /^worked (on|as|in|with)\b/i,
  /^helped\b/i,
  /^involved in\b/i,
  /^assist(ed)? (in|with)\b/i,
  /^(i|my|we|was|were|did|do|have|had|has|am|is)\b/i,
  /^(a|an|the)\b/i,
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function checkVerbs(value) {
  const lines = splitLines(value);
  if (!lines.length) return null;
  const weak = lines.filter((l) => WEAK_OPENERS.some((r) => r.test(l)) || /^[a-z]+ing\b/i.test(l));
  if (!weak.length) return { level: 'ok', text: 'Every line starts with an action verb.' };
  return {
    level: 'warn',
    text: `${plural(weak.length, 'line doesn’t', 'lines don’t')} start with a strong action verb (e.g. “${weak[0].split(' ').slice(0, 3).join(' ')}…”). Try Managed, Prepared, Resolved, Led, Built.`,
  };
}

export function checkMeasurable(value) {
  const lines = splitLines(value);
  if (!lines.length) return null;
  const vague = lines.filter((l) => !/\d/.test(l));
  if (!vague.length) return { level: 'ok', text: 'Every accomplishment is measurable.' };
  return {
    level: 'warn',
    text: `${plural(vague.length, 'accomplishment has', 'accomplishments have')} no number. Add a %, ₱ amount, time saved, volume or ranking.`,
  };
}

export function countSentences(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 2).length;
}

export function checkSummary(value) {
  const n = countSentences(value);
  if (!n) return null;
  if (n >= 2 && n <= 3) return { level: 'ok', text: `${n} sentences — right on target.` };
  return { level: 'warn', text: `${plural(n, 'sentence', 'sentences')} — aim for 2–3.` };
}

export function checkZip(value) {
  const v = String(value || '').trim();
  if (!v || /^\d{4}$/.test(v)) return null;
  return { level: 'warn', text: 'Philippine ZIP codes have 4 digits.' };
}

export function checkPhone(value) {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (/^(\+?63|0)9\d{9}$/.test(digits) || /^(\+?63|0)\d{8,10}$/.test(digits)) return null;
  return { level: 'warn', text: 'Use 09XX XXX XXXX or +63 9XX XXX XXXX.' };
}

export function checkUrl(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/\s/.test(v) || !/^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}/i.test(v)) {
    return { level: 'warn', text: 'Enter a web address like linkedin.com/in/yourname or yoursite.com.' };
  }
  return null;
}

export function checkEmail(value) {
  const v = String(value || '').trim();
  if (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return null;
  return { level: 'warn', text: 'That doesn’t look like a valid email address.' };
}
