'use client';

import { getBingoLetter } from '@/lib/bingo';

interface NumberCallerProps {
  currentNumber: number | null;
  calledNumbers: number[];
  onCallNumber: () => void;
  disabled?: boolean;
}

export default function NumberCaller({
  currentNumber,
  calledNumbers,
  onCallNumber,
  disabled
}: NumberCallerProps) {
  return (
    <div className="number-caller">
      <div className="current-number">
        {currentNumber ? (
          <>
            <span className="letter">{getBingoLetter(currentNumber)}</span>
            <span className="number">{currentNumber}</span>
          </>
        ) : (
          <span className="waiting">?</span>
        )}
      </div>

      <button
        className="call-button"
        onClick={onCallNumber}
        disabled={disabled}
      >
        Call Number
      </button>

      <div className="called-numbers">
        <h3>Called Numbers ({calledNumbers.length}/75)</h3>
        <div className="numbers-grid">
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
                      className={`small-number ${calledNumbers.includes(num) ? 'called' : ''}`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .number-caller {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          border: 2px solid #0f3460;
        }

        .current-number {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 30px rgba(233, 69, 96, 0.5);
        }

        .letter {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .number {
          font-size: 2.5rem;
          font-weight: bold;
        }

        .waiting {
          font-size: 3rem;
          opacity: 0.5;
        }

        .call-button {
          padding: 15px 40px;
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

        .called-numbers {
          width: 100%;
        }

        .called-numbers h3 {
          color: #eee;
          text-align: center;
          margin-bottom: 10px;
        }

        .numbers-grid {
          display: flex;
          gap: 5px;
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
        }

        .column-numbers {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .small-number {
          text-align: center;
          padding: 4px;
          font-size: 0.8rem;
          color: #666;
          background: #0a0a1a;
          border-radius: 2px;
        }

        .small-number.called {
          background: #00b894;
          color: white;
        }
      `}</style>
    </div>
  );
}
