import './globals.css';
import type { Metadata } from 'next';
import WalletProvider from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'UltraBingo - Play & Win USDC with x402',
  description: 'Play Bingo and win USDC prizes with gasless x402 payments powered by Ultravioleta DAO',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
