'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import BingoCard from '@/components/BingoCard';
import NumberCaller from '@/components/NumberCaller';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useX402Payment } from '@/hooks/useX402Payment';
import {
  generateBingoCard,
  markNumber,
  checkWin,
  callNumber,
  BingoCard as BingoCardType,
  GameMode,
  WinPattern,
  WIN_PATTERNS,
} from '@/lib/bingo';

const ENTRY_FEE = '0.01';
const PAYMENT_RECIPIENT = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000';

export default function Home() {
  const { isConnected, address } = useAccount();
  const { pay, checkBalance, isProcessing } = useX402Payment();

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [card, setCard] = useState<BingoCardType | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [hasWon, setHasWon] = useState(false);
  const [prizePool, setPrizePool] = useState('100.00');

  // Game settings
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [winPattern, setWinPattern] = useState<WinPattern>('line');
  const [autoCall, setAutoCall] = useState(false);
  const [autoCallSpeed, setAutoCallSpeed] = useState(3000);

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'checking' | 'signing' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasEnoughBalance, setHasEnoughBalance] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/claim-prize')
      .then(res => res.json())
      .then(data => setPrizePool(data.prizePool))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isConnected) {
      checkBalance(ENTRY_FEE).then(setHasEnoughBalance);
    } else {
      setHasEnoughBalance(null);
    }
  }, [isConnected, checkBalance]);

  // Check for win after each mark
  useEffect(() => {
    if (card && !hasWon) {
      if (checkWin(card, winPattern)) {
        setHasWon(true);
        setAutoCall(false);
      }
    }
  }, [card, winPattern, hasWon]);

  const handlePayAndPlay = async () => {
    if (!isConnected) return;

    setPaymentStatus('checking');
    setErrorMessage('');

    const hasBalance = await checkBalance(ENTRY_FEE);
    if (!hasBalance) {
      setPaymentStatus('error');
      setErrorMessage('Insufficient USDC balance. You need at least $0.01 USDC.');
      return;
    }

    setPaymentStatus('signing');

    const result = await pay(PAYMENT_RECIPIENT, ENTRY_FEE);

    if (result.success) {
      setPaymentStatus('success');
      startGame();
    } else {
      setPaymentStatus('error');
      setErrorMessage(result.error || 'Payment failed');
    }
  };

  const startGame = () => {
    setCard(generateBingoCard(gameMode));
    setCalledNumbers([]);
    setCurrentNumber(null);
    setHasWon(false);
    setGameStarted(true);
    setPaymentStatus('idle');
    setAutoCall(false);
  };

  // For demo: start without payment
  const startDemoGame = () => {
    startGame();
  };

  const handleCallNumber = useCallback(() => {
    const newNumber = callNumber(calledNumbers, gameMode);
    if (newNumber) {
      setCurrentNumber(newNumber);
      setCalledNumbers(prev => [...prev, newNumber]);
    }
  }, [calledNumbers, gameMode]);

  const handleMarkNumber = useCallback((number: number) => {
    if (!card || !calledNumbers.includes(number)) return;

    const updatedCard = markNumber(card, number);
    setCard(updatedCard);
  }, [card, calledNumbers]);

  const handleClaimPrize = async () => {
    if (!address) return;

    try {
      const response = await fetch('/api/claim-prize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card?.id,
          winnerAddress: address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${data.message}\n\nPrize will be sent to: ${address}`);
      }
    } catch (error) {
      console.error('Claim error:', error);
    }
  };

  const handleNewCard = () => {
    setCard(generateBingoCard(gameMode));
    setHasWon(false);
  };

  const getPayButtonText = () => {
    if (!isConnected) return 'Connect Wallet First';
    if (paymentStatus === 'checking') return 'Checking Balance...';
    if (paymentStatus === 'signing') return 'Sign in Wallet...';
    if (paymentStatus === 'processing') return 'Processing...';
    if (isProcessing) return 'Processing...';
    return `Pay $${ENTRY_FEE} USDC & Play`;
  };

  return (
    <main className="container">
      <header className="header">
        <div className="header-top">
          <h1>UltraBingo</h1>
          <ConnectWalletButton />
        </div>
        <p>Play Bingo, Win USDC</p>
        <div className="badges">
          <div className="x402-badge">Powered by x402</div>
          <div className="ultravioleta-badge">Ultravioleta DAO</div>
        </div>
      </header>

      {!gameStarted ? (
        <div className="start-screen">
          <div className="prize-pool">
            <h2>Current Prize Pool</h2>
            <div className="amount">${prizePool} USDC</div>
            <div className="network">Base Sepolia Testnet</div>
          </div>

          {/* Game Settings */}
          <div className="settings-panel">
            <h3>Game Settings</h3>

            <div className="setting-group">
              <label>Game Mode</label>
              <div className="button-group">
                <button
                  className={gameMode === '1-75' ? 'active' : ''}
                  onClick={() => setGameMode('1-75')}
                >
                  75-Ball (US)
                </button>
                <button
                  className={gameMode === '1-90' ? 'active' : ''}
                  onClick={() => setGameMode('1-90')}
                >
                  90-Ball (UK)
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label>Win Pattern</label>
              <select
                value={winPattern}
                onChange={(e) => setWinPattern(e.target.value as WinPattern)}
              >
                {Object.entries(WIN_PATTERNS).map(([key, desc]) => (
                  <option key={key} value={key}>{key.replace('-', ' ').toUpperCase()}: {desc}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>Auto-Call Speed</label>
              <select
                value={autoCallSpeed}
                onChange={(e) => setAutoCallSpeed(Number(e.target.value))}
              >
                <option value={2000}>Fast (2s)</option>
                <option value={3000}>Normal (3s)</option>
                <option value={5000}>Slow (5s)</option>
                <option value={8000}>Very Slow (8s)</option>
              </select>
            </div>
          </div>

          {isConnected && hasEnoughBalance !== null && (
            <div className={`balance-status ${hasEnoughBalance ? 'sufficient' : 'insufficient'}`}>
              {hasEnoughBalance
                ? '✓ You have enough USDC to play'
                : '✗ Insufficient USDC balance'}
            </div>
          )}

          <div className="entry-info">
            <p>Entry Fee: ${ENTRY_FEE} USDC</p>
            <p className="gasless">Gasless payments via x402</p>

            <div className="button-row">
              {!isConnected ? (
                <div className="connect-prompt">
                  <p>Connect your wallet to play for prizes</p>
                  <ConnectWalletButton />
                </div>
              ) : (
                <button
                  className="pay-button"
                  onClick={handlePayAndPlay}
                  disabled={isProcessing || (paymentStatus !== 'idle' && paymentStatus !== 'error')}
                >
                  {getPayButtonText()}
                </button>
              )}

              <button className="demo-button" onClick={startDemoGame}>
                Play Demo (Free)
              </button>
            </div>

            {paymentStatus === 'error' && errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}
          </div>

          <div className="how-to-play">
            <h3>How to Play</h3>
            <ol>
              <li>Choose your game mode and win pattern</li>
              <li>Pay ${ENTRY_FEE} USDC or try the free demo</li>
              <li>Click "Call Number" or enable Auto-Call</li>
              <li>Click on your card to mark called numbers</li>
              <li>Complete the pattern to win!</li>
            </ol>
          </div>

          <div className="powered-by">
            <p>Payments processed by</p>
            <a href="https://facilitator.ultravioletadao.xyz" target="_blank" rel="noopener noreferrer">
              Ultravioleta DAO x402 Facilitator
            </a>
          </div>
        </div>
      ) : (
        <div className="game-area">
          {/* Game Info Bar */}
          <div className="game-info-bar">
            <span className="info-item">Mode: {gameMode}</span>
            <span className="info-item">Pattern: {winPattern.replace('-', ' ')}</span>
            <span className="info-item">Numbers: {calledNumbers.length}/{gameMode === '1-75' ? 75 : 90}</span>
          </div>

          {hasWon && (
            <div className="winner-banner">
              <h2>BINGO! You Won!</h2>
              <p className="prize-amount">${prizePool} USDC</p>
              <div className="winner-buttons">
                {isConnected && (
                  <button onClick={handleClaimPrize} className="claim-button">
                    Claim Prize
                  </button>
                )}
                <button onClick={handleNewCard} className="new-card-button">
                  New Card
                </button>
              </div>
            </div>
          )}

          <div className="game-grid">
            <div className="card-section">
              {card && (
                <BingoCard
                  card={card}
                  onMarkNumber={handleMarkNumber}
                  disabled={hasWon}
                  mode={gameMode}
                  calledNumbers={calledNumbers}
                />
              )}
              <button className="new-card-btn" onClick={handleNewCard}>
                Get New Card
              </button>
            </div>

            <div className="caller-section">
              <NumberCaller
                currentNumber={currentNumber}
                calledNumbers={calledNumbers}
                onCallNumber={handleCallNumber}
                disabled={hasWon}
                mode={gameMode}
                autoCall={autoCall}
                autoCallSpeed={autoCallSpeed}
                onAutoCallChange={setAutoCall}
              />
            </div>
          </div>

          <div className="game-actions">
            <button className="back-button" onClick={() => setGameStarted(false)}>
              Back to Menu
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }

        .header {
          text-align: center;
          padding: 30px 0;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 900px;
          margin: 0 auto 15px;
        }

        .header h1 {
          font-size: 2.5rem;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .header p {
          color: #888;
          font-size: 1.1rem;
          margin-top: 5px;
        }

        .badges {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 10px;
        }

        .x402-badge, .ultravioleta-badge {
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: bold;
        }

        .x402-badge {
          background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
        }

        .ultravioleta-badge {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
        }

        .start-screen {
          max-width: 550px;
          margin: 0 auto;
          text-align: center;
        }

        .prize-pool {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 25px;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 2px solid #0f3460;
        }

        .prize-pool h2 {
          color: #888;
          font-size: 0.95rem;
          margin-bottom: 8px;
        }

        .prize-pool .amount {
          font-size: 2.5rem;
          font-weight: bold;
          color: #2775ca;
        }

        .prize-pool .network {
          color: #666;
          font-size: 0.85rem;
          margin-top: 8px;
        }

        .settings-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 2px solid #0f3460;
          text-align: left;
        }

        .settings-panel h3 {
          color: #e94560;
          margin-bottom: 15px;
          text-align: center;
        }

        .setting-group {
          margin-bottom: 15px;
        }

        .setting-group label {
          display: block;
          color: #888;
          font-size: 0.9rem;
          margin-bottom: 8px;
        }

        .setting-group select {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #0f3460;
          background: #0a0a1a;
          color: #eee;
          font-size: 0.9rem;
        }

        .button-group {
          display: flex;
          gap: 10px;
        }

        .button-group button {
          flex: 1;
          padding: 10px;
          border: 2px solid #0f3460;
          background: #0a0a1a;
          color: #888;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-group button.active {
          background: #0f3460;
          color: #fff;
          border-color: #00b894;
        }

        .balance-status {
          padding: 10px 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 0.9rem;
        }

        .balance-status.sufficient {
          background: rgba(0, 184, 148, 0.2);
          color: #00b894;
          border: 1px solid #00b894;
        }

        .balance-status.insufficient {
          background: rgba(233, 69, 96, 0.2);
          color: #e94560;
          border: 1px solid #e94560;
        }

        .entry-info {
          margin-bottom: 25px;
        }

        .entry-info p {
          margin-bottom: 8px;
          color: #888;
        }

        .entry-info .gasless {
          color: #00b894;
          font-size: 0.9rem;
        }

        .button-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 15px;
        }

        .connect-prompt p {
          margin-bottom: 10px;
          color: #aaa;
        }

        .pay-button {
          padding: 16px 50px;
          font-size: 1.1rem;
          font-weight: bold;
          background: linear-gradient(135deg, #2775ca 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .pay-button:hover:not(:disabled) {
          transform: scale(1.03);
          box-shadow: 0 8px 25px rgba(39, 117, 202, 0.4);
        }

        .pay-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .demo-button {
          padding: 12px 40px;
          font-size: 1rem;
          background: transparent;
          color: #888;
          border: 2px solid #333;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .demo-button:hover {
          border-color: #00b894;
          color: #00b894;
        }

        .error-message {
          margin-top: 15px;
          padding: 10px 20px;
          background: rgba(233, 69, 96, 0.2);
          border: 1px solid #e94560;
          border-radius: 10px;
          color: #e94560;
          font-size: 0.9rem;
        }

        .how-to-play {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          text-align: left;
          border: 2px solid #0f3460;
          margin-bottom: 20px;
        }

        .how-to-play h3 {
          margin-bottom: 12px;
          color: #e94560;
        }

        .how-to-play ol {
          padding-left: 20px;
          color: #aaa;
          line-height: 1.8;
          font-size: 0.95rem;
        }

        .powered-by {
          color: #666;
          font-size: 0.85rem;
        }

        .powered-by a {
          color: #00b894;
          text-decoration: underline;
        }

        .game-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .game-info-bar {
          display: flex;
          gap: 20px;
          background: #0f3460;
          padding: 10px 25px;
          border-radius: 30px;
        }

        .info-item {
          color: #aaa;
          font-size: 0.9rem;
        }

        .winner-banner {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          padding: 25px 50px;
          border-radius: 16px;
          text-align: center;
          animation: pulse 1s infinite;
        }

        .winner-banner h2 {
          margin: 0;
        }

        .winner-banner .prize-amount {
          font-size: 2rem;
          font-weight: bold;
          margin: 10px 0;
        }

        .winner-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 15px;
        }

        .claim-button, .new-card-button {
          padding: 10px 25px;
          font-size: 1rem;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-weight: bold;
        }

        .claim-button {
          background: white;
          color: #00b894;
        }

        .new-card-button {
          background: rgba(0,0,0,0.2);
          color: white;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }

        .game-grid {
          display: flex;
          gap: 30px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }

        .card-section {
          display: flex;
          flex-direction: column;
          gap: 15px;
          align-items: center;
        }

        .new-card-btn {
          padding: 10px 25px;
          background: #0f3460;
          color: #aaa;
          border: 1px solid #1a4a7a;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .new-card-btn:hover {
          background: #1a4a7a;
          color: #fff;
        }

        .caller-section {
          flex: 1;
          min-width: 320px;
          max-width: 400px;
        }

        .game-actions {
          margin-top: 20px;
        }

        .back-button {
          padding: 12px 30px;
          background: transparent;
          color: #888;
          border: 2px solid #333;
          border-radius: 25px;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .back-button:hover {
          border-color: #e94560;
          color: #e94560;
        }

        @media (max-width: 768px) {
          .header-top {
            flex-direction: column;
            gap: 15px;
          }

          .game-grid {
            flex-direction: column;
            align-items: center;
          }

          .game-info-bar {
            flex-wrap: wrap;
            justify-content: center;
          }

          .badges {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </main>
  );
}
