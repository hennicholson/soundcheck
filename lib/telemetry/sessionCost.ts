/**
 * OR-10 — estimate and report the cost of a single Sound Check session.
 *
 * This number is the argument. A Jam Sesh costs Matthew twenty minutes of his
 * own time; a Sound Check costs cents and no minutes. Reporting it honestly,
 * including the parts that are estimates, is the point.
 *
 * Rates are read from the environment so they can be corrected without a code
 * change when a vendor moves its pricing. Defaults are list prices at build
 * time and are marked as estimates in the report.
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface CostRates {
  /** ElevenLabs Conversational AI, per minute of conversation */
  voiceAgentPerMinute: number;
  /** music generation, per generated track */
  musicPerTrack: number;
  /** hosting and bandwidth amortised per session */
  hostingPerSession: number;
  /** what an hour of the founder's time is worth, for the comparison */
  founderHourlyRate: number;
}

export function ratesFromEnv(env: NodeJS.ProcessEnv = process.env): CostRates {
  return {
    voiceAgentPerMinute: num(env.COST_VOICE_PER_MINUTE, 0.12),
    // Lyria 3 Pro on fal.ai is listed at $0.08 per generated track.
    musicPerTrack: num(env.COST_MUSIC_PER_TRACK, 0.08),
    hostingPerSession: num(env.COST_HOSTING_PER_SESSION, 0.002),
    founderHourlyRate: num(env.FOUNDER_HOURLY_RATE, 250),
  };
}

export interface SessionUsage {
  /** wall-clock length of the voice conversation */
  conversationSeconds: number;
  /** how many tracks were generated, normally one */
  tracksGenerated: number;
  /** true when the session was replayed from fixtures and cost nothing */
  demoMode: boolean;
}

export interface CostLine {
  label: string;
  detail: string;
  usd: number;
}

export interface SessionCostReport {
  lines: CostLine[];
  totalUsd: number;
  /** minutes of founder time this session did NOT consume */
  founderMinutesSaved: number;
  founderCostAvoidedUsd: number;
  /** total / cost-avoided, the one-line version of the argument */
  returnMultiple: number;
  estimated: boolean;
  notes: string[];
}

/** A Jam Sesh is advertised at twenty minutes and never lands there. */
const JAM_SESH_MINUTES = 20;
/** Minutes of founder prep a completed brief removes from the call itself. */
const MINUTES_SAVED_BY_A_COMPLETED_BRIEF = 10;

export function estimateSessionCost(
  usage: SessionUsage,
  rates: CostRates = ratesFromEnv()
): SessionCostReport {
  const notes: string[] = [];
  const minutes = usage.conversationSeconds / 60;

  if (usage.demoMode) {
    notes.push(
      'DEMO_MODE was on. This session replayed fixtures and cost nothing. ' +
        'The figures below are what it would have cost live.'
    );
  }

  const lines: CostLine[] = [
    {
      label: 'Voice intake',
      detail: `${minutes.toFixed(1)} min of conversational agent`,
      usd: minutes * rates.voiceAgentPerMinute,
    },
    {
      label: 'Track generation',
      detail: `${usage.tracksGenerated} track${usage.tracksGenerated === 1 ? '' : 's'}`,
      usd: usage.tracksGenerated * rates.musicPerTrack,
    },
    {
      label: 'Hosting',
      detail: 'amortised per session',
      usd: rates.hostingPerSession,
    },
  ];

  const totalUsd = lines.reduce((sum, l) => sum + l.usd, 0);

  // A prospect who finishes a Sound Check either never takes a Jam Sesh slot
  // (they licensed the demo, or they dropped) or arrives at one already
  // briefed. Both cases give the founder time back.
  const founderMinutesSaved = MINUTES_SAVED_BY_A_COMPLETED_BRIEF;
  const founderCostAvoidedUsd = (founderMinutesSaved / 60) * rates.founderHourlyRate;

  notes.push(
    `Compared against a ${JAM_SESH_MINUTES}-minute Jam Sesh, a completed brief ` +
      `saves roughly ${founderMinutesSaved} minutes of founder time on the call.`
  );
  notes.push('Vendor rates are list prices and are estimates, not invoices.');

  return {
    lines: lines.map((l) => ({ ...l, usd: round(l.usd) })),
    totalUsd: round(totalUsd),
    founderMinutesSaved,
    founderCostAvoidedUsd: round(founderCostAvoidedUsd),
    returnMultiple: totalUsd > 0 ? round(founderCostAvoidedUsd / totalUsd) : 0,
    estimated: true,
    notes,
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** One line, for the footer of the paywall card. */
export function costHeadline(report: SessionCostReport): string {
  return `This session cost about $${report.totalUsd.toFixed(2)} to run and used zero founder minutes.`;
}
