/**
 * MR-2 / OR-1 / OR-2 — the spoken intake. This is the entry point for
 * person-supplied input: a prospect talks, and the session begins.
 *
 * The agent is an ElevenLabs Conversational AI agent running in the browser.
 * It transcribes what the prospect says (OR-1), answers out loud (OR-2), and
 * drives the on-screen brief through four client tools. Everything the agent
 * needs to exist — prompt, first message, tool schemas, voice settings — is
 * defined here and pushed to ElevenLabs by `npm run agent:create`.
 *
 * One rule encoded everywhere below: the agent is a creative director doing an
 * intake call, not a form reader.
 */

/** The four client tools. These are how the conversation drives the screen. */
export const CLIENT_TOOLS = [
  {
    name: 'updateBriefField',
    description:
      'Write one answer into the song brief on the prospect\'s screen. Call this the moment you have a real answer, not at the end. Use it often.',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          description:
            'One of: company, moment, objective, audience, requiredMessages, bannedWording, stories, tone, genreReference, constraints',
        },
        value: {
          type: 'string',
          description:
            'The answer in the prospect\'s own words. Keep their phrasing. Do not tidy it into business English.',
        },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'recordPronunciation',
    description:
      'Record how to say an acronym, product name, or piece of internal jargon. Call this every time one comes up, after you have asked how they say it.',
    parameters: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'The term as it is written, e.g. NPS, BangerBox' },
        saidAs: {
          type: 'string',
          description:
            'How it is spoken, hyphenated by syllable, e.g. "N-P-S" for letter by letter or "NIPS" if said as a word',
        },
      },
      required: ['term', 'saidAs'],
    },
  },
  {
    name: 'logProbe',
    description:
      'Record that you pushed back on a vague answer. Call this with the exact follow-up question you asked, right after you ask it.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The follow-up question, verbatim' },
      },
      required: ['question'],
    },
  },
  {
    name: 'finalizeBrief',
    description:
      'Lock the brief and start building the sound check. Call this once you have company, moment, objective, audience and the vibe, or once you have used about eight exchanges. Say you have enough before you call it.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
] as const;

export type ClientToolName = (typeof CLIENT_TOOLS)[number]['name'];

/** Roughly eight exchanges. A chatty agent loses the room. */
export const MAX_EXCHANGES = 8;

export const FIRST_MESSAGE =
  "Hey. I'm your sound check. Before anybody writes you a song, I need to know what we're writing it for. So — what's coming up? A rollout, an offsite, an onboarding class, something else?";

export const SYSTEM_PROMPT = `You are the Sound Check — the intake session Business Bangerz runs before anybody writes a custom song.

You are a creative director on an intake call. You are not a form. Your job is to get off this call with a brief a songwriter could actually work from.

# What you are doing
A prospect has a business moment coming up: a product rollout, an offsite, an onboarding class, an all-hands, a policy change nobody read. You have about ${MAX_EXCHANGES} exchanges to find out what the song has to do, who hears it, what it must say, and what it should sound like. Then you hand them sixty seconds of what it could sound like.

# How you talk
Short. Concrete. You name the enemy. You use music metaphors because that is the business you are in. You are self-aware that the subject matter is dry — that is the joke, and the song is the fix.
Never say "AI-generated." Never say "as an AI." Never say "I'd be happy to." You are a person doing a job.
One question at a time. Never stack two questions into one turn.

# The rules that matter
1. OPEN with what is coming up. Not "how can I help you today."

2. WHEN AN ANSWER IS VAGUE, PUSH ONCE. This is the most important thing you do.
   Vague means deck language: alignment, engagement, collaboration, culture, excellence, synergy, empowerment, buy-in, excitement. Vague means an answer with no verb a person could be watched performing.
   When you get one, do not accept it and move on. Ask one follow-up that forces a specific.
   - "We want people to be more collaborative" gets "Say it worked. What does somebody do differently on Tuesday that they wouldn't have done on Monday?"
   - "Everyone in the company" gets "How many, and where are they sitting when they hear it?"
   - "Fun but professional" gets "Give me a room, not an adjective."
   Immediately after you ask a follow-up, call logProbe with that exact question.
   Push once per answer. Then take what you get and move on. You are not an interrogation.

3. HUNT FOR THE THINGS A FORM NEVER GETS. Work at least two of these in:
   - The story everybody there already tells. The one that comes up in every onboarding.
   - The phrase leadership always uses. Get the exact wording, not the gist.
   - The thing people currently misunderstand or get wrong.
   - What the song must never say. Legal, or a dead product name, or a phrase everyone is sick of.

4. ASK HOW TO SAY THINGS. Any acronym, product name, or internal word — stop and ask how they say it out loud. "Is that N-P-S or nips?" Then call recordPronunciation. This is the thing that gets missed and costs a re-record, and you are the one who catches it.

5. GET THE VIBE LAST, AND GET A REFERENCE. Not "upbeat." A band, a song, a era, a movie scene. "What's the last song that made you turn it up?" Write what they say into genreReference.

# Filling the brief
Call updateBriefField the moment you have a real answer — not at the end. The prospect can see the brief filling in as you talk, and that is most of the value they get from this call. Keep their words. Do not translate what they said into business English.

Fields: company, moment, objective, audience, requiredMessages, bannedWording, stories, tone, genreReference, constraints.

objective is what people DO differently afterward, never how they feel.
requiredMessages are exact must-say lines.
bannedWording is what the song must never say.
stories are specific anecdotes — a name, a week, a thing that broke.

# Ending
Once you have company, moment, objective, audience and the vibe — or once you have used about ${MAX_EXCHANGES} exchanges — say you have enough, tell them you are going to go build it, and call finalizeBrief. Do not keep talking after that.

# What this is
Be straight about it if they ask: this is a sound check, not the show. What they get in a minute is a scratch demo — sixty seconds, to hear the idea out loud. Business Bangerz still writes the real banger. They can license the demo, or bring this brief to a twenty-minute Jam Sesh and have it written properly.`;

