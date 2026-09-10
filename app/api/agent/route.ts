/**
 * MR-2 — hands the browser what it needs to open a voice session.
 *
 * A private ElevenLabs agent needs a short-lived signed URL, which has to be
 * minted server-side so the API key never reaches the browser. A public agent
 * needs only its ID. This route covers both and tells the client which mode it
 * is in, so the page can degrade to the scripted demo session without the
 * whole flow falling over.
 */

import { NextResponse } from 'next/server';
import { MAX_EXCHANGES } from '@/lib/voice/jamSeshAgent';

export const dynamic = 'force-dynamic';

export async function GET() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const demoMode = String(process.env.DEMO_MODE ?? '').toLowerCase() === 'true';

  if (demoMode || !agentId) {
    return NextResponse.json({
      mode: 'demo',
      reason: demoMode ? 'DEMO_MODE is on' : 'no agent configured',
      maxExchanges: MAX_EXCHANGES,
    });
  }

  if (!apiKey) {
    return NextResponse.json({ mode: 'public', agentId, maxExchanges: MAX_EXCHANGES });
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey }, cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const { signed_url } = (await res.json()) as { signed_url: string };
    return NextResponse.json({
      mode: 'signed',
      agentId,
      signedUrl: signed_url,
      maxExchanges: MAX_EXCHANGES,
    });
  } catch (err) {
    console.error('[api/agent] signed URL failed, falling back to public:', err);
    return NextResponse.json({ mode: 'public', agentId, maxExchanges: MAX_EXCHANGES });
  }
}
