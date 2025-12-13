'use client';

import { useState, useRef } from 'react';
import {
  generateBingoCard,
  generateMultipleCards,
  BingoCard as BingoCardType,
  GameMode,
} from '@/lib/bingo';

export default function Home() {
  const [cards, setCards] = useState<BingoCardType[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [cardCount, setCardCount] = useState(1);
  const [gameTitle, setGameTitle] = useState('UltraBingo');
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(newCards);
  };

  const handleAddMore = () => {
    const newCards = generateMultipleCards(cardCount, gameMode);
    setCards(prev => [...prev, ...newCards]);
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(card => card.id !== id));
  };

  const handleClearAll = () => {
    setCards([]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="container">
      <header className="header">
        <h1>UltraBingo</h1>
        <p>Generador de Cartones de Bingo</p>
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
              <button className="btn-secondary" onClick={handlePrint}>
                Imprimir
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
                <BingoCardDisplay
                  card={card}
                  mode={gameMode}
                  title={gameTitle}
                />
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
          text-align: center;
          padding: 30px 0;
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
          .header, .control-panel, .card-header, .empty-state {
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
          .button-group {
            flex-direction: column;
          }

          .control-actions {
            flex-direction: column;
          }

          .cards-grid {
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
