'use client';

/**
 * The single path, end to end.
 *
 *   consent -> voice intake -> live brief -> generation -> 60s -> paywall
 *
 * Nothing else. There is no second feature on this page on purpose.
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

const WAVE_BARS = 56;

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

  const sessionId = useMemo(
    () => `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    []
  );
  const startedAt = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

    const conversationSeconds = startedAt.current
      ? (Date.now() - startedAt.current) / 1000
      : 0;

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
      setError(String(err));
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
      const role = msg.source === 'user' ? 'user' : 'agent';
      setTranscript((t) => appendTurn(t, role, msg.message ?? ''));
    },
    onError: (e: unknown) => setError(String(e)),
  });

  /* ---------------- fixture replay (OR-13) ---------------- */

  const replayFixture = useCallback(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of DEMO_SESSION) {
      timers.push(
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
        }, step.at)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [clientTools]);

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
      const session =
        config.mode === 'signed' && config.signedUrl
          ? { signedUrl: config.signedUrl }
          : { agentId: config.agentId! };
      // clientTools go in on the session too: this is the connection that
      // actually drives the brief card.
      conversation.startSession({ ...session, clientTools, connectionType: 'webrtc' });
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
        el.currentTime = PREVIEW_SECONDS;
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

  const completeness = briefCompleteness(brief);
  const played = Math.min(elapsed / PREVIEW_SECONDS, 1);

  return (
    <>
      <header className="shell" style={{ paddingBlock: '28px 18px' }}>
        <p className="eyebrow">Business Bangerz · Sound check</p>
        <h1 className="display display-xl">
          Before the show,
          <br />
          there&apos;s a <span className="ember">sound check</span>.
        </h1>
        <p style={{ maxWidth: 620, color: '#cfcfd8', lineHeight: 1.6, marginTop: 18 }}>
          Talk to us for two minutes about what&apos;s coming up. You&apos;ll walk away with a
          finished song brief and sixty seconds of what your banger could sound like.
        </p>
      </header>

      <Ticker />

      <main className="shell">
        {stage === 'consent' && <Consent onGrant={() => { track('consent_granted'); setStage('ready'); }} onDecline={() => track('consent_declined')} />}

        {stage !== 'consent' && (
          <div className="stage">
            <section>
              {stage === 'ready' && (
                <div className="panel panel-tall" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <div>
                    <h2 className="display display-l" style={{ marginBottom: 14 }}>
                      Ready when
                      <br />
                      you are.
                    </h2>
                    <p className="note" style={{ maxWidth: 320, margin: '0 auto 22px' }}>
                      About eight questions. Two minutes. Talk like you&apos;d talk to a
                      songwriter, not like you&apos;re filling in a form.
                    </p>
                    <button className="btn btn-primary btn-lg" onClick={start}>
                      🎵 Start your sound check
                    </button>
                    {config?.mode === 'demo' && (
                      <p className="meta" style={{ marginTop: 16 }}>
                        Offline mode · replaying a recorded session
                      </p>
                    )}
                  </div>
                </div>
              )}

              {stage === 'listening' && (
                <div className="panel panel-tall">
                  <p className="eyebrow">
                    <span className="pulse" />
                    {config?.mode === 'demo' ? 'Replaying recorded session' : 'Listening'}
                  </p>
                  <h2 className="section-head">The conversation.</h2>
                  <div className="transcript">
                    {transcript.length === 0 && (
                      <p className="note">Waiting for the first question.</p>
                    )}
                    {transcript.map((t, i) => (
                      <div key={i} className={`turn ${t.role}`}>
                        <span className="who">{t.role === 'agent' ? 'Sound check' : 'You'}</span>
                        {t.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stage === 'generating' && (
                <div className="panel panel-tall" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <div>
                    <p className="eyebrow">
                      <span className="pulse" />
                      Building
                    </p>
                    <h2 className="display display-l">
                      Cutting your
                      <br />
                      scratch demo.
                    </h2>
                    <p className="note" style={{ marginTop: 16 }}>Sixty seconds. Hang on.</p>
                  </div>
                </div>
              )}

              {(stage === 'playing' || stage === 'paywall') && payload && (
                <Player
                  payload={payload}
                  audioRef={audioRef}
                  played={played}
                  elapsed={elapsed}
                  locked={stage === 'paywall'}
                  brief={brief}
                />
              )}

              {error && (
                <p className="note" style={{ marginTop: 12, color: 'var(--highlight)' }}>
                  {error}
                </p>
              )}
            </section>

            <section>
              <LiveBrief brief={brief} completeness={completeness} flash={flash} />
            </section>
          </div>
        )}

        {stage === 'paywall' && payload && (
          <Paywall
            checkout={checkout}
            jamSeshUrl={jamSeshUrl}
            cost={payload.cost}
            persistence={payload.persistence}
            onLicense={() => track('licensed', { price: checkout.price, testMode: checkout.testMode })}
            onBook={() => track('jam_sesh_booked', { company: brief.company })}
            brief={brief}
          />
        )}
      </main>

      <footer className="shell" style={{ paddingBlock: '40px 60px' }}>
        <hr className="divider" />
        <p className="meta">
          This is a sound check, not the show · Business Bangerz still writes the real banger
        </p>
      </footer>
    </>
  );
}

/* ================= consent (OR-7) ================= */

function Consent({ onGrant, onDecline }: { onGrant: () => void; onDecline: () => void }) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <div className="panel consent" style={{ marginBlock: 40, textAlign: 'center' }}>
        <h2 className="display display-m">No problem.</h2>
        <p className="note" style={{ marginTop: 12 }}>
          Nothing was recorded. You can still book a Jam Sesh the normal way and talk to a
          person.
        </p>
      </div>
    );
  }

  return (
    <div className="panel consent" style={{ marginBlock: 40 }}>
      <p className="eyebrow">Before we start</p>
      <h2 className="display display-m" style={{ marginBottom: 14 }}>
        Here&apos;s what happens to your voice.
      </h2>
      <ul>
        <li>
          <b>What we listen to.</b> Your microphone, only while the session is running. The
          moment the brief is done, we stop.
        </li>
        <li>
          <b>What we keep.</b> The text of what you said, turned into a song brief. The audio
          itself is not stored — the agent runs with recording off and zero retention.
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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
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

function LiveBrief({
  brief,
  completeness,
  flash,
}: {
  brief: BangerBrief;
  completeness: number;
  flash: string | null;
}) {
  return (
    <div className="panel panel-tall">
      <p className="eyebrow">Live · BangerBrief v1</p>
      <h2 className="section-head">Your brief, filling in.</h2>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${Math.round(completeness * 100)}%` }} />
      </div>

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

                {filled && field !== 'pronunciations' && field !== 'vagueAnswersProbed' && (
                  isListField(field) ? (
                    <ul className="brief-list">
                      {(value as string[]).map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    String(value)
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= player + the gate ================= */

function Player({
  payload,
  audioRef,
  played,
  elapsed,
  locked,
  brief,
}: {
  payload: PreviewPayload;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  played: number;
  elapsed: number;
  locked: boolean;
  brief: BangerBrief;
}) {
  const headBar = Math.floor(played * WAVE_BARS);
  return (
    <div className="panel">
      <p className="eyebrow">Scratch demo · {brief.company || 'your company'}</p>
      <h2 className="display display-m" style={{ marginBottom: 6 }}>
        {locked ? 'That’s the sound check.' : 'Sixty seconds.'}
      </h2>

      <div className="player" style={{ marginTop: 16 }}>
        <div className="wave">
          {Array.from({ length: WAVE_BARS }).map((_, i) => {
            const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
            const h = 22 + seed * 78;
            return (
              <i
                key={i}
                className={i === headBar ? 'head' : i < headBar ? 'played' : ''}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="clock">
          <span>{fmt(elapsed)}</span>
          <span>{locked ? 'CUT' : `-${fmt(PREVIEW_SECONDS - elapsed)}`}</span>
        </div>
        <audio ref={audioRef} src={payload.preview.url} preload="auto" />
      </div>

      <p className="note" style={{ marginTop: 14 }}>
        {payload.preview.source === 'fixture'
          ? 'Pre-baked during the build and served from disk. Stated plainly, on purpose.'
          : `Generated just now by ${payload.preview.model}.`}
      </p>
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
    return () => {
      s.remove();
    };
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
    <section style={{ paddingBottom: 40 }}>
      <div className="lock-strip">
        <p className="display display-m" style={{ marginBottom: 6 }}>
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
          <p className="note" style={{ marginBottom: 14 }}>{checkout.licence}</p>
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
              Whop checkout runs in test mode. Set NEXT_PUBLIC_WHOP_PLAN_ID to mount the real
              embedded checkout.
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
          <p className="note" style={{ marginBottom: 14 }}>
            Bring this brief to a 20-minute Jam Sesh and we&apos;ll write you the real thing.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-gold" href={jamSeshUrl} target="_blank" rel="noreferrer" onClick={onBook}>
              🎧 Book it
            </a>
            <button className="btn btn-ghost" onClick={download}>
              Brief JSON
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">What this session cost</p>
        <h3 className="section-head">The honest number.</h3>
        {cost.lines.map((l) => (
          <div key={l.label} className="cost-line">
            <span>
              {l.label} · {l.detail}
            </span>
            <span>${l.usd.toFixed(4)}</span>
          </div>
        ))}
        <hr className="divider" />
        <div className="cost-line" style={{ color: 'var(--paper)', fontSize: '0.9rem' }}>
          <span>Total</span>
          <span>${cost.totalUsd.toFixed(2)}</span>
        </div>
        <div className="cost-line">
          <span>Founder minutes used</span>
          <span>0 (vs ~{cost.founderMinutesSaved} saved on the call)</span>
        </div>
        <hr className="divider" />
        <p className="note">{cost.notes.join(' ')}</p>
        <p className="note" style={{ marginTop: 10 }}>
          Persistence: {persistence.stubbed ? 'stubbed. ' : 'live. '}
          Would write to {persistence.wouldWrite.map((w) => w.table).join(', ')}.
        </p>
      </div>
    </section>
  );
}
