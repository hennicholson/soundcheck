# Sound Check

## 1. What this is

Sound Check is an agent-run intake session for Business Bangerz. A prospect
talks to it for about two minutes about a business moment they have coming up,
and it hands back a structured song brief plus sixty seconds of what their
banger could sound like.

The generated track is not the product. It is a scratch demo, and it ends in
one of two places: a paid licence for the demo, or a booked Jam Sesh with a
completed brief already attached. Business Bangerz still writes the real
banger.

---

## 2. The outcome it targets

**Outcome: Revenue. Friction: F1, intake quality**, with a secondary effect on
F6, no reusable memory.

The funnel today is: free weekly song, email capture, gated Jukebox, free
20-minute Jam Sesh, custom project. The Jam Sesh is the bottleneck. It costs
the founder his own hours, most of the people on it were never going to buy,
and per F1 the ones who were describe what they want in deck language, so the
real objective stays buried until it is expensive to fix.

Sound Check inserts an agent-run intake ahead of that call. It does three
things a form does not.

**It qualifies before it costs founder time.** Every prospect who finishes a
session arrives at the Jam Sesh with a completed brief. Matthew starts the call
at minute ten instead of minute zero.

**It monetises the people who would never have booked.** A prospect who wants a
track but not a consultation is currently worth zero. Now they are a licensed
demo sale, a new billable line item at zero marginal founder hours.

**It converts better, because they already heard it.** Somebody who has heard
sixty seconds of their own message as a song books at a different rate than
somebody who read a use-case card.

All three run unattended. Nobody has to hire an ops team to operate this.

The brief it produces is also the answer to F6. Today the specifics of a
project live in one call and one person's memory. A BangerBrief is a row, and
the next song for the same company starts from it.

---

## 3. What actually works

Written before the demo script, and it is the same list.

**Real.**

- Voice intake. A live ElevenLabs conversational agent, transcribing speech and
  answering out loud, driving the on-screen brief through four client tools.
- Brief assembly. Answers land in a typed `BangerBrief` as the conversation
  happens, field by field, visible on screen.
- Probe logic. Vague answers get one follow-up before the agent moves on, and
  every probe is logged and shown.
- Pronunciation capture. Acronyms, product names and internal jargon get a
  phonetic spelling attached.
- The sixty-second gate. The player hard-stops at sixty seconds and swaps to
  the paywall.
- Telemetry. The full funnel is logged, and a per-session cost estimate is
  reported on screen.
- Whop checkout, in test mode, and here is exactly what that means. The paid
  door is built: the licence copy, the price, the embedded-checkout mount and a
  hosted-checkout link are all wired to `NEXT_PUBLIC_WHOP_PLAN_ID`. That
  variable is intentionally left empty, so pressing *License it* reveals a
  test-mode note instead of a live checkout. No card is ever charged and no
  payment is captured. Setting a real plan ID is the only change needed.
- Music generation. Lyria 3 Pro on fal.ai, called with a prompt composed from
  the brief. This runs live and has been run live.

**Pre-baked.** The track played in the demo was generated during the build by
the same code path, and is served from `public/fixtures/`. `PREBAKED_TRACK=true`
does this while leaving the live voice agent running. Generation takes about
forty seconds and a demo cannot afford to stare at a spinner.

**Stubbed.** Supabase persistence. The schema is written out in
`lib/integrations/supabasePersistence.ts` and in section 4 below, and every
write that would happen is logged and returned to the UI. Nothing is written to
a database.

---

## 4. How it works

A prospect lands on the page and is told, before anything listens, what is
recorded, what it is used for, how long it is kept, and how to withdraw. The
agent runs with recording off and zero retention, so that screen describes the
actual platform settings rather than a promise.

They press start and the agent opens by asking what is coming up. Not "how can
I help you today" — a rollout, an offsite, an onboarding class.

As they answer, the agent writes into the brief on screen. The prospect watches
their own words become structure, which is most of the value they get from the
call before they hear a note.

**When an answer is vague, the agent pushes once.** This is the part a form
cannot do. "We want people to be more engaged" is a mood, not an objective, so
the agent asks what somebody does differently on Tuesday that they would not
have done on Monday. The follow-up is logged and shown on the brief card, so
the pushback is visible rather than claimed.

