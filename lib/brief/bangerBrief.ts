/**
 * MR-3 / OR-6 — the structured, machine-readable artifact.
 *
 * Everything else in Sound Check exists to produce this object. A spoken
 * intake conversation goes in; a BangerBrief comes out, and a songwriter at
 * Business Bangerz can work from it without having been on the call.
 *
 * Field names deliberately use the vocabulary of the intake — the moment, the
 * objective, must-say lines, the vibe — not the vocabulary of a database.
 */

export interface Pronunciation {
  /** acronym, product name, or internal jargon */
  term: string;
  /** phonetic spelling, written the way the speaker actually said it */
  saidAs: string;
}

export interface BangerBrief {
  company: string;
  /** the business moment: a rollout, an offsite, an onboarding class */
  moment: string;
  /** what people should DO differently afterward */
  objective: string;
  /** who hears it, how many, in what setting */
  audience: string;
  /** must-say lines */
  requiredMessages: string[];
  /** what not to say */
  bannedWording: string[];
  /** the specific anecdotes that make it theirs */
  stories: string[];
  /** OR-5 */
  pronunciations: Pronunciation[];
  tone: string;
  /** "the vibe" — what they compared it to */
  genreReference: string;
  constraints: string[];
  /** OR-3 evidence: every vague answer the agent pushed back on */
  vagueAnswersProbed: string[];
}

/** The order the live brief card renders rows in, top to bottom. */
export const BRIEF_FIELD_ORDER: (keyof BangerBrief)[] = [
  'company',
  'moment',
  'objective',
  'audience',
  'requiredMessages',
  'stories',
  'pronunciations',
  'tone',
  'genreReference',
  'bannedWording',
  'constraints',
  'vagueAnswersProbed',
];

/** Human labels for the brief card. Sentence case, ending in a period. */
export const BRIEF_FIELD_LABELS: Record<keyof BangerBrief, string> = {
  company: 'Company.',
  moment: 'The moment.',
  objective: 'What changes Tuesday.',
  audience: 'Who hears it.',
  requiredMessages: 'Must-say lines.',
  stories: 'Their stories.',
  pronunciations: 'Say it like this.',
  tone: 'Tone.',
  genreReference: 'The vibe.',
  bannedWording: 'Never say.',
  constraints: 'Constraints.',
  vagueAnswersProbed: 'Probed.',
};

/** Fields the agent must fill before the brief counts as complete. */
export const REQUIRED_FIELDS: (keyof BangerBrief)[] = [
  'company',
  'moment',
  'objective',
  'audience',
  'genreReference',
];

export function emptyBrief(): BangerBrief {
  return {
    company: '',
    moment: '',
    objective: '',
    audience: '',
    requiredMessages: [],
    bannedWording: [],
    stories: [],
    pronunciations: [],
    tone: '',
    genreReference: '',
    constraints: [],
    vagueAnswersProbed: [],
  };
}

const LIST_FIELDS = new Set<string>([
  'requiredMessages',
  'bannedWording',
  'stories',
  'constraints',
  'vagueAnswersProbed',
]);

export function isListField(field: keyof BangerBrief): boolean {
  return LIST_FIELDS.has(field as string);
}

/**
 * Apply one `updateBriefField` client-tool call from the voice agent.
 * List fields append and de-duplicate. Scalar fields overwrite, because a
 * later answer in the same conversation is a correction, not a second value.
 */
export function updateBriefField(
  brief: BangerBrief,
  field: string,
  value: string
): BangerBrief {
  const key = field as keyof BangerBrief;
  if (!(key in brief)) return brief;
  if (key === 'pronunciations') return brief; // owned by pronunciationCapture

  const clean = String(value ?? '').trim();
  if (!clean) return brief;

  const next: BangerBrief = { ...brief };
  if (isListField(key)) {
    const list = [...(next[key] as string[])];
    if (!list.some((v) => v.toLowerCase() === clean.toLowerCase())) list.push(clean);
    (next[key] as string[]) = list;
  } else {
    (next[key] as string) = clean;
  }
  return next;
}

/** How full the brief is, 0..1 — drives the progress meter on screen. */
export function briefCompleteness(brief: BangerBrief): number {
  const filled = REQUIRED_FIELDS.filter((f) => String(brief[f]).trim().length > 0);
  return filled.length / REQUIRED_FIELDS.length;
}

export function missingFields(brief: BangerBrief): (keyof BangerBrief)[] {
  return REQUIRED_FIELDS.filter((f) => !String(brief[f]).trim());
}

export function isBriefComplete(brief: BangerBrief): boolean {
  return missingFields(brief).length === 0;
}

/** Stable, machine-readable export. This is what gets handed to the Jam Sesh. */
export function serializeBrief(brief: BangerBrief) {
  return {
    schema: 'bangerbrief/v1',
    generatedAt: new Date().toISOString(),
    brief,
    completeness: briefCompleteness(brief),
    probeCount: brief.vagueAnswersProbed.length,
    pronunciationCount: brief.pronunciations.length,
  };
}
