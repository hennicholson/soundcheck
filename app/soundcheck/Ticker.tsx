/**
 * The ✦ ticker. The most ownable device the brand has, running the words from
 * this flow rather than theirs.
 */

const WORDS = [
  'YOUR ROLLOUT',
  'YOUR OFFSITE',
  'YOUR ONBOARDING',
  'YOUR ALL-HANDS',
  'YOUR POLICY CHANGE',
  'YOUR MILESTONE',
];

export default function Ticker() {
  const run = [...WORDS, ...WORDS, ...WORDS, ...WORDS];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {run.map((w, i) => (
          <span key={i}>
            {w} <span className="sparkle">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
