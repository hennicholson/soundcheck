/**
 * OR-3 — multi-turn follow-up on vague answers.
 *
 * This is the whole reason Sound Check beats a form, so it gets its own module.
 * Friction F1 says the real objective stays buried in deck language. Deck
 * language is detectable: it is abstract, it has no verb a person can perform,
 * and it names a value rather than a behaviour.
 *
 * "We want people to be more collaborative" is not an objective. It is a mood.
 * The probe turns it into "what does someone do differently on Tuesday?"
 */

import type { BangerBrief } from '../brief/bangerBrief';

/** Deck words: abstractions that sound like an answer and are not one. */
const DECK_LANGUAGE = [
  'synergy', 'synergies', 'alignment', 'aligned', 'collaborative', 'collaboration',
  'innovative', 'innovation', 'empower', 'empowered', 'empowerment', 'engagement',
  'engaged', 'culture', 'excellence', 'best-in-class', 'world-class', 'leverage',
  'transformation', 'transformative', 'holistic', 'strategic', 'mindset',
  'stakeholder', 'awareness', 'visibility', 'efficiency', 'productivity',
  'excited', 'exciting', 'passionate', 'seamless', 'robust', 'streamline',
  'streamlined', 'optimize', 'optimise', 'unlock', 'journey', 'ecosystem',
  'paradigm', 'north star', 'move the needle', 'circle back', 'buy-in',
];

/** Verbs a person can actually be observed doing on a Tuesday. */
const CONCRETE_VERBS = [
  'click', 'log', 'file', 'submit', 'call', 'email', 'send', 'ship', 'sign',
  'scan', 'check', 'open', 'close', 'book', 'report', 'switch', 'use', 'stop',
  'start', 'ask', 'answer', 'update', 'upload', 'download', 'attend', 'read',
  'write', 'record', 'approve', 'reject', 'order', 'reorder', 'badge', 'swipe',
];

export interface ProbeVerdict {
  /** true when the answer needs one follow-up before the agent moves on */
  isVague: boolean;
  /** why, in plain words — shown as the small visual tell on the brief card */
  reason: string;
  /** the follow-up question the agent should ask, verbatim */
  followUp: string;
  /** 0..1, higher means vaguer. Used only for ordering, never shown. */
  score: number;
}

/** Fields where an abstract answer actually costs the songwriter something. */
const PROBEABLE_FIELDS = new Set([
  'objective', 'audience', 'moment', 'tone', 'requiredMessages', 'stories',
]);

export function isProbeableField(field: string): boolean {
  return PROBEABLE_FIELDS.has(field);
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

function hasConcreteVerb(answer: string): boolean {
  const w = words(answer);
  return w.some((t) => CONCRETE_VERBS.includes(t.replace(/(s|ed|ing)$/, '')));
}

function deckHits(answer: string): string[] {
  const lower = answer.toLowerCase();
  const w = words(answer);
  return DECK_LANGUAGE.filter((d) => (d.includes(' ') ? lower.includes(d) : w.includes(d)));
}

function hasSpecifics(answer: string): boolean {
  // A number, a proper noun, or a date is evidence the answer is about
  // something real rather than about a category of thing.
  return /\d/.test(answer) || /\b[A-Z][a-z]{2,}/.test(answer.slice(1));
}

/** Follow-ups, in the brand's register: short, concrete, names the enemy. */
const FOLLOW_UPS: Record<string, string[]> = {
  objective: [
    'Say someone walks out of that room and it worked. What do they do differently on Tuesday that they would not have done on Monday?',
    'What is the one behaviour that changes? Not the feeling. The thing you could watch someone do.',
  ],
  audience: [
    'How many people, and where are they sitting when they hear it? A hundred in a ballroom is a different song than nine on a video call.',
    'Who in that room is the hardest sell? We write it for that person.',
  ],
  moment: [
    'Walk me through the run of show. What happens right before this plays, and what happens right after?',
    'Is this the thing that opens the day or the thing that sends them home? Those are opposite songs.',
  ],
  tone: [
    'Give me a room, not an adjective. Is this a Monday all-hands with coffee, or is this the after-party?',
    'Who in the company would hate it if this were too slick? What would they say?',
  ],
  requiredMessages: [
    'Is that the exact wording leadership uses, or the gist? I need the exact wording, because that is the line people repeat.',
    'If legal reads the lyric sheet, which line are they checking for?',
  ],
  stories: [
    'What is the story everybody there already tells about this? The one that comes up in every onboarding.',
    'Give me the specific one. A name, a week, a thing that went wrong and got fixed.',
  ],
  default: [
    'Give me the specific version of that. What actually happened, and to whom?',
  ],
};

let followUpCursor = 0;

function pickFollowUp(field: string): string {
  const bank = FOLLOW_UPS[field] ?? FOLLOW_UPS.default;
  const pick = bank[followUpCursor % bank.length];
  followUpCursor += 1;
  return pick;
}

/**
 * The judgement call. Returns whether the agent should push back once.
 * Deliberately conservative: probing twice on the same field makes the agent
 * feel like an interrogation, and the session has an 8-exchange budget.
 */
export function probeVagueAnswer(field: string, answer: string): ProbeVerdict {
  const text = String(answer ?? '').trim();
  const ok = (): ProbeVerdict => ({ isVague: false, reason: '', followUp: '', score: 0 });

  if (!isProbeableField(field)) return ok();
  if (!text) return ok();

  const hits = deckHits(text);
  const w = words(text);
  let score = 0;
  const reasons: string[] = [];

  if (hits.length) {
    score += Math.min(0.5, hits.length * 0.25);
    reasons.push(`deck language: ${hits.slice(0, 3).join(', ')}`);
  }
  if (w.length < 6) {
    score += 0.3;
    reasons.push('too short to write from');
  }
  if ((field === 'objective' || field === 'stories') && !hasConcreteVerb(text)) {
    score += 0.3;
    reasons.push('no behaviour a person could be watched doing');
  }
  if ((field === 'audience' || field === 'stories') && !hasSpecifics(text)) {
    score += 0.25;
    reasons.push('no number, name, or date');
  }

  if (score < 0.4) return ok();

  return {
    isVague: true,
    reason: reasons.join('; '),
    followUp: pickFollowUp(field),
    score: Math.min(1, score),
  };
}

/**
 * Apply one `logProbe` client-tool call. The probe question itself is what
 * gets stored — it is the evidence, on screen, that the agent pushed back.
 */
export function logProbe(brief: BangerBrief, question: string): BangerBrief {
  const clean = String(question ?? '').trim();
  if (!clean) return brief;
  if (brief.vagueAnswersProbed.some((q) => q.toLowerCase() === clean.toLowerCase())) {
    return brief;
  }
  return { ...brief, vagueAnswersProbed: [...brief.vagueAnswersProbed, clean] };
}