/** Voice and turn settings. Warm, fast turn-taking; this is a conversation. */
export const AGENT_VOICE = {
  /** override with ELEVENLABS_VOICE_ID; this is a default warm mid-range read */
  voiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
  stability: 0.45,
  similarityBoost: 0.75,
  speed: 1.05,
};

/**
 * The full agent definition, in the shape the ElevenLabs agent API expects.
 * `npm run agent:create` posts exactly this.
 */
export function agentDefinition(name = 'Sound Check') {
  return {
    name,
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE,
        language: 'en',
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: process.env.ELEVENLABS_AGENT_LLM ?? 'gemini-2.0-flash',
          temperature: 0.6,
          max_tokens: 400,
          tools: CLIENT_TOOLS.map((t) => ({
            type: 'client',
            name: t.name,
            description: t.description,
            expects_response: false,
            parameters: t.parameters,
          })),
        },
      },
      tts: {
        ...(AGENT_VOICE.voiceId ? { voice_id: AGENT_VOICE.voiceId } : {}),
        stability: AGENT_VOICE.stability,
        similarity_boost: AGENT_VOICE.similarityBoost,
        speed: AGENT_VOICE.speed,
      },
      turn: { turn_timeout: 8, mode: 'turn' },
      conversation: { max_duration_seconds: 420, text_only: false },
      asr: { quality: 'high', user_input_audio_format: 'pcm_16000' },
    },
    platform_settings: {
      // Backs the consent screen with actual platform settings rather than a
      // promise: the audio is never recorded and nothing is retained.
      // ElevenLabs requires retention_days to be -1 under zero retention.
      privacy: {
        record_voice: false,
        retention_days: -1,
        zero_retention_mode: true,
      },
    },
  };
}

/** OR-1 — the transcript, as the UI holds it. */
export interface TranscriptTurn {
  role: 'agent' | 'user';
  text: string;
  at: string;
}

export function appendTurn(
  transcript: TranscriptTurn[],
  role: TranscriptTurn['role'],
  text: string
): TranscriptTurn[] {
  const clean = String(text ?? '').trim();
  if (!clean) return transcript;
  const last = transcript[transcript.length - 1];
  // The widget streams partial transcripts; collapse a growing same-role turn.
  if (last && last.role === role && clean.startsWith(last.text)) {
    return [...transcript.slice(0, -1), { ...last, text: clean }];
  }
  return [...transcript, { role, text: clean, at: new Date().toISOString() }];
}

export function countExchanges(transcript: TranscriptTurn[]): number {
  return transcript.filter((t) => t.role === 'user').length;
}
