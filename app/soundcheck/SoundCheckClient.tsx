'use client';

/**
 * The single path, end to end, on one contained screen.
 *
 *   consent -> voice intake -> live brief -> generation -> 60s -> paywall
 *
 * One card. Steps swap inside it, the page never scrolls, and the layout
 * collapses to a single column on a phone. There is no second feature here on
 * purpose.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import {
  BRIEF_FIELD_LABELS,
  BRIEF_FIELD_ORDER,
  briefCompleteness,
  emptyBrief,
  isListField,
  updateBriefField,
  type BangerBrief,
} from '@/lib/brief/bangerBrief';
import { recordPronunciation } from '@/lib/brief/pronunciationCapture';
import { logProbe } from '@/lib/voice/probeVagueAnswer';
import { appendTurn, type TranscriptTurn } from '@/lib/voice/jamSeshAgent';
import { PREVIEW_SECONDS } from '@/lib/audio/bangerPreview';
import { DEMO_SESSION } from '@/fixtures/demoSession';
import type { OutcomeEventName } from '@/lib/telemetry/outcomeEvents';
import Ticker from './Ticker';

type Stage = 'consent' | 'ready' | 'listening' | 'generating' | 'playing' | 'paywall';

const STEPS: { key: Stage; label: string }[] = [
  { key: 'consent', label: 'Consent' },
  { key: 'ready', label: 'Start' },
  { key: 'listening', label: 'Intake' },
  { key: 'generating', label: 'Build' },
  { key: 'playing', label: 'Listen' },
  { key: 'paywall', label: 'Choose' },
];

interface AgentConfig {
  mode: 'demo' | 'public' | 'signed';
  agentId?: string;
  signedUrl?: string;
  reason?: string;
}

interface PreviewPayload {
  preview: { url: string; source: string; promptUsed: string; model: string };
  cost: {
    lines: { label: string; detail: string; usd: number }[];
    totalUsd: number;
    founderMinutesSaved: number;
    founderCostAvoidedUsd: number;
    notes: string[];
  };
  persistence: { stubbed: boolean; wouldWrite: { table: string; summary: string }[] };
}

interface Props {
  checkout: {
    planId: string;
    testMode: boolean;
    price: string;
    includes: string[];
    licence: string;
  };
  jamSeshUrl: string;
}

const WAVE_BARS = 48;

/**
 * The ElevenLabs SDK keeps conversation state in context, so the provider has
 * to sit above anything that calls useConversation.
 */
export default function SoundCheckClient(props: Props) {
  return (
    <ConversationProvider>
      <SoundCheckFlow {...props} />
    </ConversationProvider>
  );
}

