'use client';

import { useState, useRef } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import {
  generateBingoCard,
  generateMultipleCards,
  BingoCard as BingoCardType,
  GameMode,
} from '@/lib/bingo';

export default function Home() {
  const { isConnected, address } = useAccount();
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [cardCount, setCardCount] = useState(1);
  const [gameTitle, setGameTitle] = useState('UltraBingo');
  const [isPaid, setIsPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(newCards);
    setIsPaid(false); // Reset payment status when generating new cards
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
      // Call backend to initiate payment
      const response = await fetch('/api/pay-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardCount: cards.length,
          walletAddress: address,
        }),
      });

      if (response.status === 402) {
        // Payment required - for now, simulate payment in demo mode
        // Felipe will implement the real payment flow in backend
        console.log('Payment required, simulating demo payment...');

        // Simulate successful payment for demo
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsPaid(true);
      } else if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsPaid(true);
        }
      } else {
        const error = await response.json();
        setPaymentError(error.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError('Error processing payment');
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

  const totalPrice = cards.length * 0.01; // $0.01 per card

  return (
    <main className="container">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>UltraBingo</h1>
            <p>Generador de Cartones de Bingo</p>
          </div>
          <ConnectKitButton />
        </div>
      </header>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-section">
          <h3>Configuracion</h3>

          <div className="control-group">
            <label>Titulo del Juego</label>
            <input
              type="text"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="Nombre del juego"
            />
          </div>

          <div className="control-group">
            <label>Modo de Juego</label>
            <div className="button-group">
              <button
                className={gameMode === '1-75' ? 'active' : ''}
                onClick={() => setGameMode('1-75')}
              >
                75 Bolas (USA)
              </button>
              <button
                className={gameMode === '1-90' ? 'active' : ''}
                onClick={() => setGameMode('1-90')}
              >
                90 Bolas (UK)
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Cantidad de Cartones</label>
            <select
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
            >
              {[1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 30].map(n => (
                <option key={n} value={n}>{n} carton{n > 1 ? 'es' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="control-actions">
          <button className="btn-primary" onClick={handleGenerate}>
            Generar Cartones
          </button>
          {cards.length > 0 && (
            <>
              <button className="btn-secondary" onClick={handleAddMore}>
                Agregar Mas
              </button>
              <button className="btn-danger" onClick={handleClearAll}>
                Limpiar Todo
              </button>
            </>
          )}
        </div>

        {cards.length > 0 && (
          <div className="stats">
            <span>{cards.length} carton{cards.length > 1 ? 'es' : ''} generado{cards.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Payment Section */}
      {cards.length > 0 && (
        <div className="payment-section">
          <div className="payment-info">
            <h3>Descargar Cartones</h3>
            <p className="price">
              Total: <span>${totalPrice.toFixed(2)} USDC</span>
            </p>
            <p className="price-detail">{cards.length} carton{cards.length > 1 ? 'es' : ''} × $0.01 USDC</p>
          </div>

          {!isConnected ? (
            <div className="payment-connect">
              <p>Conecta tu wallet para pagar y descargar</p>
              <ConnectKitButton />
            </div>
          ) : !isPaid ? (
            <div className="payment-actions">
              {paymentError && (
                <div className="payment-error">{paymentError}</div>
              )}
              <button
                className="btn-pay"
                onClick={handlePayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <span className="spinner"></span>
                    Procesando...
                  </>
                ) : (
                  <>Pagar ${totalPrice.toFixed(2)} USDC</>
                )}
              </button>
              <p className="payment-note">Pago via x402 en Base Network</p>
            </div>
          ) : (
            <div className="download-actions">
              <div className="payment-success">
                <span className="check-icon">✓</span>
                Pago confirmado
              </div>
              <div className="download-buttons">
                <button className="btn-download" onClick={handleDownloadPDF}>
                  Descargar PDF
                </button>
                <button className="btn-download secondary" onClick={handlePrint}>
                  Imprimir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards Grid */}
      {cards.length > 0 && (
        <div className="cards-container" ref={printRef}>
          <div className="cards-grid">
            {cards.map((card, index) => (
              <div key={card.id} className="card-wrapper">
                <div className="card-header">
                  <span className="card-number">#{index + 1}</span>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteCard(card.id)}
                    title="Eliminar carton"
                  >
                    ×
                  </button>
                </div>
                <div id={`card-${card.id}`}>
                  <BingoCardDisplay
                    card={card}
                    mode={gameMode}
                    title={gameTitle}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎱</div>
          <h2>No hay cartones</h2>
          <p>Configura las opciones y genera tus cartones de bingo</p>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }

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
          margin-top: 8px;
        }

        .control-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 25px;
          border-radius: 16px;
          border: 2px solid #0f3460;
          margin-bottom: 30px;
        }

        .control-section h3 {
          color: #e94560;
          margin-bottom: 20px;
          text-align: center;
        }

        .control-group {
          margin-bottom: 20px;
        }

        .control-group label {
          display: block;
          color: #888;
          font-size: 0.9rem;
          margin-bottom: 8px;
        }

        .control-group input,
        .control-group select {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 2px solid #0f3460;
          background: #0a0a1a;
          color: #eee;
          font-size: 1rem;
        }

        .control-group input:focus,
        .control-group select:focus {
          outline: none;
          border-color: #00b894;
        }

        .button-group {
          display: flex;
          gap: 10px;
        }

        .button-group button {
          flex: 1;
          padding: 12px;
          border: 2px solid #0f3460;
          background: #0a0a1a;
          color: #888;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.95rem;
        }

        .button-group button.active {
          background: #0f3460;
          color: #fff;
          border-color: #00b894;
        }

        .button-group button:hover:not(.active) {
          border-color: #1a4a7a;
          color: #aaa;
        }

        .control-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 25px;
        }

        .btn-primary {
          padding: 14px 35px;
          font-size: 1.1rem;
          font-weight: bold;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 25px rgba(0, 184, 148, 0.4);
        }

        .btn-secondary {
          padding: 12px 25px;
          font-size: 1rem;
          background: #0f3460;
          color: #aaa;
          border: 2px solid #1a4a7a;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: #1a4a7a;
          color: #fff;
        }

        .btn-danger {
          padding: 12px 25px;
          font-size: 1rem;
          background: transparent;
          color: #e94560;
          border: 2px solid #e94560;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-danger:hover {
          background: #e94560;
          color: #fff;
        }

        .stats {
          text-align: center;
          margin-top: 20px;
          color: #00b894;
          font-size: 0.95rem;
        }

        /* Payment Section */
        .payment-section {
          background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
          padding: 30px;
          border-radius: 16px;
          border: 2px solid #2775ca;
          margin-bottom: 30px;
          text-align: center;
        }

        .payment-info h3 {
          color: #fff;
          margin-bottom: 10px;
        }

        .price {
          font-size: 1.5rem;
          color: #888;
          margin-bottom: 5px;
        }

        .price span {
          color: #00b894;
          font-weight: bold;
        }

        .price-detail {
          color: #666;
          font-size: 0.9rem;
          margin-bottom: 20px;
        }

        .payment-connect {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .payment-connect p {
          color: #888;
        }

        .payment-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .payment-error {
          background: rgba(233, 69, 96, 0.2);
          color: #e94560;
          padding: 10px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
        }

        .btn-pay {
          padding: 16px 50px;
          font-size: 1.2rem;
          font-weight: bold;
          background: linear-gradient(135deg, #2775ca 0%, #3498db 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-pay:hover:not(:disabled) {
          transform: scale(1.03);
          box-shadow: 0 8px 25px rgba(39, 117, 202, 0.4);
        }

        .btn-pay:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .payment-note {
          color: #666;
          font-size: 0.85rem;
          margin-top: 10px;
        }

        .download-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .payment-success {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #00b894;
          font-size: 1.1rem;
          font-weight: bold;
        }

        .check-icon {
          width: 30px;
          height: 30px;
          background: #00b894;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }

        .download-buttons {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn-download {
          padding: 14px 35px;
          font-size: 1.1rem;
          font-weight: bold;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-download:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 25px rgba(0, 184, 148, 0.4);
        }

        .btn-download.secondary {
          background: #0f3460;
          border: 2px solid #1a4a7a;
        }

        .btn-download.secondary:hover {
          background: #1a4a7a;
          box-shadow: none;
        }

        .cards-container {
          margin-top: 20px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 25px;
          justify-items: center;
        }

        .card-wrapper {
          position: relative;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding: 0 5px;
        }

        .card-number {
          color: #888;
          font-size: 0.9rem;
        }

        .delete-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #e94560;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .delete-btn:hover {
          transform: scale(1.1);
          background: #ff6b6b;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }

        .empty-state h2 {
          color: #888;
          margin-bottom: 10px;
        }

        .empty-state p {
          color: #666;
        }

        @media print {
          .header, .control-panel, .card-header, .empty-state, .payment-section {
            display: none !important;
          }

          .container {
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
          }
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            text-align: center;
          }

          .button-group {
            flex-direction: column;
          }

          .control-actions {
            flex-direction: column;
          }

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .download-buttons {
            flex-direction: column;
            width: 100%;
          }

          .btn-download {
            width: 100%;
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
}: {
  card: BingoCardType;
  mode: GameMode;
  title: string;
}) {
  const headers = mode === '1-75' ? ['B', 'I', 'N', 'G', 'O'] : null;
  const is75Mode = mode === '1-75';

  return (
    <div className={`bingo-card ${is75Mode ? 'mode-75' : 'mode-90'}`}>
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
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 15px;
          border-radius: 12px;
          border: 2px solid #0f3460;
        }

        .card-title {
          text-align: center;
          font-weight: bold;
          color: #e94560;
          font-size: 1.2rem;
          margin-bottom: 10px;
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
          font-weight: bold;
          border-radius: 6px;
          background: #0f3460;
          color: #eee;
        }

        .bingo-cell.header {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          color: white;
          font-size: 1.3rem;
        }

        .bingo-cell.free {
          background: linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%);
          color: #1a1a2e;
          font-size: 0.65rem;
        }

        .card-id {
          text-align: center;
          font-size: 0.7rem;
          color: #555;
          margin-top: 8px;
        }

        @media print {
          .bingo-card {
            background: white;
            border: 2px solid #333;
            padding: 10px;
          }

          .card-title {
            color: #333;
          }

          .bingo-cell {
            background: #f0f0f0;
            color: #333;
            border: 1px solid #ccc;
          }

          .bingo-cell.header {
            background: #e94560;
            color: white;
          }

          .bingo-cell.free {
            background: #fdcb6e;
            color: #333;
          }

          .card-id {
            color: #999;
          }
        }
      `}</style>
    </div>
  );
}
