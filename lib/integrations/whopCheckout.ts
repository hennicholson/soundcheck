/**
 * The paid door. Whop embedded checkout, running in test mode.
 *
 * This is the line item that does not exist today: a prospect who wants a
 * track but does not want a consultation is currently worth zero to Business
 * Bangerz. After a Sound Check they are a licensed demo sale at zero marginal
 * founder hours.
 *
 * Test mode is not hidden. The UI says so on the card, and so does the README.
 */

export const WHOP_LOADER_SRC = 'https://js.whop.com/static/checkout/loader.js';

export interface CheckoutConfig {
  planId: string;
  /** true whenever this is not a real charge */
  testMode: boolean;
  price: string;
  /** what the buyer actually gets, stated plainly on the card */
  includes: string[];
  licence: string;
}

/**
 * The hosted checkout, as a plain link. The embed is nicer, but a live demo
 * should never depend on a third-party script loading, so the link is always
 * rendered as well.
 */
export function checkoutUrl(planId: string): string {
  return `https://whop.com/checkout/${planId}`;
}

export function checkoutConfig(env: NodeJS.ProcessEnv = process.env): CheckoutConfig {
  return {
    planId: env.NEXT_PUBLIC_WHOP_PLAN_ID ?? '',
    testMode: String(env.NEXT_PUBLIC_WHOP_TEST_MODE ?? 'true').toLowerCase() !== 'false',
    price: `$${env.NEXT_PUBLIC_DEMO_PRICE || '49'}`,
    includes: [
      'The full-length track, not the sixty seconds',
      'Download as MP3 and WAV',
      'Licence to use it internally: all-hands, onboarding, Slack, offsites',
    ],
    licence: 'Internal business use. Not for broadcast or paid advertising.',
  };
}

/** Where the other door leads. */
export function jamSeshUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.NEXT_PUBLIC_JAM_SESH_URL ?? 'https://businessbangerz.com';
}
