import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UltraBingo - Play & Win with x402',
  description: 'Play Bingo and win prizes with x402 micropayments',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
