import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

// ConnectKit + Wagmi configuration
export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia, base],
    transports: {
      [baseSepolia.id]: http(),
      [base.id]: http(),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    appName: 'UltraBingo',
    appDescription: 'Play Bingo, Win USDC - Powered by x402',
    appUrl: 'https://ultrabingo.app',
    appIcon: '/bingo-icon.png',
  })
);

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
