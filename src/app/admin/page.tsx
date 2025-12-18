'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { getBingoLetter, GameMode, WinPattern } from '@/lib/bingo';

// Get admin wallets from environment variable
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(Boolean);

interface DbCard {
  id: string;
  numbers: number[][];
  owner: string;
  game_mode: string;
  game_title: string;
  purchased_at: string;
  payment_status: string;
}

interface BingoClaim {
  id: string;
  cardId: string;
  walletAddress: string;
  markedNumbers: number[];
  cardNumbers: (number | null)[][];
  pattern: string;
  gameId: string | null;
  gameName: string | null;
  calledNumbersAtClaim: number[];
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export default function AdminPanel() {
  const { isConnected, address } = useAccount();
  const isAuthorized = address && ADMIN_WALLETS.includes(address.toLowerCase());

  const gameMode: GameMode = '1-75'; // Fixed to 75-ball mode
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameName, setGameName] = useState('Game 1');
  const [verifyCardId, setVerifyCardId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    card?: DbCard;
    hasBingo: boolean;
    markedNumbers: number[];
  } | null>(null);
  const [winPattern, setWinPattern] = useState<WinPattern>('line');
  const [registeredCards, setRegisteredCards] = useState<DbCard[]>([]);
  const [showCardsList, setShowCardsList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<BingoClaim[]>([]);
  const [processingClaim, setProcessingClaim] = useState<string | null>(null);

  const maxNumber = gameMode === '1-75' ? 75 : 90;

  const refreshCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cards');
      const data = await res.json();
      if (data.cards) {
        setRegisteredCards(data.cards);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

  // Poll for pending claims
  const refreshClaims = useCallback(async () => {
    try {
      const res = await fetch('/api/bingo/claims?pending=true');
      const data = await res.json();
      if (data.claims) {
        setPendingClaims(data.claims);
      }
    } catch (error) {
      console.log('Could not fetch claims');
    }
  }, []);

  useEffect(() => {
    refreshClaims();
    const interval = setInterval(refreshClaims, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [refreshClaims]);

  const handleVerifyClaim = async (claimId: string) => {
    setProcessingClaim(claimId);
    try {
      const res = await fetch('/api/bingo/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action: 'verify' }),
      });
      const data = await res.json();
      if (data.success) {
        refreshClaims();
      }
    } catch (error) {
      console.error('Error verifying claim:', error);
    } finally {
      setProcessingClaim(null);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessingClaim(claimId);
    try {
      const res = await fetch('/api/bingo/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action: 'reject', reason }),
      });
      const data = await res.json();
      if (data.success) {
        refreshClaims();
      }
    } catch (error) {
      console.error('Error rejecting claim:', error);
    } finally {
      setProcessingClaim(null);
    }
  };

  const syncGameState = async (newCalled: number[], newCurrent: number | null) => {
    if (!gameId) return;
    try {
      await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', calledNumbers: newCalled }),
      });
    } catch (error) {
      console.error('Error syncing game state:', error);
    }
  };

  const handleNumberClick = (num: number) => {
    if (!gameActive) return;
    let newCalled: number[];
    let newCurrent: number | null;

    if (calledNumbers.includes(num)) {
      newCalled = calledNumbers.filter(n => n !== num);
      newCurrent = currentNumber === num ? (newCalled[newCalled.length - 1] || null) : currentNumber;
    } else {
      newCalled = [...calledNumbers, num];
      newCurrent = num;
    }

    setCalledNumbers(newCalled);
    setCurrentNumber(newCurrent);
    syncGameState(newCalled, newCurrent);
  };

  const handleRandomCall = () => {
    if (!gameActive) return;
    const available = Array.from({ length: maxNumber }, (_, i) => i + 1).filter(n => !calledNumbers.includes(n));
    if (available.length === 0) return;

    const randomNum = available[Math.floor(Math.random() * available.length)];
    const newCalled = [...calledNumbers, randomNum];

    setCalledNumbers(newCalled);
    setCurrentNumber(randomNum);
    syncGameState(newCalled, randomNum);
  };

  const handleStartGame = async () => {
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameName, mode: gameMode }),
      });
      const data = await res.json();
      if (res.ok && data.gameId) {
        setGameId(data.gameId);
      } else {
        // API returned error, use local mode
        console.log('Using local mode - API error:', data.error || 'Unknown error');
        setGameId(null);
      }
    } catch (error) {
      // Network or other error, use local mode
      console.log('Using local mode - Network error:', error);
      setGameId(null);
    }
    // Always start the game (local mode if DB fails)
    setGameActive(true);
    setCalledNumbers([]);
    setCurrentNumber(null);
  };

  const handleEndGame = async () => {
    if (gameId) {
      try {
        await fetch(`/api/games/${gameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end' }),
        });
      } catch (error) {
        console.error('Error ending game:', error);
      }
    }
    setGameActive(false);
    setGameId(null);
  };

  const handleReset = () => {
    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameActive(false);
    setGameId(null);
  };

  const handleUndo = () => {
    if (calledNumbers.length === 0) return;
    const newCalled = calledNumbers.slice(0, -1);
    const newCurrent = newCalled[newCalled.length - 1] || null;
    setCalledNumbers(newCalled);
    setCurrentNumber(newCurrent);
    syncGameState(newCalled, newCurrent);
  };

  const handleVerifyBingo = async () => {
    if (!verifyCardId.trim()) return;
    try {
      const res = await fetch(`/api/cards/${verifyCardId.trim()}?calledNumbers=${JSON.stringify(calledNumbers)}&pattern=${winPattern}`);
      if (!res.ok) {
        setVerifyResult({ found: false, hasBingo: false, markedNumbers: [] });
        return;
      }
      const data = await res.json();
      setVerifyResult({
        found: true,
        card: data.card,
        hasBingo: data.verification.hasBingo,
        markedNumbers: data.verification.markedNumbers,
      });
    } catch (error) {
      console.error('Error verifying bingo:', error);
      setVerifyResult({ found: false, hasBingo: false, markedNumbers: [] });
    }
  };

  const handleClearRegistry = async () => {
    if (confirm('Are you sure you want to delete all registered cards?')) {
      try {
        await fetch('/api/cards', { method: 'DELETE' });
        refreshCards();
      } catch (error) {
        console.error('Error clearing registry:', error);
      }
    }
  };

  // Show connect wallet screen if not connected
  if (!isConnected) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1>Admin Access</h1>
          <p>Connect your wallet to access the admin panel.</p>
          <div className="auth-connect">
            <ConnectKitButton />
          </div>
        </div>
        <style jsx>{`
          .auth-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0033 50%, #0a0a0a 100%);
            padding: var(--space-4);
          }
          .auth-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-xl);
            padding: var(--space-8);
            text-align: center;
            max-width: 400px;
          }
          .auth-icon {
            width: 64px;
            height: 64px;
            background: var(--uv-violet-glow);
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto var(--space-5);
            color: var(--uv-violet-light);
          }
          .auth-icon svg {
            width: 32px;
            height: 32px;
          }
          .auth-card h1 {
            font-size: 1.5rem;
            margin-bottom: var(--space-2);
          }
          .auth-card p {
            color: var(--text-muted);
            margin-bottom: var(--space-6);
          }
          .auth-connect {
            display: flex;
            justify-content: center;
          }
        `}</style>
      </div>
    );
  }

  // Show access denied if wallet is not authorized
  if (!isAuthorized) {
    return (
      <div className="auth-screen">
        <div className="auth-card denied">
          <div className="auth-icon denied">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M4.93 4.93l14.14 14.14" />
            </svg>
          </div>
          <h1>Access Denied</h1>
          <p>Your wallet is not authorized to access the admin panel.</p>
          <div className="wallet-address">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <a href="/" className="back-link">Back to Home</a>
        </div>
        <style jsx>{`
          .auth-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0033 50%, #0a0a0a 100%);
            padding: var(--space-4);
          }
          .auth-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-xl);
            padding: var(--space-8);
            text-align: center;
            max-width: 400px;
          }
          .auth-card.denied {
            border-color: var(--color-error);
          }
          .auth-icon {
            width: 64px;
            height: 64px;
            background: var(--uv-violet-glow);
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto var(--space-5);
            color: var(--uv-violet-light);
          }
          .auth-icon.denied {
            background: var(--color-error-bg);
            color: var(--color-error);
          }
          .auth-icon svg {
            width: 32px;
            height: 32px;
          }
          .auth-card h1 {
            font-size: 1.5rem;
            margin-bottom: var(--space-2);
          }
          .auth-card p {
            color: var(--text-muted);
            margin-bottom: var(--space-4);
          }
          .wallet-address {
            font-family: var(--font-mono);
            background: var(--bg-tertiary);
            padding: var(--space-2) var(--space-4);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            margin-bottom: var(--space-5);
            display: inline-block;
          }
          .back-link {
            color: var(--uv-violet-light);
            text-decoration: none;
          }
          .back-link:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="admin">
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
            <span className="admin-badge">Admin</span>
          </a>
          <a href="/" className="home-btn" title="Back to Home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Inicio</span>
          </a>
          <div className="game-name-wrapper">
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="input-field game-name-input"
              placeholder="Game name..."
            />
          </div>
        </div>
      </header>

      <main className="main">
        {/* Control Panel */}
        <section className="control-panel">
          <div className="control-row">
            <div className="game-actions">
              {!gameActive ? (
                <button className="btn btn-start" onClick={handleStartGame}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Game
                </button>
              ) : (
                <>
                  <button className="btn btn-call" onClick={handleRandomCall}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Call Number
                  </button>
                  <button className="btn btn-secondary" onClick={handleUndo} disabled={calledNumbers.length === 0}>
                    Undo
                  </button>
                  <button className="btn btn-warning" onClick={handleEndGame}>
                    End Game
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={handleReset}>
                Reset
              </button>
            </div>

            <div className="stats">
              <span className="stat-value">{calledNumbers.length}</span>
              <span className="stat-label">/ {maxNumber}</span>
            </div>
          </div>
        </section>

        {/* Current Number Display */}
        <section className="current-section">
          <div className={`current-ball ${currentNumber ? 'active' : ''}`}>
            {currentNumber ? (
              <>
                {gameMode === '1-75' && <span className="ball-letter">{getBingoLetter(currentNumber)}</span>}
                <span className="ball-number">{currentNumber}</span>
              </>
            ) : (
              <span className="ball-waiting">?</span>
            )}
          </div>

          <div className="last-called">
            <span className="last-label">Previous:</span>
            <div className="last-balls">
              {calledNumbers.slice(-6, -1).reverse().map((num, idx) => (
                <div key={num} className="last-ball" style={{ opacity: 1 - idx * 0.15 }}>
                  {gameMode === '1-75' ? `${getBingoLetter(num)}-${num}` : num}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Number Board */}
        <section className="board-section">
          <div className="panel">
            <div className="board-75">
              {['B', 'I', 'N', 'G', 'O'].map((letter, colIdx) => {
                const start = colIdx * 15 + 1;
                return (
                  <div key={letter} className="board-column">
                    <div className="column-header">{letter}</div>
                    <div className="column-numbers">
                      {Array.from({ length: 15 }, (_, i) => start + i).map(num => (
                        <button
                          key={num}
                          className={`num-cell ${calledNumbers.includes(num) ? 'called' : ''} ${currentNumber === num ? 'current' : ''}`}
                          onClick={() => handleNumberClick(num)}
                          disabled={!gameActive}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* History */}
        <section className="history-section">
          <div className="panel">
            <h3 className="panel-title">Call History ({calledNumbers.length})</h3>
            <div className="history-list">
              {calledNumbers.length === 0 ? (
                <p className="empty-text">No numbers called yet</p>
              ) : (
                calledNumbers.map((num, idx) => (
                  <span key={num} className="history-item">
                    {idx + 1}. {gameMode === '1-75' ? `${getBingoLetter(num)}-${num}` : num}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Verify Bingo */}
        <section className="verify-section">
          <div className="panel panel-verify">
            <h3 className="panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              Verify Bingo
            </h3>
            <div className="verify-form">
              <input
                type="text"
                value={verifyCardId}
                onChange={(e) => setVerifyCardId(e.target.value)}
                placeholder="Card ID (e.g., a1b2c3d4)"
                className="input-field"
              />
              <select
                value={winPattern}
                onChange={(e) => setWinPattern(e.target.value as WinPattern)}
                className="select-field"
              >
                <option value="line">Line</option>
                <option value="full-house">Full House</option>
                <option value="four-corners">4 Corners</option>
                <option value="x-pattern">X Pattern</option>
              </select>
              <button className="btn btn-primary" onClick={handleVerifyBingo}>
                Verify
              </button>
            </div>

            {verifyResult && (
              <div className={`verify-result ${verifyResult.found ? (verifyResult.hasBingo ? 'bingo' : 'no-bingo') : 'not-found'}`}>
                {!verifyResult.found ? (
                  <p>Card not found</p>
                ) : (
                  <>
                    <div className="result-header">
                      {verifyResult.hasBingo ? (
                        <span className="result-bingo">BINGO!</span>
                      ) : (
                        <span className="result-no">No Bingo</span>
                      )}
                    </div>
                    <div className="card-info">
                      <p><strong>ID:</strong> {verifyResult.card?.id}</p>
                      <p><strong>Owner:</strong> {verifyResult.card?.owner.slice(0, 10)}...</p>
                      <p><strong>Marked:</strong> {verifyResult.markedNumbers.length}</p>
                    </div>
                    <div className="card-preview">
                      <div className="preview-title">{verifyResult.card?.game_title}</div>
                      {verifyResult.card?.game_mode === '1-75' && (
                        <div className="preview-row">
                          {['B', 'I', 'N', 'G', 'O'].map(letter => (
                            <div key={letter} className="preview-cell header">{letter}</div>
                          ))}
                        </div>
                      )}
                      {verifyResult.card?.numbers.map((row, rowIdx) => (
                        <div key={rowIdx} className="preview-row">
                          {row.map((num, colIdx) => {
                            const isCalled = num !== null && calledNumbers.includes(num as number);
                            const isFree = num === null;
                            return (
                              <div key={colIdx} className={`preview-cell ${isCalled ? 'called' : ''} ${isFree ? 'free' : ''}`}>
                                {isFree ? 'FREE' : num}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Pending Claims */}
        <section className="claims-section">
          <div className="panel panel-claims">
            <div className="panel-header">
              <h3 className="panel-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                BINGO Claims
                {pendingClaims.length > 0 && (
                  <span className="claims-badge">{pendingClaims.length}</span>
                )}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={refreshClaims}>
                Refresh
              </button>
            </div>

            {pendingClaims.length === 0 ? (
              <div className="no-claims">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <p>No pending claims</p>
              </div>
            ) : (
              <div className="claims-list">
                {pendingClaims.map((claim) => (
                  <div key={claim.id} className="claim-card">
                    <div className="claim-header">
                      <span className="claim-time">
                        {new Date(claim.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="claim-pattern">{claim.pattern}</span>
                    </div>
                    <div className="claim-info">
                      <div className="claim-row">
                        <span className="claim-label">Card:</span>
                        <span className="claim-value">{claim.cardId.slice(0, 8)}...</span>
                      </div>
                      <div className="claim-row">
                        <span className="claim-label">Wallet:</span>
                        <span className="claim-value">{claim.walletAddress.slice(0, 6)}...{claim.walletAddress.slice(-4)}</span>
                      </div>
                      <div className="claim-row">
                        <span className="claim-label">Marked:</span>
                        <span className="claim-value">{claim.markedNumbers.length} numbers</span>
                      </div>
                    </div>
                    <div className="claim-preview">
                      <div className="preview-mini">
                        <div className="preview-row">
                          {['B', 'I', 'N', 'G', 'O'].map(letter => (
                            <div key={letter} className="preview-cell header mini">{letter}</div>
                          ))}
                        </div>
                        {claim.cardNumbers.map((row, rowIdx) => (
                          <div key={rowIdx} className="preview-row">
                            {row.map((num, colIdx) => {
                              const isFree = num === null;
                              const isMarked = num !== null && claim.markedNumbers.includes(num);
                              const isCalled = num !== null && calledNumbers.includes(num);
                              return (
                                <div
                                  key={colIdx}
                                  className={`preview-cell mini ${isFree ? 'free' : ''} ${isMarked ? 'marked' : ''} ${isCalled && !isMarked ? 'called' : ''}`}
                                >
                                  {isFree ? '★' : num}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="claim-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleVerifyClaim(claim.id)}
                        disabled={processingClaim === claim.id}
                      >
                        {processingClaim === claim.id ? '...' : '✓ Verify'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleRejectClaim(claim.id)}
                        disabled={processingClaim === claim.id}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Registered Cards */}
        <section className="cards-section">
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Registered Cards ({registeredCards.length})</h3>
              <div className="panel-actions">
                <button className="btn btn-sm btn-secondary" onClick={refreshCards}>
                  {isLoading ? 'Loading...' : 'Refresh'}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowCardsList(!showCardsList)}>
                  {showCardsList ? 'Hide' : 'Show'}
                </button>
                {registeredCards.length > 0 && (
                  <button className="btn btn-sm btn-danger" onClick={handleClearRegistry}>
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {showCardsList && (
              <div className="cards-list">
                {registeredCards.length === 0 ? (
                  <p className="empty-text">No cards registered</p>
                ) : (
                  <table className="cards-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Owner</th>
                        <th>Mode</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registeredCards.map((card) => (
                        <tr key={card.id}>
                          <td className="mono">{card.id.slice(0, 8)}</td>
                          <td>{card.owner.slice(0, 10)}...</td>
                          <td>{card.game_mode}</td>
                          <td>{new Date(card.purchased_at).toLocaleDateString()}</td>
                          <td>
                            <button className="btn btn-sm btn-ghost" onClick={() => setVerifyCardId(card.id.slice(0, 8))}>
                              Check
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
        .admin {
          min-height: 100vh;
        }

        /* Header */
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 10, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
        }

        .header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-4) var(--space-6);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          text-decoration: none;
          color: inherit;
        }

        .brand:hover {
          opacity: 0.9;
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
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .admin-badge {
          background: var(--uv-violet);
          color: white;
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .game-name-input {
          width: 180px;
        }

        /* Main */
        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        /* Control Panel */
        .control-panel {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
        }

        .control-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .mode-toggle {
          display: flex;
          gap: var(--space-2);
        }

        .toggle-btn {
          padding: var(--space-2) var(--space-4);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-family: inherit;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .toggle-btn:hover:not(:disabled) {
          border-color: var(--border-strong);
        }

        .toggle-btn.active {
          background: var(--uv-violet);
          border-color: var(--uv-violet);
          color: white;
        }

        .toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .game-actions {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          font-size: 0.9rem;
          font-weight: 500;
          font-family: inherit;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-sm {
          padding: var(--space-2) var(--space-3);
          font-size: 0.85rem;
        }

        .btn-primary {
          background: var(--uv-violet);
          color: white;
        }

        .btn-primary:hover {
          background: var(--uv-violet-light);
        }

        .btn-start {
          background: var(--color-success);
          color: white;
        }

        .btn-start:hover {
          filter: brightness(1.1);
        }

        .btn-call {
          background: var(--uv-violet);
          color: white;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--uv-violet-glow); }
          50% { box-shadow: 0 0 0 8px transparent; }
        }

        .btn-secondary {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-default);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-warning {
          background: transparent;
          color: var(--color-warning);
          border: 1px solid var(--color-warning);
        }

        .btn-warning:hover {
          background: var(--color-warning);
          color: var(--bg-primary);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-muted);
        }

        .btn-ghost:hover {
          color: var(--text-primary);
          background: var(--border-subtle);
        }

        .btn-danger {
          background: transparent;
          color: var(--color-error);
          border: 1px solid var(--color-error);
        }

        .btn-danger:hover {
          background: var(--color-error);
          color: white;
        }

        .stats {
          display: flex;
          align-items: baseline;
          gap: var(--space-1);
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-success);
        }

        .stat-label {
          color: var(--text-muted);
        }

        /* Current Section */
        .current-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
        }

        .current-ball {
          width: 160px;
          height: 160px;
          background: var(--bg-tertiary);
          border: 3px solid var(--border-default);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .current-ball.active {
          background: var(--uv-violet);
          border-color: var(--uv-violet-light);
          box-shadow: var(--shadow-glow);
          animation: bounce 0.4s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .ball-letter {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
        }

        .ball-number {
          font-size: 3.5rem;
          font-weight: 700;
          color: white;
          line-height: 1;
        }

        .ball-waiting {
          font-size: 3.5rem;
          color: var(--text-disabled);
        }

        .last-called {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
        }

        .last-label {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .last-balls {
          display: flex;
          gap: var(--space-2);
        }

        .last-ball {
          background: var(--bg-elevated);
          color: var(--text-secondary);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          font-size: 0.85rem;
        }

        /* Board */
        .board-section .panel {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          overflow-x: auto;
        }

        .board-75, .board-90 {
          display: flex;
          gap: var(--space-3);
          justify-content: center;
        }

        .board-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .column-header {
          text-align: center;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--uv-violet-light);
          padding: var(--space-2);
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
        }

        .column-numbers {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .num-cell {
          width: 48px;
          height: 48px;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--bg-tertiary);
          color: var(--text-muted);
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .num-cell:hover:not(:disabled):not(.called) {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .num-cell.called {
          background: var(--color-success);
          color: white;
        }

        .num-cell.current {
          background: var(--uv-violet);
          color: white;
          animation: glow 1.5s infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 4px var(--uv-violet-glow); }
          50% { box-shadow: 0 0 16px var(--uv-violet-glow); }
        }

        .num-cell:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* Panel */
        .panel {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
          gap: var(--space-3);
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 var(--space-4) 0;
        }

        .panel-title svg {
          color: var(--uv-violet-light);
        }

        .panel-actions {
          display: flex;
          gap: var(--space-2);
        }

        /* History */
        .history-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .history-item {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: 0.85rem;
        }

        .empty-text {
          color: var(--text-muted);
          text-align: center;
          padding: var(--space-4);
        }

        /* Verify */
        .panel-verify {
          border-color: var(--color-success);
        }

        .verify-form {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          margin-bottom: var(--space-4);
        }

        .verify-form .input-field {
          flex: 1;
          min-width: 200px;
        }

        .verify-result {
          padding: var(--space-4);
          border-radius: var(--radius-md);
          margin-top: var(--space-4);
        }

        .verify-result.not-found {
          background: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
        }

        .verify-result.bingo {
          background: var(--color-success-bg);
          border: 1px solid var(--color-success);
        }

        .verify-result.no-bingo {
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
        }

        .result-header {
          text-align: center;
          margin-bottom: var(--space-3);
        }

        .result-bingo {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-success);
        }

        .result-no {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-warning);
        }

        .card-info {
          margin-bottom: var(--space-4);
          color: var(--text-secondary);
        }

        .card-info p {
          margin: var(--space-1) 0;
        }

        .card-preview {
          display: inline-block;
          background: var(--bg-primary);
          padding: var(--space-3);
          border-radius: var(--radius-md);
        }

        .preview-title {
          text-align: center;
          font-weight: 600;
          color: var(--uv-violet-light);
          margin-bottom: var(--space-2);
        }

        .preview-row {
          display: flex;
          gap: 2px;
        }

        .preview-row + .preview-row {
          margin-top: 2px;
        }

        .preview-cell {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          border-radius: 3px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .preview-cell.header {
          background: var(--uv-violet);
          color: white;
        }

        .preview-cell.called {
          background: var(--color-success);
          color: white;
        }

        .preview-cell.free {
          background: var(--color-warning);
          color: var(--bg-primary);
          font-size: 0.6rem;
        }

        /* Claims Section */
        .claims-section {
          margin-top: var(--space-6);
        }

        .panel-claims {
          border-color: var(--color-warning);
        }

        .claims-badge {
          background: var(--color-error);
          color: white;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          margin-left: var(--space-2);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .no-claims {
          text-align: center;
          padding: var(--space-6);
          color: var(--text-muted);
        }

        .no-claims svg {
          margin-bottom: var(--space-3);
        }

        .claims-list {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          margin-top: var(--space-4);
        }

        .claim-card {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }

        .claim-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .claim-time {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .claim-pattern {
          background: var(--uv-violet);
          color: white;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .claim-info {
          margin-bottom: var(--space-3);
        }

        .claim-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--space-1);
        }

        .claim-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .claim-value {
          font-size: 0.85rem;
          font-family: var(--font-mono);
          color: var(--text-secondary);
        }

        .claim-preview {
          margin-bottom: var(--space-3);
        }

        .preview-mini {
          display: inline-block;
        }

        .preview-cell.mini {
          width: 24px;
          height: 24px;
          font-size: 0.55rem;
        }

        .preview-cell.marked {
          background: var(--color-success);
          color: white;
        }

        .claim-actions {
          display: flex;
          gap: var(--space-2);
        }

        .claim-actions .btn {
          flex: 1;
          padding: var(--space-2);
          font-size: 0.85rem;
        }

        .btn-success {
          background: var(--color-success);
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #3ea14d;
        }

        .btn-danger {
          background: transparent;
          border: 1px solid var(--color-error);
          color: var(--color-error);
        }

        .btn-danger:hover:not(:disabled) {
          background: var(--color-error-bg);
        }

        /* Cards Table */
        .cards-list {
          margin-top: var(--space-4);
        }

        .cards-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cards-table th,
        .cards-table td {
          padding: var(--space-3);
          text-align: left;
          border-bottom: 1px solid var(--border-subtle);
        }

        .cards-table th {
          color: var(--text-muted);
          font-weight: 500;
          font-size: 0.85rem;
        }

        .cards-table td {
          color: var(--text-secondary);
        }

        .mono {
          font-family: var(--font-mono);
          color: var(--color-success) !important;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header-inner {
            flex-direction: column;
            align-items: flex-start;
          }

          .control-row {
            flex-direction: column;
            align-items: stretch;
          }

          .mode-toggle, .game-actions {
            justify-content: center;
          }

          .num-cell {
            width: 40px;
            height: 40px;
            font-size: 0.9rem;
          }

          .current-ball {
            width: 120px;
            height: 120px;
          }

          .ball-number {
            font-size: 2.5rem;
          }
        }
      `}</style>
    </div>
  );
}
