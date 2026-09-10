/**
 * OR-11 — the event sink, and the report that comes back out of it.
 *
 * POST records one funnel event. GET returns the funnel report: the exact
 * numbers needed to prove or disprove the revenue claim six months from now.
 */

import { NextResponse } from 'next/server';
import {
  emit,
  funnelReport,
  eventsFor,
  allEvents,
  type OutcomeEventName,
} from '@/lib/telemetry/outcomeEvents';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { name, sessionId, props } = (await req.json()) as {
    name: OutcomeEventName;
    sessionId: string;
    props?: Record<string, unknown>;
  };
  if (!name || !sessionId) {
    return NextResponse.json({ error: 'name and sessionId are required' }, { status: 400 });
  }
  return NextResponse.json({ event: emit(name, sessionId, props) });
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  const events = sessionId ? eventsFor(sessionId) : allEvents();
  return NextResponse.json({ events, report: funnelReport(events) });
}
