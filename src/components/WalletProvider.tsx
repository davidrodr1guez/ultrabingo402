'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          customTheme={{
            '--ck-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            '--ck-accent-color': '#2775ca',
            '--ck-accent-text-color': '#ffffff',
          }}
          options={{
            embedGoogleFonts: true,
            walletConnectName: 'WalletConnect',
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
