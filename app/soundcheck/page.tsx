/**
 * MR-4 — the single runnable entry point for the primary workflow.
 *
 *   npm run soundcheck  ->  http://localhost:3000/soundcheck
 *
 * Server component: reads configuration from the environment (OR-12) and hands
 * it to the one client component that runs the whole path.
 */

import type { Metadata } from 'next';
import SoundCheckClient from './SoundCheckClient';
import { checkoutConfig, jamSeshUrl } from '@/lib/integrations/whopCheckout';

export const metadata: Metadata = {
  title: 'Sound Check · Business Bangerz',
  description:
    'Talk for two minutes about what is coming up. Walk away with a finished song brief and sixty seconds of what your banger could sound like.',
};

export const dynamic = 'force-dynamic';

export default function SoundCheckPage() {
  return <SoundCheckClient checkout={checkoutConfig()} jamSeshUrl={jamSeshUrl()} />;
}
