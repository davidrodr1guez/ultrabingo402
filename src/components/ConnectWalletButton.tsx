'use client';

import { ConnectKitButton } from 'connectkit';

export default function ConnectWalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName }) => {
        return (
          <button
            onClick={show}
            className="connect-button"
          >
            {isConnecting ? (
              'Connecting...'
            ) : isConnected ? (
              ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`
            ) : (
              'Connect Wallet'
            )}

            <style jsx>{`
              .connect-button {
                padding: 12px 24px;
                font-size: 1rem;
                font-weight: bold;
                background: linear-gradient(135deg, #2775ca 0%, #3b82f6 100%);
                color: white;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                transition: all 0.3s ease;
              }

              .connect-button:hover {
                transform: scale(1.02);
                box-shadow: 0 5px 20px rgba(39, 117, 202, 0.3);
              }
            `}</style>
          </button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
