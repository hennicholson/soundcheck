/**
 * OR-5 — capture the pronunciation of names, acronyms, and internal jargon.
 *
 * The cheapest-to-fix, most expensive-to-miss item in the whole intake. A
 * singer who says "N-P-S" when the company says "nips", or reads SaaS as
 * "sass" when they say it letter by letter, costs a re-record. A form never
 * asks. The agent asks every time.
 */

import type { BangerBrief, Pronunciation } from './bangerBrief';

const COMMON_WORDS = new Set([
  'I', 'A', 'OK', 'TV', 'AM', 'PM', 'US', 'UK', 'EU', 'CEO', 'CTO', 'HR', 'IT',
]);

/**
 * Terms a songwriter will guess wrong. Surfaced to the agent as a hint list so
 * it knows when to stop and ask "how do you say that?"
 */
export function detectJargon(utterance: string): string[] {
  const found = new Set<string>();
  const text = String(utterance ?? '');

  // ALL-CAPS runs of 2-6 letters: acronyms. NPS, EHR, SOC2, KPI.
  for (const m of text.matchAll(/\b([A-Z]{2,6})(\d)?\b/g)) {
    if (!COMMON_WORDS.has(m[0])) found.add(m[0]);
  }
  // InternalCaps product names: BangerBox, SoundCheck, PayFlo.
  for (const m of text.matchAll(/\b([A-Z][a-z]+[A-Z][A-Za-z]*)\b/g)) found.add(m[0]);
  // Names with punctuation inside: Q-Bit, Flo.io, Vy'kaar.
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z]*['.-][A-Za-z]{2,})\b/g)) found.add(m[0]);

  return [...found];
}

/** Light normalisation so the same term said twice does not become two chips. */
function normalizeTerm(term: string): string {
  return String(term ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Normalise the phonetic spelling into something a singer can read aloud.
 * Deliberately not IPA — the person reading this is a songwriter under
 * deadline, not a linguist. Hyphenated syllables beat correctness.
 */
export function normalizeSaidAs(saidAs: string): string {
  return String(saidAs ?? '')
    .trim()
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Is the term spelled out letter by letter, or said as a word? */
export function isSpelledOut(saidAs: string): boolean {
  const parts = normalizeSaidAs(saidAs).split('-');
  return parts.length >= 2 && parts.every((p) => p.length === 1);
}

/**
 * Apply one `recordPronunciation` client-tool call.
 * A repeat term updates in place: the second answer is the correction.
 */
export function recordPronunciation(
  brief: BangerBrief,
  term: string,
  saidAs: string
): BangerBrief {
  const t = normalizeTerm(term);
  const s = normalizeSaidAs(saidAs);
  if (!t || !s) return brief;

  const at = brief.pronunciations.findIndex(
    (p) => p.term.toLowerCase() === t.toLowerCase()
  );
  const entry: Pronunciation = { term: t, saidAs: s };
  const next = [...brief.pronunciations];
  if (at >= 0) next[at] = entry;
  else next.push(entry);

  return { ...brief, pronunciations: next };
}

/** The line handed to whoever records the vocal. Goes into the brief export. */
export function pronunciationGuide(brief: BangerBrief): string {
  if (!brief.pronunciations.length) return 'No jargon flagged in this session.';
  return (
    brief.pronunciations
      .map(
        (p) =>
          `${p.term} is said "${p.saidAs}"${isSpelledOut(p.saidAs) ? ' (letter by letter)' : ''}`
      )
      .join('. ') + '.'
  );
}
