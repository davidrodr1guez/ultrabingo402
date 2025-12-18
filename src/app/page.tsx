'use client';

import { useState, useRef } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import {
  generateMultipleCards,
  BingoCard as BingoCardType,
  GameMode,
} from '@/lib/bingo';
import { registerCards } from '@/lib/cardRegistry';
import { useX402Payment } from '@/hooks/useX402Payment';

const PAYMENT_RECIPIENT = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x97a3935fBF2d4ac9437dc10e62722D1549C8C43A';
const PRICE_PER_CARD = 0.01;
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function Home() {
  const { isConnected, address } = useAccount();
  const { createPayment, isProcessing: isSigningPayment } = useX402Payment();
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const gameMode: GameMode = '1-75'; // Fixed to 75-ball mode
  const [cardCount, setCardCount] = useState(1);
  const [gameTitle, setGameTitle] = useState('BINGO');
  const [isPaid, setIsPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(newCards);
    setIsPaid(false);
  };

  const handleAddMore = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(prev => [...prev, ...newCards]);
    setIsPaid(false);
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(card => card.id !== id));
  };

  const handleClearAll = () => {
    setCards([]);
    setIsPaid(false);
  };

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

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
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
            <ConnectKitButton />
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
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
                  /* Demo Mode - Skip payment */
                  <div className="demo-flow">
                    <div className="demo-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Demo Mode
                    </div>
                    {!isPaid ? (
                      <button
                        className="btn btn-primary btn-lg btn-full"
                        onClick={() => setIsPaid(true)}
                      >
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
              /* Preview state - cards generated but not paid */
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
              /* Paid state - show actual cards */
              <>
                <div className="cards-header">
                  <h2>Your Cards</h2>
                  <span className="cards-badge">{cards.length}</span>
                </div>
                <div className="cards-grid" ref={printRef}>
                  {cards.map((card, index) => (
                    <div key={card.id} className="card-wrapper">
                      <div className="card-actions">
                        <span className="card-index">#{index + 1}</span>
                      </div>
                      <div id={`card-${card.id}`}>
                        <BingoCardDisplay card={card} mode={gameMode} title={gameTitle} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

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

        .toggle-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
        }

        .toggle-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: inherit;
          font-size: 0.85rem;
        }

        .toggle-btn:hover {
          border-color: var(--border-strong);
        }

        .toggle-btn.active {
          background: var(--uv-violet);
          border-color: var(--uv-violet);
          color: white;
        }

        .toggle-icon {
          font-size: 1.25rem;
          font-weight: 700;
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

        /* Demo Mode */
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

        /* ========== Preview State (Before Payment) ========== */
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

        .cards-badge {
          background: var(--uv-violet);
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
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
          transition: transform var(--transition-fast), box-shadow var(--transition-fast);
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

        .card-remove {
          width: 24px;
          height: 24px;
          background: var(--color-error-bg);
          border: none;
          border-radius: var(--radius-sm);
          color: var(--color-error);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          opacity: 0.6;
        }

        .card-wrapper:hover .card-remove {
          opacity: 1;
        }

        .card-remove:hover {
          background: var(--color-error);
          color: white;
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
        }

        /* ========== Print ========== */
        @media print {
          .header, .panel-config, .cards-header, .card-actions, .footer {
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
          }
        }

        .text-error {
          color: var(--color-error);
        }
      `}</style>
    </div>
  );
}

/* ========== Bingo Card Component ========== */
function BingoCardDisplay({
  card,
  mode,
  title,
}: {
  card: BingoCardType;
  mode: GameMode;
  title: string;
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
          {row.map((number, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`bingo-cell ${number === null ? 'free-cell' : ''}`}
            >
              {number === null ? 'FREE' : number}
            </div>
          ))}
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
        }

        .mode-75 .bingo-cell {
          min-height: 42px;
        }

        .mode-90 .bingo-cell {
          min-height: 36px;
          font-size: 0.85rem;
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
        }
      `}</style>
    </div>
  );
}
