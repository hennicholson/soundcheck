/**
 * OR-13 — the offline demo fixture.
 *
 * A real recorded Sound Check session, replayed turn by turn with the client
 * tool calls the agent actually made. With DEMO_MODE on, the whole flow runs
 * with no microphone, no API key and no network — which is what you want when
 * the venue wifi is the venue wifi.
 *
 * The company is invented. Everything else is the shape of a real intake.
 */

export type FixtureStep =
  | { at: number; kind: 'agent'; text: string }
  | { at: number; kind: 'user'; text: string }
  | { at: number; kind: 'tool'; tool: 'updateBriefField'; field: string; value: string }
  | { at: number; kind: 'tool'; tool: 'recordPronunciation'; term: string; saidAs: string }
  | { at: number; kind: 'tool'; tool: 'logProbe'; question: string }
  | { at: number; kind: 'tool'; tool: 'finalizeBrief' };

/** `at` is milliseconds from the start of the session. */
export const DEMO_SESSION: FixtureStep[] = [
  {
    at: 200,
    kind: 'agent',
    text: "Hey. I'm your sound check. Before anybody writes you a song, I need to know what we're writing it for. So — what's coming up?",
  },
  {
    at: 3400,
    kind: 'user',
    text: "We're rolling out a new expense system at Northwind Logistics. It's called PayFlo and it goes live the first week of March.",
  },
  { at: 4200, kind: 'tool', tool: 'updateBriefField', field: 'company', value: 'Northwind Logistics' },
  {
    at: 4700,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'moment',
    value: 'PayFlo expense system rollout, first week of March',
  },
  {
    at: 5400,
    kind: 'agent',
    text: "PayFlo. Before I go further — do you say PayFlo, or P-F, or something else internally?",
  },
  { at: 8200, kind: 'user', text: 'PayFlo. Pay-flo. Nobody abbreviates it.' },
  { at: 8900, kind: 'tool', tool: 'recordPronunciation', term: 'PayFlo', saidAs: 'PAY-FLO' },
  {
    at: 9600,
    kind: 'agent',
    text: 'Good. So what has to be true after people hear this song?',
  },
  {
    at: 12800,
    kind: 'user',
    text: 'We want people to be more engaged with the new process and have better alignment around it.',
  },
  {
    at: 13600,
    kind: 'agent',
    text: "That's a feeling, and I can't write a feeling. Say it worked. What does somebody do differently on Tuesday that they wouldn't have done on Monday?",
  },
  {
    at: 14100,
    kind: 'tool',
    tool: 'logProbe',
    question:
      "That's a feeling, and I can't write a feeling. Say it worked — what does somebody do differently on Tuesday that they wouldn't have done on Monday?",
  },
  {
    at: 19400,
    kind: 'user',
    text: "Honestly? They submit the receipt the same day instead of shoving it in a drawer and doing forty of them in one panic on the last day of the quarter.",
  },
  {
    at: 20200,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'objective',
    value:
      'Submit each receipt the same day, instead of hoarding forty of them until the last day of the quarter',
  },
  {
    at: 21000,
    kind: 'agent',
    text: "That I can write. Who hears it, and where are they when they do?",
  },
  {
    at: 24600,
    kind: 'user',
    text: 'About four hundred people. Mostly drivers and warehouse leads. It plays at the top of the March all-hands, and then it lives in the onboarding deck.',
  },
  {
    at: 25400,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'audience',
    value:
      '~400 drivers and warehouse leads, at the top of the March all-hands, then permanently in onboarding',
  },
  {
    at: 26200,
    kind: 'agent',
    text: "Drivers and warehouse leads. What's the story everybody there already tells about expenses? The one that comes up every time.",
  },
  {
    at: 31200,
    kind: 'user',
    text: "Marcy in Dispatch once expensed a truck tire on a personal card and waited eleven weeks to get paid back. Everyone knows the Marcy tire story. It's the reason nobody trusts the old system.",
  },
  {
    at: 32000,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'stories',
    value:
      'The Marcy tire story: Marcy in Dispatch expensed a truck tire on a personal card and waited eleven weeks for reimbursement. It is why nobody trusts the old system.',
  },
  {
    at: 32800,
    kind: 'agent',
    text: 'That is the song. Is there a line leadership always uses, and anything the song must never say?',
  },
  {
    at: 37600,
    kind: 'user',
    text: 'Leadership always says "same day, every day." And do not say "seamless." People here hate that word, and do not mention Concur by name, that was the old vendor.',
  },
  {
    at: 38400,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'requiredMessages',
    value: 'Same day, every day',
  },
  { at: 38900, kind: 'tool', tool: 'updateBriefField', field: 'bannedWording', value: 'seamless' },
  {
    at: 39300,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'bannedWording',
    value: 'Concur, or any named previous vendor',
  },
  {
    at: 40100,
    kind: 'agent',
    text: 'Last thing. What is the last song that made you turn it up in the truck?',
  },
  {
    at: 44200,
    kind: 'user',
    text: 'Something with horns. Like a Motown thing, Tower of Power maybe. Something you can clap to. Not corporate rock, please.',
  },
  {
    at: 45000,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'genreReference',
    value: 'Motown soul with a live horn section, Tower of Power energy, handclaps on the two and four',
  },
  {
    at: 45500,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'tone',
    value: 'Warm, funny, a little self-aware. Never corporate rock.',
  },
  {
    at: 46000,
    kind: 'tool',
    tool: 'updateBriefField',
    field: 'constraints',
    value: 'Under 90 seconds for the all-hands slot',
  },
  {
    at: 46800,
    kind: 'agent',
    text: "Got it. Four hundred people, horns, the Marcy tire story, same day every day, and nobody says seamless. That's enough to build on. Give me a minute.",
  },
  { at: 48400, kind: 'tool', tool: 'finalizeBrief' },
];

/** The completed brief, for anything that needs it without replaying. */
export const DEMO_BRIEF_COMPANY = 'Northwind Logistics';
