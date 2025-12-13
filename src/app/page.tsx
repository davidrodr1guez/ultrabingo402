'use client';

import { useState, useCallback, useEffect } from 'react';
import BingoCard from '@/components/BingoCard';
import NumberCaller from '@/components/NumberCaller';
import { generateBingoCard, markNumber, checkWin, callNumber, BingoCard as BingoCardType } from '@/lib/bingo';

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [card, setCard] = useState<BingoCardType | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [hasWon, setHasWon] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [prizePool, setPrizePool] = useState('100.00');

  const ENTRY_FEE = '1.00'; // $1 USDC

  useEffect(() => {
    // Fetch current prize pool
    fetch('/api/claim-prize')
      .then(res => res.json())
      .then(data => setPrizePool(data.prizePool))
      .catch(console.error);
  }, []);

  const handlePayAndPlay = async () => {
    // x402 payment integration with Ultravioleta facilitator
    try {
      const response = await fetch('/api/pay-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.status === 402) {
        // Handle x402 payment required
        const paymentDetails = await response.json();
        console.log('Payment required:', paymentDetails);
        // Show payment modal with USDC details
        alert(`Payment Required!\n\nAmount: $${ENTRY_FEE} USDC\nNetwork: Base Sepolia\nFacilitator: Ultravioleta DAO\n\nConnect your wallet to pay with USDC (gasless via x402)`);
        return;
      }

      if (response.ok) {
        setIsPaid(true);
        startGame();
      }
    } catch (error) {
      console.error('Payment error:', error);
      // For demo purposes, start the game anyway
      setIsPaid(true);
      startGame();
    }
  };

  const startGame = () => {
    setCard(generateBingoCard());
    setCalledNumbers([]);
    setCurrentNumber(null);
    setHasWon(false);
    setGameStarted(true);
  };

  const handleCallNumber = useCallback(() => {
    const newNumber = callNumber(calledNumbers);
    if (newNumber) {
      setCurrentNumber(newNumber);
      setCalledNumbers(prev => [...prev, newNumber]);
    }
  }, [calledNumbers]);

  const handleMarkNumber = useCallback((number: number) => {
    if (!card || !calledNumbers.includes(number)) return;

    const updatedCard = markNumber(card, number);
    setCard(updatedCard);

    if (checkWin(updatedCard)) {
      setHasWon(true);
    }
  }, [card, calledNumbers]);

  const handleClaimPrize = async () => {
    try {
      const response = await fetch('/api/claim-prize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card?.id,
          winnerAddress: '0x...', // In production, get from wallet
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${data.message}\n\nPrize sent via Ultravioleta x402 facilitator!`);
      }
    } catch (error) {
      console.error('Claim error:', error);
    }
  };

  return (
    <main className="container">
      <header className="header">
        <h1>UltraBingo</h1>
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
            <div className="network">Base Network</div>
          </div>

          <div className="entry-info">
            <p>Entry Fee: ${ENTRY_FEE} USDC</p>
            <p className="gasless">Gasless payments via x402</p>
            <button className="pay-button" onClick={handlePayAndPlay}>
              Pay & Play
            </button>
          </div>

          <div className="how-to-play">
            <h3>How to Play</h3>
            <ol>
              <li>Pay ${ENTRY_FEE} USDC entry fee (gasless!)</li>
              <li>Get your unique Bingo card</li>
              <li>Mark numbers as they are called</li>
              <li>Get 5 in a row to win the prize pool!</li>
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
          {hasWon && (
            <div className="winner-banner">
              <h2>BINGO! You Won!</h2>
              <p className="prize-amount">${prizePool} USDC</p>
              <button onClick={handleClaimPrize}>Claim Prize</button>
            </div>
          )}

          <div className="game-grid">
            <div className="card-section">
              {card && (
                <BingoCard
                  card={card}
                  onMarkNumber={handleMarkNumber}
                  disabled={hasWon}
                />
              )}
            </div>

            <div className="caller-section">
              <NumberCaller
                currentNumber={currentNumber}
                calledNumbers={calledNumbers}
                onCallNumber={handleCallNumber}
                disabled={hasWon}
              />
            </div>
          </div>

          <button className="new-game-button" onClick={handlePayAndPlay}>
            New Game (${ENTRY_FEE} USDC)
          </button>
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
          padding: 40px 0;
        }

        .header h1 {
          font-size: 3rem;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header p {
          color: #888;
          font-size: 1.2rem;
          margin-top: 10px;
        }

        .badges {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 15px;
        }

        .x402-badge {
          padding: 8px 20px;
          background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: bold;
        }

        .ultravioleta-badge {
          padding: 8px 20px;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: bold;
        }

        .start-screen {
          max-width: 500px;
          margin: 0 auto;
          text-align: center;
        }

        .prize-pool {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 30px;
          border-radius: 16px;
          margin-bottom: 30px;
          border: 2px solid #0f3460;
        }

        .prize-pool h2 {
          color: #888;
          font-size: 1rem;
          margin-bottom: 10px;
        }

        .prize-pool .amount {
          font-size: 3rem;
          font-weight: bold;
          color: #2775ca;
        }

        .prize-pool .network {
          color: #666;
          font-size: 0.9rem;
          margin-top: 10px;
        }

        .entry-info {
          margin-bottom: 30px;
        }

        .entry-info p {
          margin-bottom: 10px;
          color: #888;
        }

        .entry-info .gasless {
          color: #00b894;
          font-size: 0.9rem;
        }

        .pay-button {
          margin-top: 10px;
          padding: 20px 60px;
          font-size: 1.3rem;
          font-weight: bold;
          background: linear-gradient(135deg, #2775ca 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .pay-button:hover {
          transform: scale(1.05);
          box-shadow: 0 10px 30px rgba(39, 117, 202, 0.4);
        }

        .how-to-play {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 30px;
          border-radius: 16px;
          text-align: left;
          border: 2px solid #0f3460;
          margin-bottom: 20px;
        }

        .how-to-play h3 {
          margin-bottom: 15px;
          color: #e94560;
        }

        .how-to-play ol {
          padding-left: 20px;
          color: #aaa;
          line-height: 2;
        }

        .powered-by {
          margin-top: 30px;
          color: #666;
          font-size: 0.9rem;
        }

        .powered-by a {
          color: #00b894;
          text-decoration: underline;
        }

        .game-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 30px;
        }

        .winner-banner {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          padding: 20px 40px;
          border-radius: 16px;
          text-align: center;
          animation: pulse 1s infinite;
        }

        .winner-banner .prize-amount {
          font-size: 2rem;
          font-weight: bold;
          margin: 10px 0;
        }

        .winner-banner button {
          margin-top: 15px;
          padding: 10px 30px;
          font-size: 1.1rem;
          background: white;
          color: #00b894;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-weight: bold;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .game-grid {
          display: flex;
          gap: 40px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .card-section, .caller-section {
          flex: 1;
          min-width: 340px;
        }

        .new-game-button {
          padding: 15px 40px;
          font-size: 1rem;
          background: #0f3460;
          color: white;
          border: 2px solid #1a4a7a;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .new-game-button:hover {
          background: #1a4a7a;
        }

        @media (max-width: 768px) {
          .game-grid {
            flex-direction: column;
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
