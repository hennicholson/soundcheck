/**
 * /demo — the sixty-second explanation.
 *
 * Not the tool. This is the page you put on a screen behind you: what it is,
 * what it replaces, what it does that a form cannot, and what comes out.
 * Scannable in under a minute, then it sends you to the tool itself.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Ticker from '../soundcheck/Ticker';

export const metadata: Metadata = {
  title: 'Sound Check · What it does',
  description:
    'Sixty seconds on what Sound Check is: an agent-run intake that turns a two-minute conversation into a song brief and a scratch demo.',
};

const BEATS = [
  {
    n: '01',
    head: 'You talk. It asks.',
    body: 'A voice agent opens by asking what is coming up. A rollout, an offsite, an onboarding class. Not a form, not a dropdown, and never "how can I help you today."',
  },
  {
    n: '02',
    head: 'It pushes back once.',
    body: '"We want people to be more engaged" is a mood, not an objective. So it asks what somebody does differently on Tuesday that they would not have done on Monday. Every push is logged and shown on screen.',
  },
  {
    n: '03',
    head: 'It writes down how to say things.',
    body: 'Acronyms, product names, internal jargon. A singer who says "N-P-S" when the company says "nips" costs a re-record. A form never asks. This asks every time.',
  },
  {
    n: '04',
    head: 'The brief fills in while you watch.',
    body: 'Twelve fields, live: the moment, the objective, who hears it, the must-say lines, the stories, the vibe. Structured, machine-readable, and downloadable as JSON.',
  },
  {
    n: '05',
    head: 'Sixty seconds, then it stops dead.',
    body: 'The brief becomes a music prompt and the prompt becomes a track. It plays for sixty seconds and hard-cuts. Not a fade. The cut is the point.',
  },
  {
    n: '06',
    head: 'Two doors.',
    body: 'License the demo, which is a new line item that costs the founder zero hours. Or book the Jam Sesh, and he walks into that call with the brief already done.',
  },
];

export default function DemoPage() {
  return (
    <div style={{ minHeight: '100dvh', padding: 14 }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div className="topbar" style={{ marginBottom: 12 }}>
          <span className="wordmark">
            Sound check <span className="ember">✦</span> Business Bangerz
          </span>
          <span className="meta">Sixty seconds on what this is</span>
        </div>

        <Ticker />

        <section style={{ paddingBlock: '34px 26px' }}>
          <p className="eyebrow">The problem</p>
          <h1 className="display display-xl" style={{ marginBottom: 18 }}>
            The free Jam Sesh
            <br />
            is the <span className="ember">bottleneck</span>.
          </h1>
          <p
            style={{
              maxWidth: 620,
              color: 'var(--dim)',
              lineHeight: 1.65,
              fontSize: '0.98rem',
              margin: 0,
            }}
          >
            It costs the founder his own hours. Most of the people on it were never going to
            buy. And the ones who were describe what they want in deck language, so the real
            objective stays buried until it is expensive to fix.
          </p>
          <p
            style={{
              maxWidth: 620,
              color: 'var(--paper)',
              lineHeight: 1.65,
              fontSize: '0.98rem',
              marginTop: 14,
            }}
          >
            Sound Check runs that intake before the founder ever picks up.
          </p>
        </section>

        <hr className="divider" />

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
            paddingBlock: 20,
          }}
        >
          {BEATS.map((b) => (
            <div key={b.n}>
              <p
                className="display"
                style={{ fontSize: '0.85rem', color: 'var(--ember)', marginBottom: 6 }}
              >
                {b.n}
              </p>
              <h2 className="display display-m" style={{ marginBottom: 7 }}>
                {b.head}
              </h2>
              <p style={{ color: 'var(--dim)', fontSize: '0.87rem', lineHeight: 1.6, margin: 0 }}>
                {b.body}
              </p>
            </div>
          ))}
        </section>

        <hr className="divider" />

        <section style={{ paddingBlock: 24 }}>
          <p className="eyebrow">What changes</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 16,
            }}
          >
            <div className="door">
              <h3 className="display display-m" style={{ marginBottom: 8 }}>
                Qualified, not cold.
              </h3>
              <p className="note">
                Everybody who finishes arrives at the Jam Sesh with a completed brief. Matthew
                starts at minute ten, not minute zero.
              </p>
            </div>
            <div className="door paid">
              <h3 className="display display-m" style={{ marginBottom: 8 }}>
                Revenue from zero.
              </h3>
              <p className="note">
                A prospect who wants a track but not a consultation is worth nothing today.
                Now they are a licensed sale at zero founder hours.
              </p>
            </div>
            <div className="door book">
              <h3 className="display display-m" style={{ marginBottom: 8 }}>
                They already heard it.
              </h3>
              <p className="note">
                Somebody who has heard sixty seconds of their own message as a song books
                differently than somebody who read a use-case card.
              </p>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section style={{ paddingBlock: '24px 46px', textAlign: 'center' }}>
          <h2 className="display display-l" style={{ marginBottom: 8 }}>
            This is a sound check,
            <br />
            not the show.
          </h2>
          <p className="note" style={{ maxWidth: 440, margin: '0 auto 22px' }}>
            Business Bangerz still writes the real banger. This just makes sure they are
            writing it for somebody who has already heard something they liked.
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary btn-lg" href="/soundcheck">
              🎵 Run a sound check
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
