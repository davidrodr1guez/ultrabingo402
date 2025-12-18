'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { BingoCard as BingoCardType, validateBingo, WinPattern } from '@/lib/bingo';

interface GameState {
  id: string;
  name: string;
  status: string;
  called_numbers: number[];
  mode: string;
}

interface StoredCard {
  id: string;
  numbers: (number | null)[][];
  owner: string;
  gameTitle: string;
  purchasedAt: string;
}

export default function PlayPage() {
  const { isConnected, address } = useAccount();
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<Record<string, Set<number>>>({});
  const [winPattern, setWinPattern] = useState<WinPattern>('line');
  const [bingoCards, setBingoCards] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [submittedClaims, setSubmittedClaims] = useState<Set<string>>(new Set());

  // Load cards from localStorage
  useEffect(() => {
    const owner = address?.toLowerCase() || 'demo-user';
    const key = `bingo_cards_${owner}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed: StoredCard[] = JSON.parse(stored);
        const loadedCards: BingoCardType[] = parsed.map(c => ({
          id: c.id,
          numbers: c.numbers,
          marked: Array(c.numbers.length).fill(null).map(() => Array(c.numbers[0]?.length || 5).fill(false)),
        }));
        setCards(loadedCards);
      } catch (e) {
        console.error('Error loading cards:', e);
      }
    }
    setIsLoading(false);
  }, [address]);

  // Poll for active game
  useEffect(() => {
    const pollGame = async () => {
      try {
        const res = await fetch('/api/games?active=true');
        const data = await res.json();
        if (data.game) {
          const newNumbers = data.game.called_numbers;
          if (newNumbers.length > 0) {
            const newLast = newNumbers[newNumbers.length - 1];
            if (newLast !== lastCalledNumber) {
              setLastCalledNumber(newLast);
            }
          }
          setActiveGame(data.game);
        } else {
          setActiveGame(null);
        }
      } catch (error) {
        console.log('No active game');
      }
    };

    pollGame();
    const interval = setInterval(pollGame, 2000);
    return () => clearInterval(interval);
  }, [lastCalledNumber]);

  // Check for BINGO
  useEffect(() => {
    if (cards.length === 0) return;

    const newBingoCards = new Set<string>();

    cards.forEach(card => {
      const cardMarked = markedNumbers[card.id] || new Set<number>();
      const hasBingo = validateBingo(card, Array.from(cardMarked), winPattern);
      if (hasBingo) {
        newBingoCards.add(card.id);
      }
    });

    const newBingoArray = Array.from(newBingoCards);
    for (const id of newBingoArray) {
      if (!bingoCards.has(id)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
        break;
      }
    }

    setBingoCards(newBingoCards);
  }, [markedNumbers, cards, winPattern, bingoCards]);

  const handleMarkNumber = useCallback((cardId: string, number: number) => {
    if (number === null) return;

    setMarkedNumbers(prev => {
      const cardMarks = new Set(prev[cardId] || []);
      if (cardMarks.has(number)) {
        cardMarks.delete(number);
      } else {
        cardMarks.add(number);
      }
      return { ...prev, [cardId]: cardMarks };
    });
  }, []);

  const clearMyCards = () => {
    if (confirm('Are you sure you want to clear all your cards?')) {
      const owner = address?.toLowerCase() || 'demo-user';
      localStorage.removeItem(`bingo_cards_${owner}`);
      setCards([]);
      setMarkedNumbers({});
      setBingoCards(new Set());
    }
  };

  const handleClaimBingo = async (cardId: string) => {
    if (!address) {
      setClaimStatus({ success: false, message: 'Please connect your wallet to claim' });
      return;
    }

    if (submittedClaims.has(cardId)) {
      setClaimStatus({ success: false, message: 'You already submitted a claim for this card' });
      return;
    }

    const card = cards.find(c => c.id === cardId);
    if (!card) {
      setClaimStatus({ success: false, message: 'Card not found' });
      return;
    }

    const cardMarkedNumbers = markedNumbers[cardId] || new Set<number>();

    setIsSubmittingClaim(true);
    setClaimStatus(null);

    try {
      const response = await fetch('/api/bingo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          walletAddress: address,
          markedNumbers: Array.from(cardMarkedNumbers),
          cardNumbers: card.numbers,
          pattern: winPattern,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setClaimStatus({ success: true, message: data.message || 'Claim submitted!' });
        setSubmittedClaims(prev => new Set(prev).add(cardId));
      } else {
        setClaimStatus({ success: false, message: data.error || 'Failed to submit claim' });
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      setClaimStatus({ success: false, message: 'Failed to submit claim. Please try again.' });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const calledNumbers = activeGame?.called_numbers || [];
  const currentNumber = calledNumbers[calledNumbers.length - 1] || null;

  return (
    <div className="play-page">
      {showConfetti && <Confetti />}

      <div className="bg-animation">
        <div className="bg-gradient" />
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <a href="/" className="brand">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="brand-name">UltraBingo</span>
            <span className="play-badge">Play</span>
          </a>
          <div className="header-right">
            <a href="/" className="home-btn" title="Volver al inicio">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Inicio</span>
            </a>
            {activeGame && (
              <div className="live-badge">
                <span className="live-dot" />
                LIVE
              </div>
            )}
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Game Status Bar */}
      <div className={`game-bar ${activeGame ? 'active' : ''}`}>
        {activeGame ? (
          <div className="game-bar-content">
            <div className="game-info">
              <span className="game-label">Now Playing:</span>
              <span className="game-name">{activeGame.name}</span>
            </div>
            <div className="current-number-display">
              {currentNumber ? (
                <div className="current-ball">
                  <span className="ball-letter">{getBingoLetter(currentNumber)}</span>
                  <span className="ball-number">{currentNumber}</span>
                </div>
              ) : (
                <span className="waiting-text">Waiting...</span>
              )}
            </div>
            <div className="game-stats">
              <span>{calledNumbers.length} / 75</span>
            </div>
          </div>
        ) : (
          <div className="waiting-bar">
            <div className="waiting-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <span>Waiting for game to start...</span>
          </div>
        )}
      </div>

      {/* Called Numbers Strip */}
      {activeGame && calledNumbers.length > 0 && (
        <div className="called-strip">
          <span className="strip-label">Called:</span>
          <div className="called-numbers">
            {calledNumbers.slice().reverse().slice(0, 15).map((num, idx) => (
              <span
                key={num}
                className={`called-num ${idx === 0 ? 'latest' : ''}`}
              >
                {getBingoLetter(num)}-{num}
              </span>
            ))}
            {calledNumbers.length > 15 && (
              <span className="more-numbers">+{calledNumbers.length - 15} more</span>
            )}
          </div>
        </div>
      )}

      {/* BINGO Alert */}
      {bingoCards.size > 0 && (
        <div className="bingo-alert">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>BINGO! You have {bingoCards.size} winning {bingoCards.size === 1 ? 'card' : 'cards'}!</span>
          <div className="claim-buttons">
            {Array.from(bingoCards).map((cardId, index) => {
              const cardIndex = cards.findIndex(c => c.id === cardId) + 1;
              const alreadyClaimed = submittedClaims.has(cardId);
              return (
                <button
                  key={cardId}
                  className={`claim-btn ${alreadyClaimed ? 'claimed' : ''}`}
                  onClick={() => handleClaimBingo(cardId)}
                  disabled={isSubmittingClaim || alreadyClaimed}
                >
                  {alreadyClaimed ? `Card #${cardIndex} Claimed` : `Claim Card #${cardIndex}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Claim Status Message */}
      {claimStatus && (
        <div className={`claim-status ${claimStatus.success ? 'success' : 'error'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {claimStatus.success ? (
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <span>{claimStatus.message}</span>
          <button className="dismiss-btn" onClick={() => setClaimStatus(null)}>×</button>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your cards...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h2>No Cards Found</h2>
            <p>Purchase some bingo cards to start playing!</p>
            <a href="/" className="btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Get Cards
            </a>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="controls-bar">
              <div className="pattern-selector">
                <label>Win Pattern:</label>
                <select value={winPattern} onChange={(e) => setWinPattern(e.target.value as WinPattern)}>
                  <option value="line">Any Line</option>
                  <option value="full-house">Full House</option>
                  <option value="four-corners">4 Corners</option>
                  <option value="x-pattern">X Pattern</option>
                </select>
              </div>
              <div className="cards-count">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
              </div>
              <button className="clear-btn" onClick={clearMyCards}>
                Clear Cards
              </button>
            </div>

            {/* Cards Grid */}
            <div className="cards-grid">
              {cards.map((card, index) => (
                <div key={card.id} className={`card-container ${bingoCards.has(card.id) ? 'has-bingo' : ''}`}>
                  <div className="card-header">
                    <span className="card-number">Card #{index + 1}</span>
                    {bingoCards.has(card.id) && <span className="bingo-badge">BINGO!</span>}
                  </div>
                  <BingoCardDisplay
                    card={card}
                    markedNumbers={markedNumbers[card.id] || new Set()}
                    calledNumbers={calledNumbers}
                    currentNumber={currentNumber}
                    onMarkNumber={(num) => handleMarkNumber(card.id, num)}
                  />
                  <div className="card-id">{card.id.slice(0, 8)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Instructions */}
      <div className="instructions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>Tap numbers to mark them. Called numbers highlight automatically.</span>
      </div>

      <style jsx>{`
        .play-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .bg-animation {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
        }

        .bg-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0033 50%, #0a0a0a 100%);
        }

        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          background: var(--uv-violet);
          top: -200px;
          right: -200px;
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          background: #4a00b0;
          bottom: -100px;
          left: -100px;
          animation-delay: -10s;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 20px) scale(1.05); }
        }

        .header {
          background: rgba(10, 10, 10, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-3) var(--space-4);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          text-decoration: none;
          color: inherit;
        }

        .brand-icon {
          width: 32px;
          height: 32px;
          background: var(--uv-violet);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .brand-icon svg {
          width: 18px;
          height: 18px;
        }

        .brand-name {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .play-badge {
          padding: var(--space-1) var(--space-2);
          background: var(--color-success);
          color: white;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .home-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.85rem;
          transition: all var(--transition-fast);
        }

        .home-btn:hover {
          background: var(--uv-violet);
          border-color: var(--uv-violet);
          color: white;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-error-bg);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-error);
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: var(--color-error);
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .game-bar {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
        }

        .game-bar.active {
          background: linear-gradient(90deg, var(--uv-violet-dark), var(--uv-violet), var(--uv-violet-dark));
        }

        .game-bar-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .game-info {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .game-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.85rem;
        }

        .game-name {
          font-weight: 600;
          color: white;
        }

        .current-number-display {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .current-ball {
          width: 70px;
          height: 70px;
          background: white;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .ball-letter {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--uv-violet);
          line-height: 1;
        }

        .ball-number {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--uv-violet);
          line-height: 1;
        }

        .waiting-text {
          color: rgba(255, 255, 255, 0.7);
        }

        .game-stats {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
        }

        .waiting-bar {
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          color: var(--text-muted);
        }

        .waiting-icon {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .called-strip {
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-subtle);
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          max-width: 1400px;
          margin: 0 auto;
          overflow-x: auto;
        }

        .strip-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .called-numbers {
          display: flex;
          gap: var(--space-2);
          flex-wrap: nowrap;
        }

        .called-num {
          padding: var(--space-1) var(--space-2);
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          opacity: 0.7;
        }

        .called-num.latest {
          background: var(--uv-violet);
          color: white;
          opacity: 1;
        }

        .more-numbers {
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .bingo-alert {
          background: linear-gradient(90deg, #ffc107, #ff9800, #ffc107);
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          font-weight: 700;
          color: #000;
          animation: bingo-flash 0.5s ease-in-out infinite alternate;
        }

        @keyframes bingo-flash {
          from { opacity: 0.9; }
          to { opacity: 1; }
        }

        .claim-buttons {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .claim-btn {
          background: #000;
          color: #ffc107;
          border: none;
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .claim-btn:hover:not(:disabled) {
          background: #222;
          transform: scale(1.05);
        }

        .claim-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .claim-btn.claimed {
          background: #4caf50;
          color: white;
        }

        .claim-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          font-weight: 500;
        }

        .claim-status.success {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .claim-status.error {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .dismiss-btn {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          opacity: 0.7;
        }

        .dismiss-btn:hover {
          opacity: 1;
        }

        .main-content {
          flex: 1;
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4);
          width: 100%;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          text-align: center;
          gap: var(--space-4);
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--border-default);
          border-top-color: var(--uv-violet);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .empty-icon svg {
          width: 40px;
          height: 40px;
        }

        .empty-state h2 {
          margin: 0;
        }

        .empty-state p {
          color: var(--text-muted);
          margin: 0;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          background: var(--uv-violet);
          color: white;
          border-radius: var(--radius-md);
          text-decoration: none;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .btn-primary:hover {
          background: var(--uv-violet-light);
        }

        .controls-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }

        .pattern-selector {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .pattern-selector label {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .pattern-selector select {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          color: var(--text-primary);
          font-family: inherit;
          cursor: pointer;
        }

        .cards-count {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .clear-btn {
          background: transparent;
          border: 1px solid var(--color-error);
          color: var(--color-error);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .clear-btn:hover {
          background: var(--color-error-bg);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--space-4);
        }

        .card-container {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          transition: all var(--transition-fast);
        }

        .card-container.has-bingo {
          border-color: #ffc107;
          box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .card-number {
          font-weight: 600;
        }

        .bingo-badge {
          padding: var(--space-1) var(--space-2);
          background: #ffc107;
          color: #000;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: var(--radius-sm);
          animation: pulse-badge 1s infinite;
        }

        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .card-id {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-top: var(--space-2);
        }

        .instructions {
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        @media (max-width: 768px) {
          .game-bar-content {
            flex-direction: column;
            text-align: center;
            gap: var(--space-3);
          }

          .game-info {
            flex-direction: column;
            gap: var(--space-1);
          }

          .controls-bar {
            flex-direction: column;
            gap: var(--space-3);
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Confetti() {
  return (
    <div className="confetti-container">
      {[...Array(60)].map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#6a00ff', '#ffc107', '#4caf50', '#ff5722', '#2196f3'][Math.floor(Math.random() * 5)],
          }}
        />
      ))}
      <style jsx>{`
        .confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1000;
          overflow: hidden;
        }
        .confetti-piece {
          position: absolute;
          top: -10px;
          width: 10px;
          height: 10px;
          animation: fall 3s ease-out forwards;
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function getBingoLetter(num: number): string {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

function BingoCardDisplay({
  card,
  markedNumbers,
  calledNumbers,
  currentNumber,
  onMarkNumber,
}: {
  card: BingoCardType;
  markedNumbers: Set<number>;
  calledNumbers: number[];
  currentNumber: number | null;
  onMarkNumber: (num: number) => void;
}) {
  return (
    <div className="bingo-card">
      <div className="card-row header-row">
        {['B', 'I', 'N', 'G', 'O'].map(letter => (
          <div key={letter} className="cell header-cell">{letter}</div>
        ))}
      </div>
      {card.numbers.map((row, rowIdx) => (
        <div key={rowIdx} className="card-row">
          {row.map((num, colIdx) => {
            const isFree = num === null;
            const numValue = typeof num === 'number' ? num : null;
            const isMarked = numValue !== null && markedNumbers.has(numValue);
            const isCalled = numValue !== null && calledNumbers.includes(numValue);
            const isLatest = numValue === currentNumber;

            return (
              <div
                key={colIdx}
                className={`cell ${isFree ? 'free' : ''} ${isMarked ? 'marked' : ''} ${isCalled && !isMarked ? 'called' : ''} ${isLatest && !isMarked ? 'latest' : ''}`}
                onClick={() => !isFree && numValue && onMarkNumber(numValue)}
              >
                {isFree ? 'FREE' : num}
                {isMarked && !isFree && <span className="check">✓</span>}
              </div>
            );
          })}
        </div>
      ))}
      <style jsx>{`
        .bingo-card {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .card-row {
          display: flex;
          gap: 3px;
        }
        .cell {
          flex: 1;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
          user-select: none;
        }
        .cell:hover:not(.header-cell):not(.free) {
          background: var(--bg-elevated);
          transform: scale(1.05);
        }
        .header-cell {
          background: var(--uv-violet);
          color: white;
          font-size: 1.1rem;
          cursor: default;
        }
        .cell.free {
          background: linear-gradient(135deg, var(--uv-violet-dark), var(--uv-violet));
          color: white;
          font-size: 0.6rem;
          cursor: default;
        }
        .cell.marked {
          background: var(--color-success) !important;
          color: white;
        }
        .cell.called:not(.marked) {
          background: var(--color-warning-bg);
          border: 2px solid var(--color-warning);
        }
        .cell.latest:not(.marked) {
          animation: glow 1s infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px var(--color-warning); }
          50% { box-shadow: 0 0 20px var(--color-warning); }
        }
        .check {
          position: absolute;
          font-size: 1.2rem;
        }
      `}</style>
    </div>
  );
}