It hunts for the things that never survive a form: the story everybody at the
company already tells, the exact phrase leadership always uses, the thing the
song must never say. And it asks how to *say* the acronyms and product names,
writing them down phonetically, because a singer who says "N-P-S" when the
company says "nips" costs a re-record.

After about eight exchanges it says it has enough and locks the brief. The
conversation ends there; nothing keeps listening.

The brief becomes a music prompt. The vibe and the tone set the music, the
must-say lines go in word for word because a paraphrased must-say line is not a
must-say line, and the pronunciation guide rides along. That prompt goes to
Lyria 3 Pro and comes back a track.

The track plays. At sixty seconds it stops dead. Not a fade, not a polite
question. The abrupt cut is the point, and it mirrors the members wall already
running on the Jukebox.

Then two doors, given equal weight. **License this demo** opens Whop checkout
and sells the full-length file with an internal-use licence. **Book the Jam
Sesh** hands the brief off and links to the scheduler. Underneath both is the
honest cost of the session and the number that matters: zero founder minutes.

Every transition fires an event: `session_started`, `brief_completed`,
`preview_played`, `paywall_hit`, then `licensed` or `jam_sesh_booked`. That is
the exact instrumentation needed to prove or disprove the revenue claim six
months from now.

### The artifact

```ts
interface BangerBrief {
  company: string;
  moment: string;                   // rollout, offsite, onboarding
  objective: string;                // what people DO differently afterward
  audience: string;                 // who hears it, how many, in what setting
  requiredMessages: string[];       // must-say lines
  bannedWording: string[];          // what not to say
  stories: string[];                // the anecdotes that make it theirs
  pronunciations: { term: string; saidAs: string }[];
  tone: string;
  genreReference: string;           // the vibe, what they compared it to
  constraints: string[];
  vagueAnswersProbed: string[];     // evidence the agent pushed back
}
```

### Integration realism

Business Bangerz already runs Supabase. Their song thumbnails and song videos
live in the `song-thumbnails` and `song-videos` buckets, and the gated Jukebox
reads from Postgres behind auth. Sound Check does not need a new datastore. It
needs three tables and one bucket in the one they have.

| Table | What it holds |
|---|---|
| `sound_check_sessions` | One row per intake. Company, duration, exchanges, estimated cost, outcome. The funnel is measured off this. |
| `banger_briefs` | The artifact as `jsonb`, with completeness, probe count and pronunciation count. This is the row a songwriter opens instead of reading a transcript. |
| `sound_check_events` | The event stream. Append-only. Feeds the revenue dashboard directly. |

Plus one bucket, `sound-check-demos`, alongside the two they already run,
private and served through a signed URL that expires with the session.

**Adoption effort: about half a day** for one engineer already inside their
Supabase project. Roughly an hour for the migration, an hour to replace the
stub in `supabasePersistence.ts` with the Supabase client, two hours for
row-level security policies matching their existing Jukebox auth, and two hours
to pass the brief through to the Jam Sesh booking. Risk is low: nothing here
touches an existing table and the event stream is append-only.

---

## 5. Setup

Node 20 or newer.

```bash
npm install
cp .env.example .env.local
```

**Nothing needs a paid key to run.** With `DEMO_MODE=true`, the whole flow
replays a recorded session and serves the pre-baked track with no microphone,
no API keys and no network. Start there.

To run it live, fill in three keys in `.env.local`:

| Variable | What it is for |
|---|---|
| `ELEVENLABS_API_KEY` | The voice intake. Paid. |
| `FAL_KEY` | Music generation on Lyria 3 Pro. Paid, about $0.08 a track. |
| `NEXT_PUBLIC_WHOP_PLAN_ID` | The embedded checkout. Test mode, no real charge. |

Then create the agent. Prompt, voice settings and all four client tools live in
`lib/voice/jamSeshAgent.ts` and are pushed from there, so the agent the browser
talks to cannot drift from the one described in this repo:

