/**
 * Pre-bakes the demo fixture: replays the recorded session through the real
 * brief-assembly code, sends the resulting prompt to Lyria 3 Pro on fal.ai,
 * and saves the track to public/fixtures/banger-preview.mp3.
 *
 *   npm run prebake
 *
 * This is what DEMO_MODE serves. Running it through the same buildMusicPrompt
 * the live path uses means the pre-baked track is the track the live path
 * would have produced, not a stand-in.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { emptyBrief, updateBriefField, serializeBrief } from '../lib/brief/bangerBrief';
import { recordPronunciation } from '../lib/brief/pronunciationCapture';
import { logProbe } from '../lib/voice/probeVagueAnswer';
import { buildMusicPrompt } from '../lib/audio/bangerPreview';
import { DEMO_SESSION } from '../fixtures/demoSession';

const OUT_DIR = 'public/fixtures';
const OUT_AUDIO = `${OUT_DIR}/banger-preview.mp3`;
const OUT_BRIEF = 'fixtures/demoBrief.json';

function loadEnv() {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

/** Replay the fixture through the real reducers. */
function buildDemoBrief() {
  let brief = emptyBrief();
  for (const step of DEMO_SESSION) {
    if (step.kind !== 'tool') continue;
    if (step.tool === 'updateBriefField') brief = updateBriefField(brief, step.field, step.value);
    if (step.tool === 'recordPronunciation') brief = recordPronunciation(brief, step.term, step.saidAs);
    if (step.tool === 'logProbe') brief = logProbe(brief, step.question);
  }
  return brief;
}

async function main() {
  loadEnv();
  const brief = buildDemoBrief();
  const prompt = buildMusicPrompt(brief);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_BRIEF, JSON.stringify(serializeBrief(brief), null, 2));
  console.log(`Wrote ${OUT_BRIEF}`);
  console.log(`\nPrompt (${prompt.length} chars):\n${prompt}\n`);

  const key = process.env.FAL_KEY;
  if (!key) {
    console.error('FAL_KEY is not set. Brief written, audio skipped.');
    process.exit(1);
  }

  const model = process.env.FAL_MUSIC_MODEL ?? 'fal-ai/lyria3/pro';
  console.log(`Generating with ${model}. This takes a minute.`);
  const started = Date.now();

  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    console.error(`fal ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = (await res.json()) as { audio?: unknown; lyrics?: string };
  const audioUrl =
    typeof data.audio === 'string'
      ? data.audio
      : (data.audio as { url?: string } | undefined)?.url;

  if (!audioUrl) {
    console.error(`No audio URL in response: ${JSON.stringify(data).slice(0, 400)}`);
    process.exit(1);
  }

  const audio = Buffer.from(await (await fetch(audioUrl)).arrayBuffer());
  writeFileSync(OUT_AUDIO, audio);

  console.log(
    `\nSaved ${OUT_AUDIO} — ${(audio.length / 1024).toFixed(0)} KB in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  if (data.lyrics) {
    writeFileSync(`${OUT_DIR}/banger-preview.lyrics.txt`, data.lyrics);
    console.log('Saved the returned lyrics alongside it.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
