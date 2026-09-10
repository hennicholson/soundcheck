/**
 * MR-1 — captures, generates, and transforms audio.
 *
 * Takes a completed BangerBrief, composes a music prompt from the vibe, the
 * tone and the must-say lines, generates a track, and cuts it to a 60-second
 * scratch demo.
 *
 * The cut is not a formality. Sixty seconds is the product boundary: it is
 * enough to prove the idea works and not enough to use at an all-hands. What
 * plays after the cut is a paywall, not more music.
 *
 * Music runs on fal.ai. The model slug lives in the environment because model
 * catalogues move faster than hackathons do; changing models is a one-line env
 * change, not a code change.
 */

import type { BangerBrief } from '../brief/bangerBrief';
import { pronunciationGuide } from '../brief/pronunciationCapture';

/** The hard gate. Everything downstream reads this constant, never a literal. */
export const PREVIEW_SECONDS = 60;

export type PreviewSource = 'fal' | 'fixture';

export interface BangerPreview {
  /** playable URL — remote for a live generation, local for a fixture */
  url: string;
  source: PreviewSource;
  /** the exact prompt sent to the model, surfaced in the UI for honesty */
  promptUsed: string;
  /** length of the audio as generated, before the gate */
  generatedSeconds: number;
  /** length the listener actually gets for free */
  previewSeconds: number;
  model: string;
  /** wall-clock generation time, feeds sessionCost */
  elapsedMs: number;
}

const FAL_MODEL = process.env.FAL_MUSIC_MODEL ?? 'fal-ai/lyria3';
const FAL_QUEUE = 'https://queue.fal.run';
const FIXTURE_URL = '/fixtures/banger-preview.mp3';

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.DEMO_MODE ?? '').toLowerCase() === 'true' || !env.FAL_KEY;
}

/**
 * Compose the music prompt.
 *
 * The vibe and the tone set the music. The must-say lines set the lyric, and
 * they go in verbatim because a paraphrased must-say line is not a must-say
 * line. The pronunciation guide rides along so the vocal says the acronyms the
 * way the company says them — the whole reason OR-5 exists.
 */
export function buildMusicPrompt(brief: BangerBrief): string {
  const parts: string[] = [];

  const vibe = brief.genreReference || 'upbeat corporate anthem';
  const tone = brief.tone || 'confident and warm';
  parts.push(`${vibe}. ${tone}.`);

  if (brief.moment) parts.push(`Written for ${brief.moment}.`);
  if (brief.audience) parts.push(`Performed for ${brief.audience}.`);
  if (brief.objective) parts.push(`The song has to make people ${brief.objective}.`);

  if (brief.requiredMessages.length) {
    parts.push(`These lines must appear in the lyric, word for word: ${brief.requiredMessages.map((m) => `"${m}"`).join('; ')}.`);
  }
  if (brief.stories.length) {
    parts.push(`Work in these specifics: ${brief.stories.join('; ')}.`);
  }
  if (brief.pronunciations.length) {
    parts.push(`Pronunciation: ${pronunciationGuide(brief)}`);
  }
  if (brief.bannedWording.length) {
    parts.push(`Never say: ${brief.bannedWording.join(', ')}.`);
  }
  if (brief.constraints.length) {
    parts.push(`Constraints: ${brief.constraints.join('; ')}.`);
  }

  parts.push(`Full mix with vocals. About ${PREVIEW_SECONDS} seconds.`);
  return parts.join(' ');
}

/** Enforce the gate in data as well as in the player. */
export function cutToPreviewLength(generatedSeconds: number): number {
  return Math.min(generatedSeconds, PREVIEW_SECONDS);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * OR-13 — the offline path. Returns the pre-baked fixture after a short,
 * deliberate delay so the generating state is actually visible on screen.
 */
async function fixturePreview(brief: BangerBrief, startedAt: number): Promise<BangerPreview> {
  await sleep(Number(process.env.DEMO_GENERATION_DELAY_MS ?? 2600));
  return {
    url: FIXTURE_URL,
    source: 'fixture',
    promptUsed: buildMusicPrompt(brief),
    generatedSeconds: PREVIEW_SECONDS,
    previewSeconds: PREVIEW_SECONDS,
    model: `${FAL_MODEL} (pre-baked fixture)`,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Dig a playable audio URL out of whatever shape the model returns. */
function extractAudioUrl(payload: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (typeof value === 'string' && /^https?:\/\/.+\.(mp3|wav|m4a|ogg|flac)/i.test(value)) {
        return value;
      }
      if (typeof value === 'object') {
        const found = walk(value);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(payload);
}

/**
 * Generate the scratch demo. Falls back to the fixture on any failure, because
 * a demo that plays a pre-baked track is a demo, and a demo that plays an
 * error is not.
 */
export async function generateBangerPreview(brief: BangerBrief): Promise<BangerPreview> {
  const startedAt = Date.now();
  const prompt = buildMusicPrompt(brief);

  if (isDemoMode()) return fixturePreview(brief, startedAt);

  try {
    const submit = await fetch(`${FAL_QUEUE}/${FAL_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        duration_seconds: PREVIEW_SECONDS,
        negative_prompt: brief.bannedWording.join(', ') || undefined,
      }),
    });

    if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${await submit.text()}`);

    const queued = (await submit.json()) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
    };

    const statusUrl = queued.status_url ?? `${FAL_QUEUE}/${FAL_MODEL}/requests/${queued.request_id}/status`;
    const responseUrl = queued.response_url ?? `${FAL_QUEUE}/${FAL_MODEL}/requests/${queued.request_id}`;
    const auth = { Authorization: `Key ${process.env.FAL_KEY}` };
    const deadline = Date.now() + Number(process.env.FAL_TIMEOUT_MS ?? 120000);

    while (Date.now() < deadline) {
      await sleep(2000);
      const status = await fetch(statusUrl, { headers: auth });
      const state = (await status.json()) as { status?: string };
      if (state.status === 'COMPLETED') break;
      if (state.status === 'FAILED') throw new Error('fal reported FAILED');
    }

    const result = await fetch(responseUrl, { headers: auth });
    const payload = await result.json();
    const url = extractAudioUrl(payload);
    if (!url) throw new Error('no audio URL in fal response');

    return {
      url,
      source: 'fal',
      promptUsed: prompt,
      generatedSeconds: PREVIEW_SECONDS,
      previewSeconds: PREVIEW_SECONDS,
      model: FAL_MODEL,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (err) {
    console.error('[bangerPreview] generation failed, serving fixture:', err);
    return fixturePreview(brief, startedAt);
  }
}