```bash
npm run agent:create   # writes NEXT_PUBLIC_ELEVENLABS_AGENT_ID back into .env.local
```

`.env.example` lists every variable the app reads, including the two switches
that matter for a demo: `DEMO_MODE` (fully offline) and `PREBAKED_TRACK` (live
voice, pre-baked audio).

---

## 6. The primary path

```bash
npm run soundcheck
```

Then open **http://localhost:3000/soundcheck** and press *Start your sound
check*. That is the whole thing: one route, one page, one path from talking to
paywall.

`npm run prebake` regenerates the demo fixture — it replays the recorded
session through the real brief-assembly code, sends the resulting prompt to
Lyria 3 Pro, and saves the track. The pre-baked track is therefore the track
the live path would have produced, not a stand-in.

A two-minute walkthrough of what the tool does lives at `/demo`.

---

## 7. What we did not build, and why

The RFP names breadth as the most reliable way to lose, so this is one path
built end to end and nothing else. Cut on purpose:

- **Accounts, login, session persistence.** A sound check is a single sitting.
  Auth would have cost an hour and changed nothing about whether the idea works.
- **Any Jukebox, catalog or library feature.** They have one. This is not that.
- **Multi-track generation, regeneration, revision loops.** Being able to
  re-roll the track undercuts the entire positioning. The scratch demo is meant
  to send you to a person, not to be iterated into a finished song.
- **Real Supabase writes.** The schema is the valuable part and it is written
  out above. Wiring the client would have proved nothing and risked the demo.
- **Real payment capture.** Whop is in test mode and says so on the card.
- **Employee voice capture, cloning, hum-to-search, recall testing.** All
  interesting, none of them on this path.
- **Mobile beyond "works."** The layout collapses to one column and the brief
  stays readable on a phone. It was not designed phone-first.

---

## 8. AI-use disclosure

- **Claude Opus 5, in Claude Code**, wrote effectively all of the application
  code in this repository, working from a build spec written before kickoff.
  The spec set the concept, the friction, the requirement map and the visual
  direction; the code, the agent prompt and this README were produced during
  the session.
- **ElevenLabs Conversational AI** runs the intake: speech to text, the agent's
  own LLM for reasoning and tool calls, and text to speech for the replies. The
  agent is configured from `lib/voice/jamSeshAgent.ts`.
- **Lyria 3 Pro (Google), served by fal.ai**, generates the music from a prompt
  composed out of the brief.
- No model was fine-tuned and no user data was used for training. The
  conversational agent runs with recording off and zero retention.

The phrase "AI-generated" appears nowhere in the product surface. The brand
voice audit is explicit that Business Bangerz never uses it, so neither does
this.

---

## 9. Attribution

- **Next.js** (App Router) and **React**, MIT licensed.
- **@elevenlabs/react**, the ElevenLabs browser SDK for conversational agents.
- **Whop embedded checkout**, loaded from Whop's own CDN, running in test mode.
- **Archivo Black** and **Inter**, served through Google Fonts, both under the
  SIL Open Font License.
- Visual direction — the dark stage, the single hot accent, the ✦ ticker, the
  emoji inside button labels — follows the existing Business Bangerz brand.

**Audio provenance and commercial-use terms.** The demo track was generated by
Lyria 3 Pro through fal.ai during this build. The file carries its own proof of
that: a C2PA manifest signed by Google, asserting it was created by Google
generative AI, plus an imperceptible SynthID watermark. We did not add this and
cannot remove it, and that is the right outcome for a product that sells
licences — the provenance travels with the file.

fal.ai's terms grant the
generating account ownership of its outputs and permit commercial use, which is
what makes the "license this demo" door legitimate rather than decorative. That
said: this product *sells a licence*, so before a single real dollar changes
hands, the current fal.ai and Google Lyria terms should be read again by
somebody at Business Bangerz. Model terms change, and getting this wrong on a
licensing product is the thing that actually costs money. The licence offered
on the paywall card is deliberately narrow — internal business use, not
broadcast or paid advertising.

No third-party music, samples or recordings were used. The Northwind Logistics
company, the PayFlo product and the Marcy tire story in the demo fixture are
invented.
