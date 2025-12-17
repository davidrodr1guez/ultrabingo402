import './globals.css';
import type { Metadata, Viewport } from 'next';
import WalletProvider from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'UltraBingo - Cartones de Bingo con Pagos Cripto en Base Network',
  description: 'Genera y compra cartones de bingo premium con pagos en USDC usando el protocolo x402 en Base Network. Powered by Ultravioleta DAO.',
  keywords: ['bingo', 'crypto', 'USDC', 'Base Network', 'x402', 'Web3'],
  openGraph: {
    title: 'UltraBingo - Bingo Cards on Base Network',
    description: 'Generate and purchase premium bingo cards with USDC payments',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
