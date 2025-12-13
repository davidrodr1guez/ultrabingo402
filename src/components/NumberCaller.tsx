'use client';

import { useState, useEffect, useCallback } from 'react';
import { getBingoLetter, speakNumber, GameMode } from '@/lib/bingo';

interface NumberCallerProps {
  currentNumber: number | null;
  calledNumbers: number[];
  onCallNumber: () => void;
  disabled?: boolean;
  mode?: GameMode;
  autoCall?: boolean;
  autoCallSpeed?: number;
  onAutoCallChange?: (enabled: boolean) => void;
}

export default function NumberCaller({
  currentNumber,
  calledNumbers,
  onCallNumber,
  disabled,
  mode = '1-75',
  autoCall = false,
  autoCallSpeed = 5000,
  onAutoCallChange,
}: NumberCallerProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastCalledNumbers, setLastCalledNumbers] = useState<number[]>([]);

  // Track last 5 called numbers
  useEffect(() => {
    if (currentNumber && !lastCalledNumbers.includes(currentNumber)) {
      setLastCalledNumbers(prev => [currentNumber, ...prev].slice(0, 5));
    }
  }, [currentNumber]);

  // Speak number when called
  useEffect(() => {
    if (currentNumber && soundEnabled) {
      speakNumber(currentNumber, mode);
    }
  }, [currentNumber, soundEnabled, mode]);

  // Auto-call timer
  useEffect(() => {
    if (!autoCall || disabled) return;

    const timer = setInterval(() => {
      onCallNumber();
    }, autoCallSpeed);

    return () => clearInterval(timer);
  }, [autoCall, autoCallSpeed, disabled, onCallNumber]);

  const maxNumber = mode === '1-75' ? 75 : 90;

  return (
    <div className="number-caller">
      {/* Current Number Display */}
      <div className="current-number-container">
        <div className={`current-number ${currentNumber ? 'called' : ''}`}>
          {currentNumber ? (
            <>
              {mode === '1-75' && (
                <span className="letter">{getBingoLetter(currentNumber)}</span>
              )}
              <span className="number">{currentNumber}</span>
            </>
          ) : (
            <span className="waiting">?</span>
          )}
        </div>

        {/* Last Called Numbers */}
        {lastCalledNumbers.length > 1 && (
          <div className="last-called">
            <span className="label">Previous:</span>
            <div className="last-numbers">
              {lastCalledNumbers.slice(1).map((num, idx) => (
                <span key={num} className="last-number" style={{ opacity: 1 - idx * 0.2 }}>
                  {mode === '1-75' ? `${getBingoLetter(num)}-${num}` : num}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls">
        <button
          className="call-button"
          onClick={onCallNumber}
          disabled={disabled || autoCall}
        >
          {disabled ? 'Game Over' : autoCall ? 'Auto Calling...' : 'Call Number'}
        </button>

        <div className="options">
          <label className="option">
            <input
              type="checkbox"
              checked={autoCall}
              onChange={(e) => onAutoCallChange?.(e.target.checked)}
              disabled={disabled}
            />
            <span>Auto Call</span>
          </label>

          <label className="option">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            <span>Sound</span>
          </label>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(calledNumbers.length / maxNumber) * 100}%` }}
          />
        </div>
        <span className="progress-text">{calledNumbers.length}/{maxNumber} called</span>
      </div>

      {/* Called Numbers Grid */}
      <div className="called-numbers">
        <h3>Called Numbers</h3>
        {mode === '1-75' ? (
          <div className="numbers-grid-75">
            {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
              const min = idx * 15 + 1;
              const max = (idx + 1) * 15;
              return (
                <div key={letter} className="letter-column">
                  <div className="letter-header">{letter}</div>
                  <div className="column-numbers">
                    {Array.from({ length: 15 }, (_, i) => min + i).map(num => (
                      <div
                        key={num}
                        className={`small-number ${calledNumbers.includes(num) ? 'called' : ''} ${currentNumber === num ? 'current' : ''}`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="numbers-grid-90">
            {Array.from({ length: 9 }, (_, col) => {
              const min = col === 0 ? 1 : col * 10;
              const max = col === 8 ? 90 : (col + 1) * 10 - 1;
              const count = max - min + 1;
              return (
                <div key={col} className="number-column">
                  {Array.from({ length: count }, (_, i) => min + i).map(num => (
                    <div
                      key={num}
                      className={`small-number ${calledNumbers.includes(num) ? 'called' : ''} ${currentNumber === num ? 'current' : ''}`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .number-caller {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          border: 2px solid #0f3460;
        }

        .current-number-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .current-number {
          width: 140px;
          height: 140px;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 30px rgba(233, 69, 96, 0.5);
          transition: all 0.3s ease;
        }

        .current-number.called {
          animation: bounce 0.5s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .letter {
          font-size: 1.8rem;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .number {
          font-size: 3rem;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .waiting {
          font-size: 3.5rem;
          opacity: 0.5;
        }

        .last-called {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .last-called .label {
          font-size: 0.8rem;
          color: #888;
        }

        .last-numbers {
          display: flex;
          gap: 10px;
        }

        .last-number {
          padding: 5px 10px;
          background: #0f3460;
          border-radius: 5px;
          font-size: 0.9rem;
          color: #aaa;
        }

        .controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }

        .call-button {
          padding: 15px 50px;
          font-size: 1.2rem;
          font-weight: bold;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .call-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 5px 20px rgba(0, 184, 148, 0.4);
        }

        .call-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .options {
          display: flex;
          gap: 20px;
        }

        .option {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: #aaa;
          font-size: 0.9rem;
        }

        .option input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .progress-container {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .progress-bar {
          height: 8px;
          background: #0a0a1a;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00b894, #00cec9);
          transition: width 0.3s ease;
        }

        .progress-text {
          text-align: center;
          font-size: 0.85rem;
          color: #888;
        }

        .called-numbers h3 {
          color: #eee;
          text-align: center;
          margin-bottom: 10px;
          font-size: 1rem;
        }

        .numbers-grid-75 {
          display: flex;
          gap: 4px;
        }

        .numbers-grid-90 {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 3px;
        }

        .letter-column {
          flex: 1;
        }

        .letter-header {
          text-align: center;
          font-weight: bold;
          color: #e94560;
          padding: 5px;
          background: #0f3460;
          border-radius: 4px 4px 0 0;
          font-size: 0.9rem;
        }

        .column-numbers, .number-column {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .small-number {
          text-align: center;
          padding: 4px 2px;
          font-size: 0.75rem;
          color: #555;
          background: #0a0a1a;
          border-radius: 2px;
          transition: all 0.2s ease;
        }

        .small-number.called {
          background: #00b894;
          color: white;
        }

        .small-number.current {
          background: #e94560;
          color: white;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
