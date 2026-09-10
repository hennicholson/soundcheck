/**
 * MR-1 / MR-4 — the generation step of the primary workflow.
 *
 * Takes the finished BangerBrief, produces the sixty-second scratch demo, and
 * returns it alongside the honest cost of the session. The brief is persisted
 * through the Supabase adapter, which is deliberately a documented stub.
 */

import { NextResponse } from 'next/server';
import { generateBangerPreview, PREVIEW_SECONDS } from '@/lib/audio/bangerPreview';
import { serializeBrief, type BangerBrief } from '@/lib/brief/bangerBrief';
import { emit } from '@/lib/telemetry/outcomeEvents';
import { estimateSessionCost } from '@/lib/telemetry/sessionCost';
import { persistBrief } from '@/lib/integrations/supabasePersistence';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    brief: BangerBrief;
    sessionId: string;
    conversationSeconds?: number;
  };

  const { brief, sessionId } = body;
  if (!brief || !sessionId) {
    return NextResponse.json({ error: 'brief and sessionId are required' }, { status: 400 });
  }

  emit('generation_started', sessionId, { company: brief.company });

  const preview = await generateBangerPreview(brief);
  const record = serializeBrief(brief);
  const persistence = await persistBrief(sessionId, record, preview.url);

  emit('generation_finished', sessionId, {
    source: preview.source,
    model: preview.model,
    elapsedMs: preview.elapsedMs,
  });

  const cost = estimateSessionCost({
    conversationSeconds: body.conversationSeconds ?? 0,
    tracksGenerated: 1,
    demoMode: preview.source === 'fixture',
  });

  return NextResponse.json({
    preview,
    brief: record,
    cost,
    persistence,
    previewSeconds: PREVIEW_SECONDS,
  });
}
