'use client';

import { useState, useRef } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import {
  generateBingoCard,
  generateMultipleCards,
  BingoCard as BingoCardType,
  GameMode,
} from '@/lib/bingo';
import { registerCards } from '@/lib/cardRegistry';
import { useX402Payment } from '@/hooks/useX402Payment';
import { BINGO_THEMES, BingoTheme, DEFAULT_THEME } from '@/lib/themes';

// Payment recipient address
const PAYMENT_RECIPIENT = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x97a3935fBF2d4ac9437dc10e62722D1549C8C43A';
const PRICE_PER_CARD = 0.01; // $0.01 USDC per card (testing)

export default function Home() {
  const { isConnected, address } = useAccount();
  const { createPayment, isProcessing: isSigningPayment } = useX402Payment();
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [cardCount, setCardCount] = useState(1);
  const [gameTitle, setGameTitle] = useState('UltraBingo');
  const [selectedTheme, setSelectedTheme] = useState<BingoTheme>(DEFAULT_THEME);
  const [isPaid, setIsPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showCards, setShowCards] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    setShowCards(false);
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(newCards);
    setIsPaid(false);
    // Trigger animation after a brief delay
    setTimeout(() => setShowCards(true), 50);
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
    setShowCards(false);
    setCards([]);
    setIsPaid(false);
  };

  const handlePayment = async () => {
    if (!isConnected) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const totalAmount = (cards.length * PRICE_PER_CARD).toFixed(2);

      // Step 1: Create and sign the x402 payment
      console.log('Creating x402 payment for', totalAmount, 'USDC...');
      const paymentResult = await createPayment(PAYMENT_RECIPIENT, totalAmount);

      if (!paymentResult.success || !paymentResult.payload) {
        setPaymentError(paymentResult.error || 'Failed to sign payment');
        return;
      }

      console.log('Payment signed, submitting to server...');

      // Step 2: Submit payment to backend with the signed payload
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
        console.log('Payment confirmed!', data.transaction ? `TX: ${data.transaction}` : '');
        // Register cards after successful payment
        registerCards(cards, address || 'anonymous', gameMode, gameTitle);
        setIsPaid(true);
      } else {
        setPaymentError(data.error || data.details || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Error processing payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!isPaid || cards.length === 0) return;

    // Dynamic import for client-side only
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const cardsPerPage = 4;

    for (let i = 0; i < cards.length; i++) {
      const cardElement = document.getElementById(`card-${cards[i].id}`);
      if (!cardElement) continue;

      const canvas = await html2canvas(cardElement, {
        scale: 2,
        backgroundColor: '#1a1a2e',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 90;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const col = i % 2;
      const row = Math.floor((i % cardsPerPage) / 2);
      const x = 10 + col * 100;
      const y = 10 + row * (imgHeight + 10);

      if (i > 0 && i % cardsPerPage === 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    }

    pdf.save(`${gameTitle.replace(/\s+/g, '_')}_cartones.pdf`);
  };

  const handlePrint = () => {
    if (!isPaid) return;
    window.print();
  };

  const totalPrice = cards.length * PRICE_PER_CARD;

  return (
    <main className="main-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-container animate-fade-in-down">
            <Image
              src="/logo.svg"
              alt="UltraBingo"
              width={180}
              height={100}
              priority
            />
          </div>
          <div className="header-actions animate-fade-in-down stagger-2">
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title animate-fade-in-up">
            <span className="gradient-text-animated">Cartones de Bingo</span>
            <br />
            <span className="hero-subtitle-text">con Pagos Cripto</span>
          </h1>
          <p className="hero-description animate-fade-in-up stagger-2">
            Genera cartones personalizados y paga con USDC en Base Network.
            <br />
            Rápido, seguro y sin complicaciones.
          </p>
          <div className="hero-badges animate-fade-in-up stagger-3">
            <span className="badge badge-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Base Network
            </span>
            <span className="badge badge-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Pagos Instantáneos
            </span>
            <span className="badge badge-tertiary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              x402 Protocol
            </span>
          </div>
        </div>

        {/* Floating decoration */}
        <div className="hero-decoration">
          <div className="floating-orb orb-1 animate-float"></div>
          <div className="floating-orb orb-2 animate-float stagger-2"></div>
          <div className="floating-orb orb-3 animate-float stagger-4"></div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="section-title">¿Cómo Funciona?</h2>
        <div className="steps-grid">
          <div className="step-card animate-fade-in-up">
            <div className="step-number">1</div>
            <div className="step-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h3>Personaliza</h3>
            <p>Elige el modo de juego, tema y cantidad de cartones</p>
          </div>

          <div className="step-card animate-fade-in-up stagger-2">
            <div className="step-number">2</div>
            <div className="step-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h3>Genera</h3>
            <p>Crea cartones únicos con números aleatorios</p>
          </div>

          <div className="step-card animate-fade-in-up stagger-4">
            <div className="step-number">3</div>
            <div className="step-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3>Descarga</h3>
            <p>Paga con USDC y descarga tu PDF al instante</p>
          </div>
        </div>
      </section>

      {/* Control Panel */}
      <section className="control-section">
        <div className="control-panel glass">
          <div className="panel-header">
            <h2 className="panel-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Configuración
            </h2>
          </div>

          <div className="control-grid">
            <div className="control-group">
              <label>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Título del Juego
              </label>
              <input
                type="text"
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                placeholder="Nombre del juego"
                className="input-field"
              />
            </div>

            <div className="control-group">
              <label>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Modo de Juego
              </label>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${gameMode === '1-75' ? 'active' : ''}`}
                  onClick={() => setGameMode('1-75')}
                >
                  <span className="toggle-icon">🇺🇸</span>
                  75 Bolas
                </button>
                <button
                  className={`toggle-btn ${gameMode === '1-90' ? 'active' : ''}`}
                  onClick={() => setGameMode('1-90')}
                >
                  <span className="toggle-icon">🇬🇧</span>
                  90 Bolas
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                Cantidad de Cartones
              </label>
              <select
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
                className="select-field"
              >
                {[1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 30].map(n => (
                  <option key={n} value={n}>{n} carton{n > 1 ? 'es' : ''}</option>
                ))}
              </select>
            </div>

            <div className="control-group full-width">
              <label>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="13.5" cy="6.5" r="2.5" />
                  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
                Tema Visual
              </label>
              <div className="theme-grid">
                {Object.values(BINGO_THEMES).map(theme => (
                  <button
                    key={theme.id}
                    className={`theme-btn ${selectedTheme.id === theme.id ? 'active' : ''}`}
                    onClick={() => setSelectedTheme(theme)}
                  >
                    <span className="theme-preview" style={{ background: theme.colors.cardBg }}>
                      <span className="theme-accent" style={{ background: theme.colors.headerBg }}></span>
                    </span>
                    <span className="theme-name">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="control-actions">
            <button className="btn btn-primary btn-lg" onClick={handleGenerate}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Generar Cartones
            </button>
            {cards.length > 0 && (
              <>
                <button className="btn btn-secondary" onClick={handleAddMore}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  Agregar Más
                </button>
                <button className="btn btn-ghost btn-danger" onClick={handleClearAll}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Limpiar
                </button>
              </>
            )}
          </div>

          {cards.length > 0 && (
            <div className="stats-bar">
              <div className="stat">
                <span className="stat-value">{cards.length}</span>
                <span className="stat-label">Cartones</span>
              </div>
              <div className="stat">
                <span className="stat-value">${totalPrice.toFixed(2)}</span>
                <span className="stat-label">USDC Total</span>
              </div>
              <div className="stat">
                <span className="stat-value">{gameMode}</span>
                <span className="stat-label">Modo</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Payment Section */}
      {cards.length > 0 && (
        <section className="payment-section animate-fade-in-up">
          <div className="payment-card glass-strong">
            <div className="payment-header">
              <div className="payment-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div className="payment-info">
                <h3>Descargar Cartones</h3>
                <p className="payment-price">
                  Total: <span className="price-highlight">${totalPrice.toFixed(2)} USDC</span>
                </p>
                <p className="payment-detail">{cards.length} carton{cards.length > 1 ? 'es' : ''} × $0.01 USDC</p>
              </div>
            </div>

            {!isConnected ? (
              <div className="payment-connect">
                <p>Conecta tu wallet para pagar y descargar</p>
                <ConnectKitButton />
              </div>
            ) : !isPaid ? (
              <div className="payment-actions">
                {paymentError && (
                  <div className="error-message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {paymentError}
                  </div>
                )}
                <button
                  className="btn btn-pay"
                  onClick={handlePayment}
                  disabled={isProcessingPayment || isSigningPayment}
                >
                  {isProcessingPayment || isSigningPayment ? (
                    <>
                      <span className="spinner"></span>
                      {isSigningPayment ? 'Firma en wallet...' : 'Procesando...'}
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Pagar ${totalPrice.toFixed(2)} USDC
                    </>
                  )}
                </button>
                <p className="payment-note">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  Pago vía x402 Protocol en Base Network
                </p>
              </div>
            ) : (
              <div className="download-actions">
                <div className="success-message">
                  <div className="success-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <span>¡Pago confirmado!</span>
                </div>
                <div className="download-buttons">
                  <button className="btn btn-download" onClick={handleDownloadPDF}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Descargar PDF
                  </button>
                  <button className="btn btn-secondary" onClick={handlePrint}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6,9 6,2 18,2 18,9" />
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Imprimir
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Cards Grid */}
      {cards.length > 0 && showCards && (
        <section className="cards-section">
          <div className="section-header">
            <h2 className="section-title">Tus Cartones</h2>
            <span className="cards-count">{cards.length} generados</span>
          </div>
          <div className="cards-grid" ref={printRef}>
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="card-wrapper animate-bounce-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="card-header-row">
                  <span className="card-number">#{index + 1}</span>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteCard(card.id)}
                    title="Eliminar cartón"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div id={`card-${card.id}`}>
                  <BingoCardDisplay
                    card={card}
                    mode={gameMode}
                    title={gameTitle}
                    theme={selectedTheme}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {cards.length === 0 && (
        <section className="empty-state animate-fade-in">
          <div className="empty-content">
            <div className="empty-icon">🎱</div>
            <h2>No hay cartones generados</h2>
            <p>Configura las opciones arriba y genera tus cartones de bingo</p>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Image src="/logo.svg" alt="UltraBingo" width={120} height={60} />
          </div>
          <div className="footer-links">
            <a href="https://base.org" target="_blank" rel="noopener noreferrer">Base Network</a>
            <span className="footer-divider">•</span>
            <a href="https://x402.org" target="_blank" rel="noopener noreferrer">x402 Protocol</a>
            <span className="footer-divider">•</span>
            <span className="footer-credit">Powered by Ultravioleta DAO</span>
          </div>
        </div>
      </footer>

      <style jsx>{`
        /* Main Layout */
        .main-container {
          position: relative;
          z-index: 1;
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }

        /* Header */
        .header {
          padding: 20px 0 30px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }

        .logo-container {
          display: flex;
          align-items: center;
        }

        .header-actions {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        /* Hero Section */
        .hero {
          text-align: center;
          padding: 60px 20px 80px;
          position: relative;
          overflow: hidden;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }

        .hero-title {
          font-size: clamp(2.5rem, 6vw, 4rem);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -0.02em;
        }

        .hero-subtitle-text {
          color: var(--color-text-primary);
          opacity: 0.9;
        }

        .hero-description {
          font-size: 1.2rem;
          color: var(--color-text-secondary);
          max-width: 600px;
          margin: 0 auto 32px;
          line-height: 1.6;
        }

        .hero-badges {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 100px;
          font-size: 0.9rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .badge:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }

        .badge svg {
          opacity: 0.8;
        }

        .badge-primary { color: var(--color-accent-primary); }
        .badge-secondary { color: var(--color-accent-secondary); }
        .badge-tertiary { color: var(--color-accent-tertiary); }

        .hero-decoration {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .floating-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.4;
        }

        .orb-1 {
          width: 300px;
          height: 300px;
          background: var(--color-accent-primary);
          top: -100px;
          right: -100px;
        }

        .orb-2 {
          width: 200px;
          height: 200px;
          background: var(--color-accent-secondary);
          bottom: -50px;
          left: -50px;
        }

        .orb-3 {
          width: 150px;
          height: 150px;
          background: var(--color-accent-tertiary);
          top: 50%;
          left: 10%;
        }

        /* How It Works */
        .how-it-works {
          padding: 40px 0 60px;
        }

        .section-title {
          text-align: center;
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 40px;
          color: var(--color-text-primary);
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .step-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          padding: 32px 24px;
          text-align: center;
          position: relative;
          transition: all 0.3s ease;
        }

        .step-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-4px);
        }

        .step-number {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 24px;
          background: var(--gradient-primary);
          border-radius: 50%;
          font-size: 0.8rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 20px;
          background: rgba(0, 212, 170, 0.1);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent-primary);
        }

        .step-card h3 {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .step-card p {
          color: var(--color-text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        /* Control Panel */
        .control-section {
          margin-bottom: 40px;
        }

        .control-panel {
          border-radius: var(--radius-lg);
          padding: 32px;
          position: relative;
          overflow: hidden;
        }

        .panel-header {
          margin-bottom: 28px;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.4rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .panel-title svg {
          color: var(--color-accent-primary);
        }

        .control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 28px;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .control-group.full-width {
          grid-column: 1 / -1;
        }

        .control-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .control-group label svg {
          opacity: 0.6;
        }

        .input-field,
        .select-field {
          width: 100%;
          padding: 14px 16px;
          border-radius: var(--radius-md);
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
          color: var(--color-text-primary);
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .input-field:focus,
        .select-field:focus {
          outline: none;
          border-color: var(--color-accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.15);
        }

        .select-field {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 18px;
          padding-right: 40px;
        }

        .toggle-group {
          display: flex;
          gap: 8px;
        }

        .toggle-btn {
          flex: 1;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
          color: var(--color-text-secondary);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 0.95rem;
          font-family: inherit;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .toggle-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .toggle-btn.active {
          background: var(--color-accent-primary);
          color: #000;
          border-color: var(--color-accent-primary);
        }

        .toggle-icon {
          font-size: 1.1rem;
        }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 12px;
        }

        .theme-btn {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-md);
          padding: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .theme-btn:hover {
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }

        .theme-btn.active {
          border-color: var(--color-accent-primary);
          background: rgba(0, 212, 170, 0.1);
        }

        .theme-preview {
          width: 100%;
          height: 36px;
          border-radius: 6px;
          position: relative;
          overflow: hidden;
        }

        .theme-accent {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 10px;
        }

        .theme-name {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .theme-btn.active .theme-name {
          color: var(--color-accent-primary);
        }

        /* Control Actions */
        .control-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          padding-top: 8px;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: var(--radius-full);
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
        }

        .btn-lg {
          padding: 16px 32px;
          font-size: 1.1rem;
        }

        .btn-primary {
          background: var(--gradient-primary);
          color: #000;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 212, 170, 0.35);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: var(--color-text-primary);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .btn-ghost {
          background: transparent;
          color: var(--color-text-secondary);
        }

        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .btn-danger {
          color: var(--color-accent-danger);
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .btn-pay {
          background: linear-gradient(135deg, #2775ca 0%, #3b82f6 100%);
          color: white;
          padding: 16px 40px;
          font-size: 1.15rem;
        }

        .btn-pay:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(59, 130, 246, 0.4);
        }

        .btn-pay:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-download {
          background: var(--gradient-primary);
          color: #000;
          padding: 14px 32px;
        }

        .btn-download:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 212, 170, 0.35);
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          justify-content: center;
          gap: 40px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 24px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-accent-primary);
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        /* Payment Section */
        .payment-section {
          margin-bottom: 40px;
        }

        .payment-card {
          border-radius: var(--radius-lg);
          padding: 32px;
          text-align: center;
        }

        .payment-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .payment-icon {
          width: 64px;
          height: 64px;
          background: rgba(59, 130, 246, 0.15);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent-tertiary);
        }

        .payment-info h3 {
          font-size: 1.3rem;
          margin-bottom: 4px;
        }

        .payment-price {
          font-size: 1.1rem;
          color: var(--color-text-secondary);
        }

        .price-highlight {
          color: var(--color-accent-primary);
          font-weight: 700;
          font-size: 1.3rem;
        }

        .payment-detail {
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }

        .payment-connect {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .payment-connect p {
          color: var(--color-text-secondary);
        }

        .payment-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-accent-danger);
          border-radius: var(--radius-md);
          font-size: 0.95rem;
        }

        .payment-note {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text-muted);
          font-size: 0.85rem;
        }

        .download-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--color-accent-primary);
          font-weight: 600;
          font-size: 1.1rem;
        }

        .success-icon {
          width: 36px;
          height: 36px;
          background: var(--color-accent-primary);
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bounceIn 0.5s ease;
        }

        .download-buttons {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
        }

        /* Cards Section */
        .cards-section {
          margin-bottom: 60px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .cards-count {
          font-size: 0.95rem;
          color: var(--color-text-muted);
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          justify-items: center;
        }

        .card-wrapper {
          position: relative;
          opacity: 0;
        }

        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding: 0 8px;
        }

        .card-number {
          color: var(--color-text-muted);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .delete-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(239, 68, 68, 0.2);
          color: var(--color-accent-danger);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .delete-btn:hover {
          background: var(--color-accent-danger);
          color: white;
          transform: scale(1.1);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
        }

        .empty-content {
          max-width: 400px;
          margin: 0 auto;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 20px;
          animation: float 4s ease-in-out infinite;
        }

        .empty-state h2 {
          font-size: 1.5rem;
          color: var(--color-text-secondary);
          margin-bottom: 8px;
        }

        .empty-state p {
          color: var(--color-text-muted);
        }

        /* Footer */
        .footer {
          padding: 40px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          margin-top: 40px;
        }

        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }

        .footer-links a {
          color: var(--color-text-secondary);
          transition: color 0.2s ease;
        }

        .footer-links a:hover {
          color: var(--color-accent-primary);
        }

        .footer-divider {
          opacity: 0.3;
        }

        /* Print Styles */
        @media print {
          .header, .hero, .how-it-works, .control-section, .payment-section,
          .section-header, .card-header-row, .empty-state, .footer {
            display: none !important;
          }

          .main-container {
            padding: 0;
            max-width: 100%;
          }

          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            page-break-inside: avoid;
          }

          .card-wrapper {
            page-break-inside: avoid;
            opacity: 1 !important;
            animation: none !important;
          }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            text-align: center;
          }

          .hero {
            padding: 40px 20px 60px;
          }

          .hero-description {
            font-size: 1.05rem;
          }

          .hero-badges {
            flex-direction: column;
            align-items: center;
          }

          .control-panel {
            padding: 24px 20px;
          }

          .control-grid {
            grid-template-columns: 1fr;
          }

          .toggle-group {
            flex-direction: column;
          }

          .control-actions {
            flex-direction: column;
            width: 100%;
          }

          .control-actions .btn {
            width: 100%;
          }

          .stats-bar {
            flex-direction: column;
            gap: 16px;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .download-buttons {
            flex-direction: column;
            width: 100%;
          }

          .download-buttons .btn {
            width: 100%;
          }

          .steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

// Componente para mostrar un carton de bingo
function BingoCardDisplay({
  card,
  mode,
  title,
  theme = DEFAULT_THEME,
}: {
  card: BingoCardType;
  mode: GameMode;
  title: string;
  theme?: BingoTheme;
}) {
  const headers = mode === '1-75' ? ['B', 'I', 'N', 'G', 'O'] : null;
  const is75Mode = mode === '1-75';
  const { colors } = theme;

  return (
    <div
      className={`bingo-card ${is75Mode ? 'mode-75' : 'mode-90'}`}
      style={{
        '--card-bg': colors.cardBg,
        '--header-bg': colors.headerBg,
        '--header-text': colors.headerText,
        '--cell-bg': colors.cellBg,
        '--cell-text': colors.cellText,
        '--marked-bg': colors.markedBg,
        '--marked-text': colors.markedText,
        '--uncalled-bg': colors.uncalledBg,
        '--uncalled-text': colors.uncalledText,
        '--callable-bg': colors.callableBg,
        '--free-bg': colors.freeBg,
        '--free-text': colors.freeText,
        '--border-color': colors.border,
        '--accent-color': colors.accent,
      } as React.CSSProperties}
    >
      <div className="card-title">{title}</div>

      {headers && (
        <div className="bingo-header">
          {headers.map((letter) => (
            <div key={letter} className="bingo-cell header">
              {letter}
            </div>
          ))}
        </div>
      )}

      {card.numbers.map((row, rowIndex) => (
        <div key={rowIndex} className="bingo-row">
          {row.map((number, colIndex) => {
            const isFree = number === null;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-cell ${isFree ? 'free' : ''}`}
              >
                {isFree ? 'FREE' : number}
              </div>
            );
          })}
        </div>
      ))}

      <div className="card-id">ID: {card.id.slice(0, 8)}</div>

      <style jsx>{`
        .bingo-card {
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: var(--card-bg);
          padding: 16px;
          border-radius: 16px;
          border: 2px solid var(--border-color);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .card-title {
          text-align: center;
          font-weight: 700;
          color: var(--accent-color);
          font-size: 1.3rem;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }

        .bingo-header, .bingo-row {
          display: flex;
          gap: 3px;
        }

        .mode-75 .bingo-cell {
          width: 55px;
          height: 55px;
          font-size: 1.1rem;
        }

        .mode-90 .bingo-cell {
          width: 38px;
          height: 45px;
          font-size: 0.95rem;
        }

        .bingo-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          border-radius: 8px;
          background: var(--cell-bg);
          color: var(--cell-text);
          transition: transform 0.15s ease;
        }

        .bingo-cell:hover {
          transform: scale(1.05);
        }

        .bingo-cell.header {
          background: var(--header-bg);
          color: var(--header-text);
          font-size: 1.4rem;
          font-weight: 800;
        }

        .bingo-cell.free {
          background: var(--free-bg);
          color: var(--free-text);
          font-size: 0.7rem;
          font-weight: 700;
        }

        .card-id {
          text-align: center;
          font-size: 0.75rem;
          color: var(--uncalled-text);
          margin-top: 10px;
          font-family: monospace;
          opacity: 0.7;
        }

        @media print {
          .bingo-card {
            background: white !important;
            border: 2px solid #333 !important;
            padding: 10px !important;
            box-shadow: none !important;
          }

          .card-title {
            color: #333 !important;
          }

          .bingo-cell {
            background: #f0f0f0 !important;
            color: #333 !important;
            border: 1px solid #ccc !important;
            -webkit-print-color-adjust: exact;
          }

          .bingo-cell.header {
            background: #e94560 !important;
            color: white !important;
          }

          .bingo-cell.free {
            background: #fdcb6e !important;
            color: #333 !important;
          }

          .card-id {
            color: #999 !important;
          }
        }
      `}</style>
    </div>
  );
}
