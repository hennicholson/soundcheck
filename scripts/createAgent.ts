/**
 * Creates (or updates) the Sound Check agent on ElevenLabs from the single
 * definition in lib/voice/jamSeshAgent.ts.
 *
 *   npm run agent:create
 *
 * The prompt and the four client tools live in one place and are pushed from
 * there, so the agent the browser talks to and the agent described in this
 * repo can never drift apart.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { agentDefinition, CLIENT_TOOLS } from '../lib/voice/jamSeshAgent';

const API = 'https://api.elevenlabs.io/v1/convai/agents/create';
const ENV_FILE = '.env.local';

function loadEnv() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  loadEnv();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error('ELEVENLABS_API_KEY is not set. Copy .env.example to .env.local first.');
    process.exit(1);
  }

  const body = agentDefinition('Sound Check');
  console.log(`Creating agent "Sound Check" with ${CLIENT_TOOLS.length} client tools:`);
  for (const t of CLIENT_TOOLS) console.log(`  - ${t.name}`);

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`\nElevenLabs returned ${res.status}:\n${text}`);
    process.exit(1);
  }

  const { agent_id } = JSON.parse(text) as { agent_id: string };
  console.log(`\nAgent created: ${agent_id}`);

  // Write it straight back into .env.local so the app picks it up on reload.
  if (existsSync(ENV_FILE)) {
    const current = readFileSync(ENV_FILE, 'utf8');
    const next = current.includes('NEXT_PUBLIC_ELEVENLABS_AGENT_ID=')
      ? current.replace(
          /NEXT_PUBLIC_ELEVENLABS_AGENT_ID=.*/,
          `NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${agent_id}`
        )
      : `${current}\nNEXT_PUBLIC_ELEVENLABS_AGENT_ID=${agent_id}\n`;
    writeFileSync(ENV_FILE, next);
    console.log(`Wrote NEXT_PUBLIC_ELEVENLABS_AGENT_ID into ${ENV_FILE}.`);
  }

  console.log('\nSet the same value in Netlify, then restart the dev server.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
