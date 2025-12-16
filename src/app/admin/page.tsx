'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getBingoLetter, GameMode } from '@/lib/bingo';

export default function AdminPanel() {
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameName, setGameName] = useState('Partida 1');

  const maxNumber = gameMode === '1-75' ? 75 : 90;

  const handleNumberClick = (num: number) => {
    if (!gameActive) return;

    if (calledNumbers.includes(num)) {
      // Quitar número si ya fue llamado
      setCalledNumbers(prev => prev.filter(n => n !== num));
      if (currentNumber === num) {
        setCurrentNumber(calledNumbers[calledNumbers.length - 2] || null);
      }
    } else {
      // Agregar número
      setCalledNumbers(prev => [...prev, num]);
      setCurrentNumber(num);
    }
  };

  const handleRandomCall = () => {
    if (!gameActive) return;

    const available = Array.from({ length: maxNumber }, (_, i) => i + 1)
      .filter(n => !calledNumbers.includes(n));

    if (available.length === 0) return;

    const randomNum = available[Math.floor(Math.random() * available.length)];
    setCalledNumbers(prev => [...prev, randomNum]);
    setCurrentNumber(randomNum);
  };

  const handleStartGame = () => {
    setGameActive(true);
    setCalledNumbers([]);
    setCurrentNumber(null);
  };

  const handleEndGame = () => {
    setGameActive(false);
  };

  const handleReset = () => {
    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameActive(false);
  };

  const handleUndo = () => {
    if (calledNumbers.length === 0) return;
    const newCalled = calledNumbers.slice(0, -1);
    setCalledNumbers(newCalled);
    setCurrentNumber(newCalled[newCalled.length - 1] || null);
  };

  return (
    <main className="admin-container">
      <header className="admin-header">
        <div className="header-left">
          <Image
            src="/logo.svg"
            alt="UltraBingo"
            width={150}
            height={90}
            priority
          />
          <span className="admin-badge">Admin</span>
        </div>
        <div className="game-info">
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="game-name-input"
            placeholder="Nombre de la partida"
          />
        </div>
      </header>

      {/* Control Panel */}
      <div className="control-bar">
        <div className="mode-selector">
          <button
            className={gameMode === '1-75' ? 'active' : ''}
            onClick={() => !gameActive && setGameMode('1-75')}
            disabled={gameActive}
          >
            75 Bolas
          </button>
          <button
            className={gameMode === '1-90' ? 'active' : ''}
            onClick={() => !gameActive && setGameMode('1-90')}
            disabled={gameActive}
          >
            90 Bolas
          </button>
        </div>

        <div className="game-controls">
          {!gameActive ? (
            <button className="btn-start" onClick={handleStartGame}>
              Iniciar Juego
            </button>
          ) : (
            <>
              <button className="btn-random" onClick={handleRandomCall}>
                Sacar Bola
              </button>
              <button className="btn-undo" onClick={handleUndo} disabled={calledNumbers.length === 0}>
                Deshacer
              </button>
              <button className="btn-end" onClick={handleEndGame}>
                Terminar
              </button>
            </>
          )}
          <button className="btn-reset" onClick={handleReset}>
            Reiniciar
          </button>
        </div>

        <div className="stats-bar">
          <span>{calledNumbers.length} / {maxNumber} bolas</span>
        </div>
      </div>

      {/* Current Number Display */}
      <div className="current-display">
        <div className={`big-ball ${currentNumber ? 'active' : ''}`}>
          {currentNumber ? (
            <>
              {gameMode === '1-75' && (
                <span className="ball-letter">{getBingoLetter(currentNumber)}</span>
              )}
              <span className="ball-number">{currentNumber}</span>
            </>
          ) : (
            <span className="ball-waiting">?</span>
          )}
        </div>

        {/* Last Called Numbers */}
        <div className="last-called">
          <span className="last-label">Anteriores:</span>
          <div className="last-numbers">
            {calledNumbers.slice(-6, -1).reverse().map((num, idx) => (
              <div
                key={num}
                className="last-ball"
                style={{ opacity: 1 - idx * 0.15 }}
              >
                {gameMode === '1-75' ? `${getBingoLetter(num)}-${num}` : num}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Number Board */}
      <div className="number-board">
        {gameMode === '1-75' ? (
          <div className="board-75">
            {['B', 'I', 'N', 'G', 'O'].map((letter, colIdx) => {
              const start = colIdx * 15 + 1;
              const end = start + 14;
              return (
                <div key={letter} className="letter-column">
                  <div className="column-header">{letter}</div>
                  <div className="column-numbers">
                    {Array.from({ length: 15 }, (_, i) => start + i).map(num => (
                      <button
                        key={num}
                        className={`number-cell ${calledNumbers.includes(num) ? 'called' : ''} ${currentNumber === num ? 'current' : ''}`}
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
        ) : (
          <div className="board-90">
            {Array.from({ length: 9 }, (_, colIdx) => {
              const start = colIdx === 0 ? 1 : colIdx * 10;
              const end = colIdx === 8 ? 90 : (colIdx + 1) * 10 - 1;
              const count = end - start + 1;
              return (
                <div key={colIdx} className="number-column">
                  {Array.from({ length: count }, (_, i) => start + i).map(num => (
                    <button
                      key={num}
                      className={`number-cell ${calledNumbers.includes(num) ? 'called' : ''} ${currentNumber === num ? 'current' : ''}`}
                      onClick={() => handleNumberClick(num)}
                      disabled={!gameActive}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Called Numbers History */}
      <div className="history-section">
        <h3>Orden de salida ({calledNumbers.length})</h3>
        <div className="history-list">
          {calledNumbers.map((num, idx) => (
            <span key={num} className="history-item">
              {idx + 1}. {gameMode === '1-75' ? `${getBingoLetter(num)}-${num}` : num}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .admin-badge {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .game-name-input {
          background: #0a0a1a;
          border: 2px solid #0f3460;
          color: #fff;
          padding: 10px 15px;
          border-radius: 8px;
          font-size: 1rem;
          width: 200px;
        }

        .game-name-input:focus {
          outline: none;
          border-color: #00b894;
        }

        .control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 15px 20px;
          border-radius: 12px;
          border: 2px solid #0f3460;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .mode-selector {
          display: flex;
          gap: 10px;
        }

        .mode-selector button {
          padding: 10px 20px;
          border: 2px solid #0f3460;
          background: #0a0a1a;
          color: #888;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-selector button.active {
          background: #0f3460;
          color: #fff;
          border-color: #00b894;
        }

        .mode-selector button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .game-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-start {
          padding: 12px 30px;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          border: none;
          border-radius: 25px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-start:hover {
          transform: scale(1.05);
        }

        .btn-random {
          padding: 12px 30px;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          color: white;
          border: none;
          border-radius: 25px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(233, 69, 96, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(233, 69, 96, 0); }
        }

        .btn-random:hover {
          transform: scale(1.05);
        }

        .btn-undo {
          padding: 10px 20px;
          background: #0f3460;
          color: #aaa;
          border: 2px solid #1a4a7a;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-undo:hover:not(:disabled) {
          background: #1a4a7a;
          color: #fff;
        }

        .btn-undo:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-end {
          padding: 10px 20px;
          background: transparent;
          color: #f39c12;
          border: 2px solid #f39c12;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-end:hover {
          background: #f39c12;
          color: #fff;
        }

        .btn-reset {
          padding: 10px 20px;
          background: transparent;
          color: #e94560;
          border: 2px solid #e94560;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-reset:hover {
          background: #e94560;
          color: #fff;
        }

        .stats-bar {
          color: #00b894;
          font-weight: bold;
        }

        .current-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }

        .big-ball {
          width: 180px;
          height: 180px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 4px solid #0f3460;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .big-ball.active {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border-color: #ff6b6b;
          box-shadow: 0 0 40px rgba(233, 69, 96, 0.5);
          animation: bounce 0.5s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .ball-letter {
          font-size: 2rem;
          font-weight: bold;
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .ball-number {
          font-size: 4rem;
          font-weight: bold;
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .ball-waiting {
          font-size: 4rem;
          color: #555;
        }

        .last-called {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .last-label {
          color: #888;
          font-size: 0.9rem;
        }

        .last-numbers {
          display: flex;
          gap: 10px;
        }

        .last-ball {
          background: #0f3460;
          color: #aaa;
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 0.9rem;
        }

        .number-board {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          border: 2px solid #0f3460;
          margin-bottom: 20px;
        }

        .board-75 {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .letter-column {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .column-header {
          text-align: center;
          font-size: 1.5rem;
          font-weight: bold;
          color: #e94560;
          padding: 10px;
          background: #0f3460;
          border-radius: 8px;
        }

        .column-numbers {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .board-90 {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 5px;
        }

        .number-column {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .number-cell {
          width: 50px;
          height: 50px;
          border: none;
          border-radius: 8px;
          background: #0a0a1a;
          color: #555;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .number-cell:hover:not(:disabled):not(.called) {
          background: #1a4a7a;
          color: #fff;
        }

        .number-cell.called {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
        }

        .number-cell.current {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          color: white;
          animation: glow 1s infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px #e94560; }
          50% { box-shadow: 0 0 20px #e94560; }
        }

        .number-cell:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .history-section {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          border: 2px solid #0f3460;
        }

        .history-section h3 {
          color: #e94560;
          margin-bottom: 15px;
        }

        .history-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .history-item {
          background: #0f3460;
          color: #aaa;
          padding: 5px 12px;
          border-radius: 15px;
          font-size: 0.85rem;
        }

        @media (max-width: 768px) {
          .control-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .mode-selector, .game-controls {
            justify-content: center;
          }

          .number-cell {
            width: 40px;
            height: 40px;
            font-size: 0.9rem;
          }

          .big-ball {
            width: 140px;
            height: 140px;
          }

          .ball-number {
            font-size: 3rem;
          }
        }
      `}</style>
    </main>
  );
}