function SoundCheckFlow({ checkout, jamSeshUrl }: Props) {
  const [stage, setStage] = useState<Stage>('consent');
  const [brief, setBrief] = useState<BangerBrief>(emptyBrief);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const sessionId = useMemo(
    () => `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    []
  );
  const startedAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEnd = useRef<HTMLDivElement | null>(null);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  /* ---------------- telemetry (OR-11) ---------------- */

  const track = useCallback(
    (name: OutcomeEventName, props?: Record<string, unknown>) => {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sessionId, props }),
      }).catch(() => {});
    },
    [sessionId]
  );

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ mode: 'demo', reason: 'agent config unreachable' }));
  }, []);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript]);

  const flashRow = useCallback((field: string) => {
    setFlash(field);
    setTimeout(() => setFlash((f) => (f === field ? null : f)), 950);
  }, []);

  /* ---------------- the four client tools ---------------- */

  const finalize = useCallback(async () => {
    setStage('generating');
    track('brief_completed', {
      completeness: briefCompleteness(briefRef.current),
      probes: briefRef.current.vagueAnswersProbed.length,
      pronunciations: briefRef.current.pronunciations.length,
    });

    const conversationSeconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefRef.current, sessionId, conversationSeconds }),
      });
      if (!res.ok) throw new Error(`generate ${res.status}`);
      setPayload(await res.json());
      setStage('playing');
    } catch (err) {
      setError(`Generation failed: ${String(err)}`);
      setStage('playing');
    }
  }, [sessionId, track]);

  const clientTools = useMemo(
    () => ({
      updateBriefField: ({ field, value }: { field: string; value: string }) => {
        setBrief((b) => updateBriefField(b, field, value));
        flashRow(field);
        return 'written to the brief';
      },
      recordPronunciation: ({ term, saidAs }: { term: string; saidAs: string }) => {
        setBrief((b) => recordPronunciation(b, term, saidAs));
        flashRow('pronunciations');
        track('pronunciation_captured', { term });
        return 'pronunciation saved';
      },
      logProbe: ({ question }: { question: string }) => {
        setBrief((b) => logProbe(b, question));
        flashRow('vagueAnswersProbed');
        track('probe_fired', { question });
        return 'probe logged';
      },
      finalizeBrief: () => {
        void finalize();
        return 'building the sound check';
      },
    }),
    [flashRow, track, finalize]
  );

  /* ---------------- live voice ---------------- */

  const conversation = useConversation({
    clientTools,
    onMessage: (msg: { message?: string; source?: string }) => {
      setTranscript((t) => appendTurn(t, msg.source === 'user' ? 'user' : 'agent', msg.message ?? ''));
    },
    onError: (e: unknown) => setError(String(e)),
  });

  /* ---------------- fixture replay (OR-13) ---------------- */

  /**
   * `speed` compresses the recorded session. 1 is real time; the demo button
   * runs it at 4x so a whole intake fits in about twelve seconds on stage.
   */
  const replayFixture = useCallback((speed = 1) => {
    for (const step of DEMO_SESSION) {
      setTimeout(() => {
        if (step.kind === 'agent' || step.kind === 'user') {
          setTranscript((t) => appendTurn(t, step.kind as 'agent' | 'user', step.text));
        } else if (step.tool === 'updateBriefField') {
          clientTools.updateBriefField({ field: step.field, value: step.value });
        } else if (step.tool === 'recordPronunciation') {
          clientTools.recordPronunciation({ term: step.term, saidAs: step.saidAs });
        } else if (step.tool === 'logProbe') {
          clientTools.logProbe({ question: step.question });
        } else if (step.tool === 'finalizeBrief') {
          clientTools.finalizeBrief();
        }
      }, step.at / speed);
    }
  }, [clientTools]);

  /** The stage demo: same recorded session, four times faster. */
  const runFastDemo = useCallback(() => {
    if (conversation.status === 'connected') conversation.endSession();
    setTranscript([]);
    setBrief(emptyBrief());
    setStage('listening');
    startedAt.current = Date.now();
    track('session_started', { mode: 'demo-fast' });
    replayFixture(4);
  }, [conversation, replayFixture, track]);

  const start = useCallback(async () => {
    setStage('listening');
    startedAt.current = Date.now();
    track('session_started', { mode: config?.mode ?? 'demo' });

    if (!config || config.mode === 'demo') {
      replayFixture();
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // A signed URL is a WebSocket handshake; a public agent id can use WebRTC.
      const session =
        config.mode === 'signed' && config.signedUrl
          ? { signedUrl: config.signedUrl, connectionType: 'websocket' as const }
          : { agentId: config.agentId!, connectionType: 'webrtc' as const };
      conversation.startSession({ ...session, clientTools });
    } catch (err) {
      // No microphone, or the agent is unreachable. The demo still has to run.
      setError(`Live voice unavailable, replaying the recorded session. (${String(err)})`);
      replayFixture();
    }
  }, [config, conversation, replayFixture, track, clientTools]);

  /* ---------------- the 60-second gate ---------------- */

  useEffect(() => {
    if (stage !== 'playing' || !payload) return;
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      setElapsed(el.currentTime);
      if (el.currentTime >= PREVIEW_SECONDS) {
        // Hard cut. Not a fade, not a "would you like to continue."
        el.pause();
        track('paywall_hit', { at: PREVIEW_SECONDS });
        setStage('paywall');
      }
    };
    const onEnded = () => {
      track('paywall_hit', { at: el.currentTime, reason: 'track ended' });
      setStage('paywall');
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.play()
      .then(() => track('preview_played'))
      .catch(() => {});

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [stage, payload, track]);

  // The agent stops talking the moment the brief is locked. Nothing listens
  // through the generation wait, and the consent screen promises exactly that.
  useEffect(() => {
    if (stage !== 'generating') return;
    if (conversation.status === 'connected') conversation.endSession();
  }, [stage, conversation]);

  /* ---------------- render ---------------- */

  /**
   * Typing is a first-class way to answer, not a fallback. Rooms are loud,
   * some people would rather not talk out loud in an open office, and a
   * spelled-out product name is more reliable typed than said.
   */
  const sendTyped = useCallback(() => {
    const text = typed.trim();
    if (!text) return;
    setTranscript((t) => appendTurn(t, 'user', text));
    setTyped('');
    if (conversation.status === 'connected') conversation.sendUserMessage(text);
  }, [typed, conversation]);

  const stepIndex = STEPS.findIndex((s) => s.key === stage);
  const lastAgentTurn = [...transcript].reverse().find((t) => t.role === 'agent');
  const live = config?.mode === 'signed' || config?.mode === 'public';

  return (
    <div className="app">
      <div className="topbar">
        <span className="wordmark">
          Sound check <span className="ember">✦</span> Business Bangerz
        </span>
        <span className="meta">
          {live ? 'Live agent' : 'Offline mode'} · {stage === 'listening' ? 'in session' : 'ready'}
        </span>
      </div>

      <Ticker />

      <div className="card">
        <div className="rail">
          {STEPS.map((s, i) => (
            <i key={s.key} className={i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''} />
          ))}
        </div>
        <div className="rail-labels">
          {STEPS.map((s, i) => (
            <span key={s.key} className={i === stepIndex ? 'now' : ''}>
              {s.label}
            </span>
          ))}
        </div>

        {stage === 'consent' && (
          <Consent
            onGrant={() => {
              track('consent_granted');
              setStage('ready');
            }}
            onDecline={() => track('consent_declined')}
          />
        )}

        {stage === 'ready' && (
          <div className="step center">
            <p className="eyebrow">Before the show, there&apos;s a sound check</p>
            <h1 className="display display-xl" style={{ marginBottom: 14 }}>
              Tell us what&apos;s
              <br />
              <span className="ember">coming up.</span>
            </h1>
            <p className="note" style={{ maxWidth: 400, marginBottom: 22 }}>
              About eight questions, two minutes. Talk like you&apos;d talk to a songwriter, not
              like you&apos;re filling in a form. You&apos;ll leave with a finished brief and
              sixty seconds of your banger.
            </p>
            <div className="btn-row">
              <button className="btn btn-primary btn-lg" onClick={start}>
                🎵 Start your sound check
              </button>
              <button className="btn btn-ghost btn-lg" onClick={runFastDemo}>
                ⏩ Watch a 15-second demo
              </button>
            </div>
            <p className="meta" style={{ marginTop: 14 }}>
              {live ? 'Microphone or keyboard, your call' : 'Offline · replaying a recorded session'}
            </p>
          </div>
        )}

        {stage === 'listening' && (
          <div className="step">
            <div className="live">
              <div className="live-pane transcript-pane">
                <p className="eyebrow">
                  <span className="pulse" />
                  {live ? 'Listening' : 'Recorded session'}
                </p>
                {lastAgentTurn && <div className="now-asking">{lastAgentTurn.text}</div>}
                <div className="scrollable">
                  {transcript.length === 0 && <p className="note">Connecting to the agent.</p>}
                  {transcript.map((t, i) => (
                    <div key={i} className={`turn ${t.role}`}>
                      <span className="who">{t.role === 'agent' ? 'Sound check' : 'You'}</span>
                      {t.text}
                    </div>
                  ))}
                  <div ref={transcriptEnd} />
                </div>
              </div>
              <LiveBrief brief={brief} flash={flash} />
            </div>

            <div className="composer">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendTyped()}
                placeholder="Or just type your answer…"
                aria-label="Type your answer"
              />
              <button className="btn btn-primary btn-sm" onClick={sendTyped} disabled={!typed.trim()}>
                Send
              </button>
            </div>
          </div>
        )}

        {stage === 'generating' && (
          <div className="step center">
            <p className="eyebrow">
              <span className="pulse" />
              Building
            </p>
            <h2 className="display display-xl">
              Cutting your
              <br />
              scratch demo.
            </h2>
            <p className="note" style={{ marginTop: 14 }}>Sixty seconds. Hang on.</p>
          </div>
        )}

        {(stage === 'playing' || stage === 'paywall') && payload && (
          <div className={`step ${stage === 'paywall' ? 'scroll' : 'center'}`}>
            {stage === 'playing' && (
              <>
                <p className="eyebrow">Scratch demo · {brief.company || 'your company'}</p>
                <h2 className="display display-l">Sixty seconds.</h2>
                <Wave elapsed={elapsed} />
                <p className="note" style={{ marginTop: 10, maxWidth: 460 }}>
                  {payload.preview.source === 'fixture'
                    ? 'Generated during the build and served from disk. Said plainly, on purpose.'
                    : `Generated just now by ${payload.preview.model}.`}
                </p>
              </>
            )}

            {stage === 'paywall' && (
              <Paywall
                checkout={checkout}
                jamSeshUrl={jamSeshUrl}
                cost={payload.cost}
                persistence={payload.persistence}
                onLicense={() =>
                  track('licensed', { price: checkout.price, testMode: checkout.testMode })
                }
                onBook={() => track('jam_sesh_booked', { company: brief.company })}
                brief={brief}
              />
            )}

            <audio ref={audioRef} src={payload.preview.url} preload="auto" />
          </div>
        )}

        {error && (
          <p className="note" style={{ padding: '0 16px 12px', color: 'var(--highlight)' }}>
            {error}
          </p>
        )}
      </div>

      <p className="meta" style={{ textAlign: 'center', flex: 'none' }}>
        This is a sound check, not the show ✦ Business Bangerz still writes the real banger
      </p>
    </div>
  );
}

/* ================= consent (OR-7) ================= */

function Consent({ onGrant, onDecline }: { onGrant: () => void; onDecline: () => void }) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <div className="step center">
        <h2 className="display display-l">No problem.</h2>
        <p className="note" style={{ marginTop: 12, maxWidth: 380 }}>
          Nothing was recorded. You can still book a Jam Sesh the normal way and talk to a
          person.
        </p>
      </div>
    );
  }

  return (
    <div className="step scroll">
      <p className="eyebrow">Before we start</p>
      <h2 className="display display-l" style={{ marginBottom: 14 }}>
        Here&apos;s what happens
        <br />
        to your voice.
      </h2>
      <ul className="consent-list">
        <li>
          <b>What we listen to.</b> Your microphone, only while the session is running. The
          moment the brief is done, we stop.
        </li>
        <li>
          <b>What we keep.</b> The text of what you said, turned into a song brief. The audio is
          not stored — the agent runs with recording off and zero retention.
        </li>
        <li>
          <b>What it&apos;s used for.</b> Writing your brief and generating your sixty-second
          demo. Nothing else. No model is trained on it.
        </li>
        <li>
          <b>How long we keep it.</b> The brief stays until you ask us to delete it. The
          conversation audio is never written down in the first place.
        </li>
        <li>
          <b>How to pull out.</b> Close the tab, or say &quot;stop the sound check&quot; out
          loud. Either one ends it and the brief is discarded.
        </li>
      </ul>
      <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" onClick={onGrant}>
          🎧 I&apos;m good, start listening
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            onDecline();
            setDeclined(true);
          }}
        >
          Not today
        </button>
      </div>
    </div>
  );
}

/* ================= live brief (MR-3 on screen) ================= */

function LiveBrief({ brief, flash }: { brief: BangerBrief; flash: string | null }) {
  const completeness = briefCompleteness(brief);
  return (
    <div className="live-pane">
      <p className="eyebrow">Live · BangerBrief v1 · {Math.round(completeness * 100)}%</p>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${Math.round(completeness * 100)}%` }} />
      </div>
      <div className="scrollable">
        <div className="brief-rows">
          {BRIEF_FIELD_ORDER.map((field) => {
            const value = brief[field];
            const filled = Array.isArray(value) ? value.length > 0 : String(value).length > 0;
            return (
              <div
                key={field}
                className={`brief-row ${filled ? 'filled' : ''} ${flash === field ? 'just-filled' : ''}`}
              >
                <div className="brief-label">
                  {BRIEF_FIELD_LABELS[field]}
                  {field === 'vagueAnswersProbed' && brief.vagueAnswersProbed.length > 0 && (
                    <span className="probe-tell">probed</span>
                  )}
                </div>
                <div className={`brief-value ${filled ? '' : 'empty'}`}>
                  {!filled && '—'}

                  {filled && field === 'pronunciations' && (
                    <div className="chips">
                      {brief.pronunciations.map((p) => (
                        <span key={p.term} className="chip">
                          <b>{p.term}</b> · {p.saidAs}
                        </span>
                      ))}
                    </div>
                  )}

                  {filled && field === 'vagueAnswersProbed' && (
                    <div>
                      {brief.vagueAnswersProbed.map((q, i) => (
                        <div key={i} className="probe-item">
                          {q}
                        </div>
                      ))}
                    </div>
                  )}

                  {filled &&
                    field !== 'pronunciations' &&
                    field !== 'vagueAnswersProbed' &&
                    (isListField(field) ? (
                      <ul className="brief-list">
                        {(value as string[]).map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    ) : (
                      String(value)
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================= player ================= */

function Wave({ elapsed }: { elapsed: number }) {
  const played = Math.min(elapsed / PREVIEW_SECONDS, 1);
  const head = Math.floor(played * WAVE_BARS);
  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      <div className="wave">
        {Array.from({ length: WAVE_BARS }).map((_, i) => {
          const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
          return (
            <i
              key={i}
              className={i === head ? 'head' : i < head ? 'played' : ''}
              style={{ height: `${22 + seed * 78}%` }}
            />
          );
        })}
      </div>
      <div className="clock">
        <span>{fmt(elapsed)}</span>
        <span>-{fmt(PREVIEW_SECONDS - elapsed)}</span>
      </div>
    </div>
  );
}

function fmt(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `0:${String(t).padStart(2, '0')}`;
}

/* ================= the two doors ================= */

function Paywall({
  checkout,
  jamSeshUrl,
  cost,
  persistence,
  onLicense,
  onBook,
  brief,
}: {
  checkout: Props['checkout'];
  jamSeshUrl: string;
  cost: PreviewPayload['cost'];
  persistence: PreviewPayload['persistence'];
  onLicense: () => void;
  onBook: () => void;
  brief: BangerBrief;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!checkoutOpen || !checkout.planId) return;
    const s = document.createElement('script');
    s.src = 'https://js.whop.com/static/checkout/loader.js';
    s.async = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, [checkoutOpen, checkout.planId]);

  const download = () => {
    const blob = new Blob([JSON.stringify({ schema: 'bangerbrief/v1', brief }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bangerbrief-${(brief.company || 'session').toLowerCase().replace(/\W+/g, '-')}.json`;
    a.click();
  };

  return (
    <>
      <div className="lock-strip">
        <p className="display display-m" style={{ marginBottom: 5 }}>
          🔒 That&apos;s where the free part stops.
        </p>
        <p className="note" style={{ color: '#e8e4da' }}>
          Sixty seconds is enough to know if it works. It isn&apos;t enough to play at an
          all-hands. Two doors from here.
        </p>
      </div>

      <div className="doors">
        <div className="door paid">
          <p className="eyebrow">Door one</p>
          <h3 className="display display-m">License this demo.</h3>
          <p className="price">
            {checkout.price}
            {checkout.testMode && <span className="test-badge">test mode</span>}
          </p>
          <ul>
            {checkout.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="note" style={{ marginBottom: 12 }}>{checkout.licence}</p>
          {!checkoutOpen ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                onLicense();
                setCheckoutOpen(true);
              }}
            >
              🔥 License it
            </button>
          ) : checkout.planId ? (
            <div data-whop-checkout-plan-id={checkout.planId} data-whop-checkout-theme="dark" />
          ) : (
            <p className="note">
              Whop checkout is in test mode. Set NEXT_PUBLIC_WHOP_PLAN_ID to mount the embedded
              checkout.
            </p>
          )}
        </div>

        <div className="door book">
          <p className="eyebrow">Door two</p>
          <h3 className="display display-m">Book the Jam Sesh.</h3>
          <p className="price" style={{ color: 'var(--highlight)' }}>Free</p>
          <ul>
            <li>Twenty minutes with Matthew, not a form</li>
            <li>Your brief arrives before the call does</li>
            <li>He starts at minute ten, not minute zero</li>
          </ul>
          <p className="note" style={{ marginBottom: 12 }}>
            Bring this brief to a 20-minute Jam Sesh and we&apos;ll write you the real thing.
          </p>
          <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
            <a
              className="btn btn-gold"
              href={jamSeshUrl}
              target="_blank"
              rel="noreferrer"
              onClick={onBook}
            >
              🎧 Book it
            </a>
            <button className="btn btn-ghost" onClick={download}>
              Brief JSON
            </button>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div style={{ width: '100%', textAlign: 'left' }}>
        <p className="eyebrow">What this session cost</p>
        {cost.lines.map((l) => (
          <div key={l.label} className="cost-line">
            <span>
              {l.label} · {l.detail}
            </span>
            <span>${l.usd.toFixed(4)}</span>
          </div>
        ))}
        <div
          className="cost-line"
          style={{ color: 'var(--paper)', fontSize: '0.85rem', marginTop: 4 }}
        >
          <span>Total</span>
          <span>${cost.totalUsd.toFixed(2)}</span>
        </div>
        <div className="cost-line">
          <span>Founder minutes used</span>
          <span>0, against ~{cost.founderMinutesSaved} saved on the call</span>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          {cost.notes.join(' ')} Persistence is{' '}
          {persistence.stubbed ? 'stubbed' : 'live'}; this would write to{' '}
          {persistence.wouldWrite.map((w) => w.table).join(', ')}.
        </p>
      </div>
    </>
  );
}
