'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import {
  generateMultipleCards,
  BingoCard as BingoCardType,
  GameMode,
  validateBingo,
  WinPattern,
} from '@/lib/bingo';
import { registerCards } from '@/lib/cardRegistry';
import { useX402Payment } from '@/hooks/useX402Payment';

const PAYMENT_RECIPIENT = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x97a3935fBF2d4ac9437dc10e62722D1549C8C43A';
const PRICE_PER_CARD = 0.01;
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

interface GameState {
  id: string;
  name: string;
  status: string;
  called_numbers: number[];
  mode: string;
}

export default function Home() {
  const { isConnected, address } = useAccount();
  const { createPayment, isProcessing: isSigningPayment } = useX402Payment();
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const gameMode: GameMode = '1-75';
  const [cardCount, setCardCount] = useState(1);
  const [gameTitle, setGameTitle] = useState('BINGO');
  const [isPaid, setIsPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showHero, setShowHero] = useState(true);
  const [markedNumbers, setMarkedNumbers] = useState<Record<string, Set<number>>>({});
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [winPattern, setWinPattern] = useState<WinPattern>('line');
  const [bingoCards, setBingoCards] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  // Poll for active game
  useEffect(() => {
    if (!isPaid) return;

    const pollGame = async () => {
      try {
        const res = await fetch('/api/games?active=true');
        const data = await res.json();
        if (data.game) {
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
  }, [isPaid]);

  // Check for BINGO when numbers change
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

    // Trigger confetti for new BINGO
    const newBingoArray = Array.from(newBingoCards);
    for (const id of newBingoArray) {
      if (!bingoCards.has(id)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        break;
      }
    }

    setBingoCards(newBingoCards);
  }, [markedNumbers, cards, winPattern, bingoCards]);

  // Card reveal animation
  useEffect(() => {
    if (!isPaid || cards.length === 0) return;

    cards.forEach((card, index) => {
      setTimeout(() => {
        setRevealedCards(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(card.id);
          return newSet;
        });
      }, index * 150);
    });
  }, [isPaid, cards]);

  const handleGenerate = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(newCards);
    setIsPaid(false);
    setShowHero(false);
    setMarkedNumbers({});
    setBingoCards(new Set());
    setRevealedCards(new Set());
  };

  const handleAddMore = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(prev => [...prev, ...newCards]);
    setIsPaid(false);
  };

  const handleClearAll = () => {
    setCards([]);
    setIsPaid(false);
    setMarkedNumbers({});
    setBingoCards(new Set());
    setRevealedCards(new Set());
  };

  const handleMarkNumber = useCallback((cardId: string, number: number) => {
    if (!isPaid || number === null) return;

    setMarkedNumbers(prev => {
      const cardMarks = new Set(prev[cardId] || []);
      if (cardMarks.has(number)) {
        cardMarks.delete(number);
      } else {
        cardMarks.add(number);
      }
      return { ...prev, [cardId]: cardMarks };
    });
  }, [isPaid]);

  const handlePayment = async () => {
    if (!isConnected) return;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const totalAmount = (cards.length * PRICE_PER_CARD).toFixed(2);
      const paymentResult = await createPayment(PAYMENT_RECIPIENT, totalAmount);

      if (!paymentResult.success || !paymentResult.payload) {
        setPaymentError(paymentResult.error || 'Failed to sign payment');
        return;
      }

      const response = await fetch('/api/pay-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': paymentResult.payload,
        },
        body: JSON.stringify({
          cards: cards.map(c => ({ id: c.id, numbers: c.numbers })),
          cardCount: cards.length,
          walletAddress: address,
          gameMode,
          gameTitle,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        registerCards(cards, address || 'anonymous', gameMode, gameTitle);
        setIsPaid(true);
      } else {
        setPaymentError(data.error || data.details || 'Payment failed');
      }
    } catch (error: any) {
      setPaymentError(error.message || 'Error processing payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!isPaid || cards.length === 0) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const cardsPerPage = 4;

    for (let i = 0; i < cards.length; i++) {
      const cardElement = document.getElementById(`card-${cards[i].id}`);
      if (!cardElement) continue;

      const canvas = await html2canvas(cardElement, { scale: 2, backgroundColor: '#0a0a0a' });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 90;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const col = i % 2;
      const row = Math.floor((i % cardsPerPage) / 2);
      const x = 10 + col * 100;
      const y = 10 + row * (imgHeight + 10);

      if (i > 0 && i % cardsPerPage === 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    }
    pdf.save(`${gameTitle.replace(/\s+/g, '_')}_bingo_cards.pdf`);
  };

  const handlePrint = () => {
    if (!isPaid) return;
    window.print();
  };

  const totalPrice = cards.length * PRICE_PER_CARD;
  const currentNumber = activeGame?.called_numbers?.slice(-1)[0] || null;
  const calledNumbers = activeGame?.called_numbers || [];

  return (
    <div className="app">
      {/* Confetti */}
      {showConfetti && <Confetti />}

      {/* Animated Background */}
      <div className="bg-animation">
        <div className="bg-gradient" />
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand" onClick={() => setShowHero(true)} style={{ cursor: 'pointer' }}>
            <div className="brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="brand-name">UltraBingo</span>
            <span className="brand-badge">by UltravioletaDAO</span>
          </div>
          <div className="header-actions">
            {activeGame && (
              <div className="live-indicator">
                <span className="live-dot" />
                <span>LIVE</span>
              </div>
            )}
            <a href="/admin" className="admin-link" title="Admin Panel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </a>
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {showHero && cards.length === 0 && (
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Powered by x402 Protocol
            </div>
            <h1 className="hero-title">
              Play <span className="gradient-text">Bingo</span> on Base
            </h1>
            <p className="hero-subtitle">
              Create unique bingo cards, pay with USDC, and play in real-time.
              Secure, fast, and decentralized.
            </p>
            <div className="hero-cta">
              <button className="btn btn-hero" onClick={() => setShowHero(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Playing
              </button>
              <a href="#how-it-works" className="btn btn-secondary">
                How it works
              </a>
            </div>
            <div className="hero-features">
              <div className="feature">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span>Secure Payments</span>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <span>Real-time Play</span>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </div>
                <span>Download & Print</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-card-header">
                {['B', 'I', 'N', 'G', 'O'].map(l => (
                  <span key={l} className="hero-letter">{l}</span>
                ))}
              </div>
              <div className="hero-card-grid">
                {[...Array(25)].map((_, i) => (
                  <span
                    key={i}
                    className={`hero-cell ${i === 12 ? 'free' : ''} ${[0, 6, 18, 24].includes(i) ? 'marked' : ''}`}
                  >
                    {i === 12 ? 'FREE' : Math.floor(Math.random() * 15) + 1 + Math.floor(i / 5) * 15}
                  </span>
                ))}
              </div>
            </div>
            <div className="hero-glow" />
          </div>
        </section>
      )}

      {/* Live Game Bar */}
      {activeGame && isPaid && (
        <div className="live-bar">
          <div className="live-bar-inner">
            <div className="live-game-info">
              <span className="live-badge">
                <span className="live-dot" />
                LIVE GAME
              </span>
              <span className="game-name">{activeGame.name}</span>
            </div>
            <div className="current-call">
              {currentNumber ? (
                <>
                  <span className="call-label">Current:</span>
                  <span className="call-number">
                    {getBingoLetter(currentNumber)}-{currentNumber}
                  </span>
                </>
              ) : (
                <span className="call-waiting">Waiting for first call...</span>
              )}
            </div>
            <div className="called-count">
              {calledNumbers.length} / 75 called
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className={`container ${showHero && cards.length === 0 ? 'hidden' : ''}`}>
          {/* Left Panel - Configuration */}
          <aside className="panel panel-config">
            <div className="panel-section">
              <div className="section-header">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </span>
                <h2 className="section-title">Create Cards</h2>
              </div>

              <div className="form-group">
                <label className="label">Card Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  placeholder="Enter title..."
                />
              </div>

              <div className="form-group">
                <label className="label">Number of Cards</label>
                <select
                  className="select-field"
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                >
                  {[1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 30].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'card' : 'cards'}</option>
                  ))}
                </select>
              </div>

              <button className="btn btn-primary btn-lg btn-full" onClick={handleGenerate}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Generate Cards
              </button>

              {cards.length > 0 && (
                <div className="secondary-actions">
                  <button className="btn btn-secondary btn-full" onClick={handleAddMore}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add More
                  </button>
                  <button className="btn btn-ghost text-error" onClick={handleClearAll}>
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Payment Section */}
            {cards.length > 0 && (
              <div className="panel-section panel-payment">
                <div className="section-header">
                  <span className="section-icon icon-success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </span>
                  <h2 className="section-title">Download</h2>
                </div>

                <div className="price-display">
                  <div className="price-label">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</div>
                  <div className="price-value">${totalPrice.toFixed(2)} <span className="price-currency">USDC</span></div>
                </div>

                {DEMO_MODE ? (
                  <div className="demo-flow">
                    <div className="demo-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Demo Mode
                    </div>
                    {!isPaid ? (
                      <button className="btn btn-primary btn-lg btn-full" onClick={() => setIsPaid(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                        </svg>
                        Reveal Cards (Demo)
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-lg btn-full" onClick={handleDownloadPDF}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                          Download PDF
                        </button>
                        <button className="btn btn-secondary btn-full" onClick={handlePrint}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                          Print
                        </button>
                      </>
                    )}
                    <p className="demo-note">Payment disabled for testing</p>
                  </div>
                ) : !isConnected ? (
                  <div className="connect-cta">
                    <p className="text-muted">Connect wallet to continue</p>
                    <ConnectKitButton />
                  </div>
                ) : !isPaid ? (
                  <div className="payment-flow">
                    {paymentError && (
                      <div className="alert alert-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4M12 16h.01" />
                        </svg>
                        {paymentError}
                      </div>
                    )}
                    <button
                      className="btn btn-pay btn-lg btn-full"
                      onClick={handlePayment}
                      disabled={isProcessingPayment || isSigningPayment}
                    >
                      {isProcessingPayment || isSigningPayment ? (
                        <>
                          <span className="spinner" />
                          {isSigningPayment ? 'Confirm in wallet...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          Pay ${totalPrice.toFixed(2)} USDC
                        </>
                      )}
                    </button>
                    <p className="payment-info">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      x402 Protocol on Base Network
                    </p>
                  </div>
                ) : (
                  <div className="download-flow">
                    <div className="success-indicator">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>Payment confirmed</span>
                    </div>
                    <button className="btn btn-primary btn-lg btn-full" onClick={handleDownloadPDF}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download PDF
                    </button>
                    <button className="btn btn-secondary btn-full" onClick={handlePrint}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Print
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Win Pattern Selector (when playing) */}
            {isPaid && (
              <div className="panel-section">
                <div className="section-header">
                  <span className="section-icon icon-game">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                  </span>
                  <h2 className="section-title">Win Pattern</h2>
                </div>
                <div className="pattern-selector">
                  {[
                    { value: 'line', label: 'Any Line', icon: '━' },
                    { value: 'full-house', label: 'Full House', icon: '▣' },
                    { value: 'four-corners', label: '4 Corners', icon: '◰' },
                    { value: 'x-pattern', label: 'X Pattern', icon: '╳' },
                  ].map(p => (
                    <button
                      key={p.value}
                      className={`pattern-btn ${winPattern === p.value ? 'active' : ''}`}
                      onClick={() => setWinPattern(p.value as WinPattern)}
                    >
                      <span className="pattern-icon">{p.icon}</span>
                      <span className="pattern-label">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Right Panel - Cards Display */}
          <section className="panel panel-cards">
            {cards.length === 0 ? (
              <div className="empty-state">
                <div className="empty-visual">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </div>
                  <div className="empty-glow" />
                </div>
                <h2>No cards generated</h2>
                <p>Configure your options and generate your first bingo card.</p>
              </div>
            ) : !isPaid ? (
              <div className="preview-state">
                <div className="preview-visual">
                  <div className="preview-cards-stack">
                    {[...Array(Math.min(cards.length, 4))].map((_, i) => (
                      <div key={i} className="preview-card" style={{ '--index': i } as React.CSSProperties}>
                        <div className="preview-card-header">
                          {['B', 'I', 'N', 'G', 'O'].map(l => (
                            <span key={l} className="preview-letter">{l}</span>
                          ))}
                        </div>
                        <div className="preview-card-grid">
                          {[...Array(25)].map((_, j) => (
                            <span key={j} className="preview-cell" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="preview-glow" />
                </div>
                <div className="preview-info">
                  <div className="preview-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </div>
                  <h2>{cards.length} {cards.length === 1 ? 'Card' : 'Cards'} Ready</h2>
                  <p>Complete payment to reveal and download your unique bingo cards.</p>
                  <div className="preview-features">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg> Unique numbers</span>
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg> PDF download</span>
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg> Print ready</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="cards-header">
                  <h2>Your Cards</h2>
                  <div className="cards-header-right">
                    {bingoCards.size > 0 && (
                      <span className="bingo-alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        BINGO!
                      </span>
                    )}
                    <span className="cards-badge">{cards.length}</span>
                  </div>
                </div>
                <div className="cards-instructions">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  Click numbers to mark them as called
                </div>
                <div className="cards-grid" ref={printRef}>
                  {cards.map((card, index) => (
                    <div
                      key={card.id}
                      className={`card-wrapper ${revealedCards.has(card.id) ? 'revealed' : ''} ${bingoCards.has(card.id) ? 'has-bingo' : ''}`}
                    >
                      <div className="card-actions">
                        <span className="card-index">#{index + 1}</span>
                        {bingoCards.has(card.id) && (
                          <span className="card-bingo-badge">BINGO!</span>
                        )}
                      </div>
                      <div id={`card-${card.id}`}>
                        <BingoCardDisplay
                          card={card}
                          mode={gameMode}
                          title={gameTitle}
                          markedNumbers={markedNumbers[card.id] || new Set()}
                          calledNumbers={calledNumbers}
                          onMarkNumber={(num) => handleMarkNumber(card.id, num)}
                          interactive={true}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* How It Works Section */}
      {showHero && cards.length === 0 && (
        <section id="how-it-works" className="how-it-works">
          <div className="section-container">
            <h2 className="section-heading">How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <h3>Generate Cards</h3>
                <p>Choose how many bingo cards you want and generate unique combinations.</p>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <h3>Pay with USDC</h3>
                <p>Secure payment using x402 protocol on Base network. Fast and low fees.</p>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <h3>Play Live</h3>
                <p>Join a live game, mark your numbers, and win prizes!</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <span>UltraBingo</span>
          <span className="footer-sep">•</span>
          <a href="https://ultravioletadao.xyz" target="_blank" rel="noopener noreferrer">UltravioletaDAO</a>
          <span className="footer-sep">•</span>
          <a href="https://base.org" target="_blank" rel="noopener noreferrer">Base Network</a>
          <span className="footer-sep">•</span>
          <a href="https://x402.org" target="_blank" rel="noopener noreferrer">x402</a>
        </div>
      </footer>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* ========== Animated Background ========== */
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
          opacity: 0.4;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 600px;
          height: 600px;
          background: var(--uv-violet);
          top: -200px;
          right: -200px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          background: #4a00b0;
          bottom: -100px;
          left: -100px;
          animation-delay: -7s;
        }

        .orb-3 {
          width: 300px;
          height: 300px;
          background: #8b00ff;
          top: 50%;
          left: 50%;
          animation-delay: -14s;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -30px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(20px, 10px) scale(1.02); }
        }

        /* ========== Header ========== */
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
        }

        .header-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: var(--space-4) var(--space-6);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
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

        .brand-badge {
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: var(--space-1) var(--space-2);
          background: var(--border-subtle);
          border-radius: var(--radius-full);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .live-indicator {
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
          animation: pulse-dot 1.5s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .admin-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          transition: all var(--transition-fast);
        }

        .admin-link:hover {
          background: var(--bg-elevated);
          border-color: var(--uv-violet);
          color: var(--uv-violet-light);
        }

        /* ========== Hero Section ========== */
        .hero {
          padding: var(--space-12) var(--space-6);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-12);
          max-width: 1200px;
          margin: 0 auto;
          min-height: 70vh;
        }

        .hero-content {
          flex: 1;
          max-width: 540px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--uv-violet-glow);
          border: 1px solid var(--uv-violet);
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          color: var(--uv-violet-light);
          margin-bottom: var(--space-6);
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: var(--space-4);
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--uv-violet-light) 0%, #a855f7 50%, var(--uv-violet) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.125rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: var(--space-8);
        }

        .hero-cta {
          display: flex;
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .btn-hero {
          background: linear-gradient(135deg, var(--uv-violet) 0%, var(--uv-violet-dark) 100%);
          color: white;
          padding: var(--space-4) var(--space-6);
          font-size: 1rem;
          font-weight: 600;
          box-shadow: var(--shadow-glow);
        }

        .btn-hero:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 30px var(--uv-violet-glow);
        }

        .hero-features {
          display: flex;
          gap: var(--space-6);
        }

        .feature {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .feature-icon {
          width: 32px;
          height: 32px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--uv-violet-light);
        }

        .feature-icon svg {
          width: 16px;
          height: 16px;
        }

        .hero-visual {
          position: relative;
          flex-shrink: 0;
        }

        .hero-card {
          width: 280px;
          background: var(--bg-card);
          border: 2px solid var(--uv-violet);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          transform: rotate(3deg);
          animation: hero-float 6s ease-in-out infinite;
        }

        @keyframes hero-float {
          0%, 100% { transform: rotate(3deg) translateY(0); }
          50% { transform: rotate(3deg) translateY(-10px); }
        }

        .hero-card-header {
          display: flex;
          gap: 4px;
          margin-bottom: var(--space-2);
        }

        .hero-letter {
          flex: 1;
          height: 36px;
          background: var(--uv-violet);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          color: white;
        }

        .hero-card-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
        }

        .hero-cell {
          aspect-ratio: 1;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .hero-cell.free {
          background: var(--uv-violet);
          color: white;
          font-size: 0.6rem;
        }

        .hero-cell.marked {
          background: var(--color-success);
          color: white;
        }

        .hero-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 400px;
          height: 400px;
          background: var(--uv-violet);
          filter: blur(120px);
          opacity: 0.3;
          z-index: -1;
        }

        /* ========== Live Bar ========== */
        .live-bar {
          background: linear-gradient(90deg, var(--uv-violet-dark) 0%, var(--uv-violet) 50%, var(--uv-violet-dark) 100%);
          border-bottom: 1px solid var(--uv-violet);
        }

        .live-bar-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: var(--space-3) var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .live-game-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-3);
          background: rgba(255,255,255,0.1);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
        }

        .game-name {
          color: white;
          font-weight: 500;
        }

        .current-call {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .call-label {
          color: rgba(255,255,255,0.7);
          font-size: 0.85rem;
        }

        .call-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          background: rgba(255,255,255,0.2);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-md);
        }

        .call-waiting {
          color: rgba(255,255,255,0.7);
          font-size: 0.85rem;
        }

        .called-count {
          color: rgba(255,255,255,0.7);
          font-size: 0.85rem;
        }

        /* ========== Main Layout ========== */
        .main {
          flex: 1;
          padding: var(--space-6);
        }

        .container {
          max-width: 1440px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: var(--space-6);
        }

        .container.hidden {
          display: none;
        }

        /* ========== Panels ========== */
        .panel {
          background: var(--bg-card);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
        }

        .panel-config {
          height: fit-content;
          position: sticky;
          top: calc(64px + var(--space-6));
        }

        .panel-section {
          padding: var(--space-6);
        }

        .panel-section + .panel-section {
          border-top: 1px solid var(--border-subtle);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-5);
        }

        .section-icon {
          width: 28px;
          height: 28px;
          background: var(--uv-violet-glow);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--uv-violet-light);
        }

        .section-icon svg {
          width: 16px;
          height: 16px;
        }

        .section-icon.icon-success {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .section-icon.icon-game {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .section-title {
          font-size: 1rem;
          font-weight: 600;
        }

        /* ========== Form ========== */
        .form-group {
          margin-bottom: var(--space-5);
        }

        .label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }

        .secondary-actions {
          margin-top: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        /* ========== Payment ========== */
        .panel-payment {
          background: linear-gradient(180deg, rgba(106, 0, 255, 0.05) 0%, transparent 100%);
        }

        .price-display {
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          margin-bottom: var(--space-5);
          text-align: center;
        }

        .price-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: var(--space-1);
        }

        .price-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .price-currency {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .connect-cta {
          text-align: center;
        }

        .connect-cta p {
          margin-bottom: var(--space-3);
          font-size: 0.9rem;
        }

        .payment-flow {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .alert {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
        }

        .alert-error {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .btn-pay {
          background: linear-gradient(135deg, var(--uv-violet) 0%, var(--uv-violet-dark) 100%);
          color: white;
          font-weight: 600;
        }

        .btn-pay:hover:not(:disabled) {
          box-shadow: var(--shadow-glow);
        }

        .payment-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .demo-flow {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .demo-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 500;
        }

        .demo-note {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .download-flow {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .success-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--color-success-bg);
          color: var(--color-success);
          border-radius: var(--radius-md);
          font-weight: 500;
          font-size: 0.9rem;
        }

        /* ========== Pattern Selector ========== */
        .pattern-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
        }

        .pattern-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-3);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
        }

        .pattern-btn:hover {
          border-color: var(--border-strong);
        }

        .pattern-btn.active {
          background: var(--uv-violet);
          border-color: var(--uv-violet);
          color: white;
        }

        .pattern-icon {
          font-size: 1.25rem;
        }

        .pattern-label {
          font-size: 0.75rem;
        }

        /* ========== Cards Panel ========== */
        .panel-cards {
          min-height: 400px;
        }

        .empty-state {
          height: 100%;
          min-height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-8);
        }

        .empty-visual {
          position: relative;
          margin-bottom: var(--space-6);
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
          position: relative;
          z-index: 1;
        }

        .empty-icon svg {
          width: 40px;
          height: 40px;
        }

        .empty-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 120px;
          height: 120px;
          background: var(--uv-violet);
          filter: blur(60px);
          opacity: 0.3;
        }

        .empty-state h2 {
          font-size: 1.25rem;
          margin-bottom: var(--space-2);
        }

        .empty-state p {
          color: var(--text-muted);
          max-width: 280px;
        }

        /* ========== Preview State ========== */
        .preview-state {
          height: 100%;
          min-height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-8);
          gap: var(--space-6);
        }

        .preview-visual {
          position: relative;
        }

        .preview-cards-stack {
          position: relative;
          width: 160px;
          height: 180px;
        }

        .preview-card {
          position: absolute;
          width: 140px;
          background: var(--bg-tertiary);
          border: 2px solid var(--uv-violet);
          border-radius: var(--radius-md);
          padding: var(--space-2);
          transform: rotate(calc(var(--index) * -5deg)) translateY(calc(var(--index) * -8px));
          opacity: calc(1 - var(--index) * 0.15);
          left: calc(var(--index) * 8px);
        }

        .preview-card-header {
          display: flex;
          gap: 2px;
          margin-bottom: 4px;
        }

        .preview-letter {
          flex: 1;
          height: 20px;
          background: var(--uv-violet);
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-card-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
        }

        .preview-cell {
          aspect-ratio: 1;
          background: var(--bg-elevated);
          border-radius: 2px;
          position: relative;
        }

        .preview-cell::after {
          content: '?';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-disabled);
          font-size: 0.5rem;
          font-weight: 600;
        }

        .preview-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          background: var(--uv-violet);
          filter: blur(80px);
          opacity: 0.2;
          z-index: -1;
        }

        .preview-info {
          max-width: 320px;
        }

        .preview-badge {
          width: 48px;
          height: 48px;
          background: var(--uv-violet-glow);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--uv-violet-light);
          margin: 0 auto var(--space-4);
        }

        .preview-info h2 {
          font-size: 1.5rem;
          margin-bottom: var(--space-2);
        }

        .preview-info p {
          color: var(--text-muted);
          margin-bottom: var(--space-4);
        }

        .preview-features {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: var(--space-3);
        }

        .preview-features span {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .preview-features svg {
          color: var(--color-success);
        }

        .cards-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--border-subtle);
        }

        .cards-header h2 {
          font-size: 1.125rem;
        }

        .cards-header-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .bingo-alert {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-warning);
          color: var(--bg-primary);
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 700;
          animation: bingo-pulse 1s infinite;
        }

        @keyframes bingo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .cards-badge {
          background: var(--uv-violet);
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
        }

        .cards-instructions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--bg-tertiary);
          color: var(--text-muted);
          font-size: 0.85rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .cards-grid {
          padding: var(--space-5);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-5);
        }

        .card-wrapper {
          background: var(--bg-elevated);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          transition: all var(--transition-fast);
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }

        .card-wrapper.revealed {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .card-wrapper.has-bingo {
          border: 2px solid var(--color-warning);
          box-shadow: 0 0 20px rgba(255, 193, 7, 0.3);
        }

        .card-wrapper:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .card-index {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .card-bingo-badge {
          padding: var(--space-1) var(--space-2);
          background: var(--color-warning);
          color: var(--bg-primary);
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: var(--radius-sm);
        }

        /* ========== How It Works ========== */
        .how-it-works {
          padding: var(--space-12) var(--space-6);
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-subtle);
        }

        .section-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .section-heading {
          text-align: center;
          font-size: 2rem;
          margin-bottom: var(--space-10);
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-8);
        }

        .step {
          text-align: center;
        }

        .step-number {
          width: 48px;
          height: 48px;
          background: var(--uv-violet);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          margin: 0 auto var(--space-4);
        }

        .step h3 {
          font-size: 1.125rem;
          margin-bottom: var(--space-2);
        }

        .step p {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        /* ========== Footer ========== */
        .footer {
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
        }

        .footer-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: var(--space-4) var(--space-6);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .footer-sep {
          opacity: 0.3;
        }

        .footer a {
          color: var(--text-secondary);
        }

        .footer a:hover {
          color: var(--uv-violet-light);
        }

        /* ========== Responsive ========== */
        @media (max-width: 1024px) {
          .container {
            grid-template-columns: 1fr;
          }

          .panel-config {
            position: static;
          }

          .hero {
            flex-direction: column;
            text-align: center;
            padding: var(--space-8) var(--space-4);
            min-height: auto;
          }

          .hero-content {
            max-width: 100%;
          }

          .hero-cta {
            justify-content: center;
          }

          .hero-features {
            justify-content: center;
          }

          .steps {
            grid-template-columns: 1fr;
            gap: var(--space-6);
          }

          .live-bar-inner {
            flex-direction: column;
            text-align: center;
          }
        }

        @media (max-width: 640px) {
          .main {
            padding: var(--space-4);
          }

          .header-inner {
            padding: var(--space-3) var(--space-4);
          }

          .brand-badge {
            display: none;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .hero-features {
            flex-direction: column;
            gap: var(--space-3);
          }
        }

        /* ========== Print ========== */
        @media print {
          .header, .panel-config, .cards-header, .card-actions, .footer, .live-bar, .hero, .how-it-works, .cards-instructions, .bg-animation {
            display: none !important;
          }

          .main {
            padding: 0;
          }

          .container {
            display: block;
          }

          .panel-cards {
            border: none;
            background: transparent;
          }

          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10mm;
          }

          .card-wrapper {
            break-inside: avoid;
            box-shadow: none;
            border: 1px solid #ccc;
            opacity: 1;
            transform: none;
          }
        }

        .text-error {
          color: var(--color-error);
        }
      `}</style>
    </div>
  );
}

/* ========== Confetti Component ========== */
function Confetti() {
  return (
    <div className="confetti-container">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="confetti"
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

        .confetti {
          position: absolute;
          top: -10px;
          width: 10px;
          height: 10px;
          animation: confetti-fall 3s ease-out forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* ========== Helper Function ========== */
function getBingoLetter(num: number): string {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

/* ========== Bingo Card Component ========== */
function BingoCardDisplay({
  card,
  mode,
  title,
  markedNumbers,
  calledNumbers,
  onMarkNumber,
  interactive,
}: {
  card: BingoCardType;
  mode: GameMode;
  title: string;
  markedNumbers: Set<number>;
  calledNumbers: number[];
  onMarkNumber: (num: number) => void;
  interactive: boolean;
}) {
  const headers = mode === '1-75' ? ['B', 'I', 'N', 'G', 'O'] : null;
  const is75Mode = mode === '1-75';

  return (
    <div className={`bingo-card ${is75Mode ? 'mode-75' : 'mode-90'}`}>
      <div className="bingo-title">{title}</div>

      {headers && (
        <div className="bingo-row bingo-header">
          {headers.map((letter) => (
            <div key={letter} className="bingo-cell header-cell">{letter}</div>
          ))}
        </div>
      )}

      {card.numbers.map((row, rowIndex) => (
        <div key={rowIndex} className="bingo-row">
          {row.map((number, colIndex) => {
            const isFree = number === null;
            const numValue = typeof number === 'number' ? number : null;
            const isMarked = numValue !== null && markedNumbers.has(numValue);
            const isCalled = numValue !== null && calledNumbers.includes(numValue);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-cell ${isFree ? 'free-cell' : ''} ${isMarked ? 'marked-cell' : ''} ${isCalled && !isMarked ? 'called-cell' : ''} ${interactive && !isFree ? 'interactive' : ''}`}
                onClick={() => interactive && numValue !== null && onMarkNumber(numValue)}
              >
                {isFree ? 'FREE' : number}
                {isMarked && !isFree && <span className="mark-indicator">X</span>}
              </div>
            );
          })}
        </div>
      ))}

      <div className="bingo-id">{card.id.slice(0, 8)}</div>

      <style jsx>{`
        .bingo-card {
          background: var(--bg-primary);
          border: 2px solid var(--uv-violet);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          box-shadow: 0 0 0 1px rgba(106, 0, 255, 0.2);
        }

        .bingo-title {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--uv-violet-light);
          margin-bottom: var(--space-3);
          letter-spacing: 3px;
        }

        .bingo-row {
          display: flex;
          gap: 3px;
        }

        .bingo-row + .bingo-row {
          margin-top: 3px;
        }

        .bingo-cell {
          flex: 1;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          border-radius: var(--radius-sm);
          font-size: 0.95rem;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
          position: relative;
          transition: all var(--transition-fast);
        }

        .bingo-cell.interactive {
          cursor: pointer;
        }

        .bingo-cell.interactive:hover {
          background: var(--bg-elevated);
          border-color: var(--uv-violet);
        }

        .mode-75 .bingo-cell {
          min-height: 42px;
        }

        .header-cell {
          background: var(--uv-violet);
          color: white;
          font-size: 1.1rem;
          font-weight: 700;
          border: none;
        }

        .free-cell {
          background: linear-gradient(135deg, var(--uv-violet-dark) 0%, var(--uv-violet) 100%);
          color: white;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 1px;
          border: none;
        }

        .marked-cell {
          background: var(--color-success) !important;
          color: white !important;
          border-color: var(--color-success) !important;
        }

        .called-cell {
          background: var(--color-warning-bg);
          border-color: var(--color-warning);
          animation: called-pulse 2s infinite;
        }

        @keyframes called-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(255, 193, 7, 0); }
        }

        .mark-indicator {
          position: absolute;
          font-size: 1.5rem;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.9);
        }

        .bingo-id {
          text-align: center;
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: var(--space-2);
          font-family: var(--font-mono);
        }

        @media print {
          .bingo-card {
            background: white !important;
            border: 2px solid #6a00ff !important;
          }

          .bingo-cell {
            background: #f5f5f5 !important;
            color: #333 !important;
            border: 1px solid #ddd !important;
          }

          .header-cell {
            background: #6a00ff !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .free-cell {
            background: #6a00ff !important;
            color: white !important;
          }

          .marked-cell {
            background: #4caf50 !important;
            color: white !important;
          }
        }
      `}</style>
    </div>
  );
}
