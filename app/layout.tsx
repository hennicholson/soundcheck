import type { Metadata } from 'next';
import { Archivo_Black, Inter } from 'next/font/google';
import './globals.css';

/* Type is the identity. Heavy condensed display, plain body. */
const display = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Sound Check · Business Bangerz',
  description:
    'An intake session that turns two minutes of talking into a finished song brief and sixty seconds of what your banger could sound like.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
