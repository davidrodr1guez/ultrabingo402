'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { getBingoLetter, GameMode, WinPattern, checkWin } from '@/lib/bingo';

// Types for API responses
interface DbCard {
  id: string;
  numbers: number[][];
  owner: string;
  game_mode: string;
  game_title: string;
  purchased_at: string;
  payment_status: string;
}

export default function AdminPanel() {
  const [gameMode, setGameMode] = useState<GameMode>('1-75');
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameName, setGameName] = useState('Partida 1');

  // Verificador de bingo
  const [verifyCardId, setVerifyCardId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    card?: DbCard;
    hasBingo: boolean;
    markedNumbers: number[];
  } | null>(null);
  const [winPattern, setWinPattern] = useState<WinPattern>('line');

  // Lista de cartones registrados
  const [registeredCards, setRegisteredCards] = useState<DbCard[]>([]);
  const [showCardsList, setShowCardsList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Game ID for syncing with backend
  const [gameId, setGameId] = useState<string | null>(null);

  const maxNumber = gameMode === '1-75' ? 75 : 90;

  // Fetch cards from API
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

  // Load cards on mount
  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

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

  const handleStartGame = async () => {
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameName, mode: gameMode }),
      });
      const data = await res.json();
      if (data.gameId) {
        setGameId(data.gameId);
        setGameActive(true);
        setCalledNumbers([]);
        setCurrentNumber(null);
      }
    } catch (error) {
      console.error('Error starting game:', error);
      // Fallback to local mode
      setGameActive(true);
      setCalledNumbers([]);
      setCurrentNumber(null);
    }
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
    setCalledNumbers(newCalled);
    setCurrentNumber(newCalled[newCalled.length - 1] || null);
  };

  const handleVerifyBingo = async () => {
    if (!verifyCardId.trim()) return;

    try {
      const res = await fetch(
        `/api/cards/${verifyCardId.trim()}?calledNumbers=${JSON.stringify(calledNumbers)}&pattern=${winPattern}`
      );

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
    if (confirm('¿Seguro que quieres borrar todos los cartones registrados?')) {
      try {
        await fetch('/api/cards', { method: 'DELETE' });
        refreshCards();
      } catch (error) {
        console.error('Error clearing registry:', error);
      }
    }
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

      {/* Verificador de Bingo */}
      <div className="verify-section">
        <h3>Verificar Bingo</h3>
        <div className="verify-form">
          <input
            type="text"
            value={verifyCardId}
            onChange={(e) => setVerifyCardId(e.target.value)}
            placeholder="ID del cartón (ej: a1b2c3d4)"
            className="verify-input"
          />
          <select
            value={winPattern}
            onChange={(e) => setWinPattern(e.target.value as WinPattern)}
            className="pattern-select"
          >
            <option value="line">Línea</option>
            <option value="full-house">Cartón lleno</option>
            <option value="four-corners">4 Esquinas</option>
            <option value="x-pattern">Patrón X</option>
          </select>
          <button className="btn-verify" onClick={handleVerifyBingo}>
            Verificar
          </button>
        </div>

        {verifyResult && (
          <div className={`verify-result ${verifyResult.found ? (verifyResult.hasBingo ? 'bingo' : 'no-bingo') : 'not-found'}`}>
            {!verifyResult.found ? (
              <p>Cartón no encontrado</p>
            ) : (
              <>
                <div className="result-header">
                  {verifyResult.hasBingo ? (
                    <span className="bingo-yes">¡BINGO VÁLIDO!</span>
                  ) : (
                    <span className="bingo-no">NO tiene bingo</span>
                  )}
                </div>
                <div className="card-info">
                  <p><strong>ID:</strong> {verifyResult.card?.id}</p>
                  <p><strong>Dueño:</strong> {verifyResult.card?.owner.slice(0, 10)}...</p>
                  <p><strong>Números marcados:</strong> {verifyResult.markedNumbers.length} de {verifyResult.card?.numbers.flat().filter(n => n !== null).length}</p>
                </div>
                {/* Mostrar el cartón */}
                <div className="card-preview">
                  <div className="preview-title">{verifyResult.card?.game_title}</div>
                  {verifyResult.card?.game_mode === '1-75' && (
                    <div className="preview-header">
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
                          <div
                            key={colIdx}
                            className={`preview-cell ${isCalled ? 'called' : ''} ${isFree ? 'free' : ''}`}
                          >
                            {isFree ? '★' : num}
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

      {/* Lista de Cartones Registrados */}
      <div className="cards-registry">
        <div className="registry-header">
          <h3>Cartones Registrados ({registeredCards.length})</h3>
          <div className="registry-actions">
            <button className="btn-refresh" onClick={refreshCards}>
              Actualizar
            </button>
            <button className="btn-toggle" onClick={() => setShowCardsList(!showCardsList)}>
              {showCardsList ? 'Ocultar' : 'Mostrar'}
            </button>
            {registeredCards.length > 0 && (
              <button className="btn-clear" onClick={handleClearRegistry}>
                Limpiar todo
              </button>
            )}
          </div>
        </div>

        {showCardsList && (
          <div className="cards-list">
            {registeredCards.length === 0 ? (
              <p className="no-cards">No hay cartones registrados</p>
            ) : (
              <table className="cards-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Dueño</th>
                    <th>Modo</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredCards.map((card) => (
                    <tr key={card.id}>
                      <td className="card-id-cell">{card.id.slice(0, 8)}</td>
                      <td>{card.owner.slice(0, 10)}...</td>
                      <td>{card.game_mode}</td>
                      <td>{new Date(card.purchased_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn-check"
                          onClick={() => {
                            setVerifyCardId(card.id.slice(0, 8));
                          }}
                        >
                          Verificar
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

        /* Verificador de Bingo */
        .verify-section {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          border: 2px solid #00b894;
          margin-top: 20px;
        }

        .verify-section h3 {
          color: #00b894;
          margin-bottom: 15px;
        }

        .verify-form {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }

        .verify-input {
          flex: 1;
          min-width: 200px;
          padding: 12px 15px;
          border: 2px solid #0f3460;
          border-radius: 8px;
          background: #0a0a1a;
          color: #fff;
          font-size: 1rem;
        }

        .verify-input:focus {
          outline: none;
          border-color: #00b894;
        }

        .pattern-select {
          padding: 12px 15px;
          border: 2px solid #0f3460;
          border-radius: 8px;
          background: #0a0a1a;
          color: #fff;
          font-size: 1rem;
          cursor: pointer;
        }

        .btn-verify {
          padding: 12px 30px;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-verify:hover {
          transform: scale(1.05);
        }

        .verify-result {
          padding: 20px;
          border-radius: 12px;
          margin-top: 15px;
        }

        .verify-result.not-found {
          background: rgba(233, 69, 96, 0.2);
          border: 2px solid #e94560;
          color: #e94560;
        }

        .verify-result.bingo {
          background: rgba(0, 184, 148, 0.2);
          border: 2px solid #00b894;
        }

        .verify-result.no-bingo {
          background: rgba(243, 156, 18, 0.2);
          border: 2px solid #f39c12;
        }

        .result-header {
          text-align: center;
          margin-bottom: 15px;
        }

        .bingo-yes {
          font-size: 1.5rem;
          font-weight: bold;
          color: #00b894;
        }

        .bingo-no {
          font-size: 1.5rem;
          font-weight: bold;
          color: #f39c12;
        }

        .card-info {
          margin-bottom: 15px;
          color: #aaa;
        }

        .card-info p {
          margin: 5px 0;
        }

        .card-preview {
          display: inline-block;
          background: #0a0a1a;
          padding: 15px;
          border-radius: 12px;
        }

        .preview-title {
          text-align: center;
          font-weight: bold;
          color: #e94560;
          margin-bottom: 10px;
        }

        .preview-header, .preview-row {
          display: flex;
          gap: 3px;
        }

        .preview-cell {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f3460;
          color: #666;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .preview-cell.header {
          background: #e94560;
          color: white;
        }

        .preview-cell.called {
          background: #00b894;
          color: white;
        }

        .preview-cell.free {
          background: #f39c12;
          color: #1a1a2e;
        }

        /* Lista de cartones registrados */
        .cards-registry {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          border: 2px solid #0f3460;
          margin-top: 20px;
        }

        .registry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .registry-header h3 {
          color: #e94560;
          margin: 0;
        }

        .registry-actions {
          display: flex;
          gap: 10px;
        }

        .btn-refresh, .btn-toggle {
          padding: 8px 15px;
          background: #0f3460;
          color: #aaa;
          border: 2px solid #1a4a7a;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-refresh:hover, .btn-toggle:hover {
          background: #1a4a7a;
          color: #fff;
        }

        .btn-clear {
          padding: 8px 15px;
          background: transparent;
          color: #e94560;
          border: 2px solid #e94560;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-clear:hover {
          background: #e94560;
          color: #fff;
        }

        .cards-list {
          margin-top: 15px;
        }

        .no-cards {
          color: #666;
          text-align: center;
          padding: 20px;
        }

        .cards-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cards-table th, .cards-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #0f3460;
        }

        .cards-table th {
          color: #888;
          font-weight: normal;
          font-size: 0.9rem;
        }

        .cards-table td {
          color: #aaa;
        }

        .card-id-cell {
          font-family: monospace;
          color: #00b894 !important;
        }

        .btn-check {
          padding: 6px 12px;
          background: #0f3460;
          color: #aaa;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-check:hover {
          background: #00b894;
          color: #fff;
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
