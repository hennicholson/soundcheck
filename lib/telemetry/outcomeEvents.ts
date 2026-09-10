/**
 * OR-11 — log the events needed to measure the outcome.
 *
 * The outcome is Revenue. The revenue claim is "sessions that would have been
 * worth zero become either a licensed demo or a qualified Jam Sesh." That
 * claim is only provable if the whole funnel is instrumented, so it is:
 *
 *   session_started -> brief_completed -> preview_played -> paywall_hit
 *                   -> licensed | jam_sesh_booked
 *
 * Two derived numbers fall straight out of this stream and both are the
 * numbers Business Bangerz would actually put on a dashboard:
 *   - qualified-Jam-Sesh rate: jam_sesh_booked / session_started
 *   - demo licence rate:       licensed / paywall_hit
 */

export type OutcomeEventName =
  | 'session_started'
  | 'consent_granted'
  | 'consent_declined'
  | 'probe_fired'
  | 'pronunciation_captured'
  | 'brief_completed'
  | 'generation_started'
  | 'generation_finished'
  | 'preview_played'
  | 'paywall_hit'
  | 'licensed'
  | 'jam_sesh_booked'
  | 'session_abandoned';

/** The happy path, in order. Used to compute funnel drop-off. */
export const FUNNEL: OutcomeEventName[] = [
  'session_started',
  'brief_completed',
  'preview_played',
  'paywall_hit',
];

/** The two ways a session can be worth money. */
export const TERMINAL_WINS: OutcomeEventName[] = ['licensed', 'jam_sesh_booked'];

export interface OutcomeEvent {
  name: OutcomeEventName;
  sessionId: string;
  at: string;
  /** ms since session_started — how long the intake actually takes */
  elapsedMs: number;
  props?: Record<string, unknown>;
}

const log: OutcomeEvent[] = [];
const sessionStart = new Map<string, number>();

export function emit(
  name: OutcomeEventName,
  sessionId: string,
  props?: Record<string, unknown>
): OutcomeEvent {
  const now = Date.now();
  if (name === 'session_started') sessionStart.set(sessionId, now);
  const started = sessionStart.get(sessionId) ?? now;

  const event: OutcomeEvent = {
    name,
    sessionId,
    at: new Date(now).toISOString(),
    elapsedMs: now - started,
    ...(props ? { props } : {}),
  };
  log.push(event);

  // Structured line so this is greppable in a real log drain on day one.
  if (typeof console !== 'undefined') {
    console.log(`[outcome] ${JSON.stringify(event)}`);
  }
  return event;
}

export function eventsFor(sessionId: string): OutcomeEvent[] {
  return log.filter((e) => e.sessionId === sessionId);
}

export function allEvents(): OutcomeEvent[] {
  return [...log];
}

export function reset(): void {
  log.length = 0;
  sessionStart.clear();
}

export interface FunnelReport {
  counts: Record<string, number>;
  /** step -> share of sessions that reached it */
  conversion: Record<string, number>;
  qualifiedJamSeshRate: number;
  demoLicenceRate: number;
  sessions: number;
}

/** The report a founder would actually look at. */
export function funnelReport(events: OutcomeEvent[] = log): FunnelReport {
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.name] = (counts[e.name] ?? 0) + 1;

  const sessions = counts.session_started ?? 0;
  const conversion: Record<string, number> = {};
  for (const step of [...FUNNEL, ...TERMINAL_WINS]) {
    conversion[step] = sessions ? (counts[step] ?? 0) / sessions : 0;
  }

  const paywall = counts.paywall_hit ?? 0;
  return {
    counts,
    conversion,
    qualifiedJamSeshRate: sessions ? (counts.jam_sesh_booked ?? 0) / sessions : 0,
    demoLicenceRate: paywall ? (counts.licensed ?? 0) / paywall : 0,
    sessions,
  };
}
