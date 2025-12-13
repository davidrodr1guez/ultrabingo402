'use client';

import { BingoCard as BingoCardType } from '@/lib/bingo';

interface BingoCardProps {
  card: BingoCardType;
  onMarkNumber: (number: number) => void;
  disabled?: boolean;
}

export default function BingoCard({ card, onMarkNumber, disabled }: BingoCardProps) {
  const headers = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="bingo-card">
      <div className="bingo-header">
        {headers.map((letter) => (
          <div key={letter} className="bingo-cell header">
            {letter}
          </div>
        ))}
      </div>
      {card.numbers.map((row, rowIndex) => (
        <div key={rowIndex} className="bingo-row">
          {row.map((number, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={`bingo-cell ${card.marked[rowIndex][colIndex] ? 'marked' : ''} ${number === null ? 'free' : ''}`}
              onClick={() => number !== null && !disabled && onMarkNumber(number)}
              disabled={disabled || number === null || card.marked[rowIndex][colIndex]}
            >
              {number === null ? 'FREE' : number}
            </button>
          ))}
        </div>
      ))}

      <style jsx>{`
        .bingo-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          border: 2px solid #0f3460;
        }

        .bingo-header, .bingo-row {
          display: flex;
          gap: 4px;
        }

        .bingo-cell {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          font-weight: bold;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .bingo-cell.header {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          color: white;
          font-size: 1.5rem;
        }

        .bingo-cell:not(.header) {
          background: #0f3460;
          color: #eee;
          cursor: pointer;
          border: none;
        }

        .bingo-cell:not(.header):hover:not(:disabled) {
          background: #1a4a7a;
          transform: scale(1.05);
        }

        .bingo-cell.marked {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          animation: pop 0.3s ease;
        }

        .bingo-cell.free {
          background: linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%);
          color: #1a1a2e;
          font-size: 0.8rem;
        }

        .bingo-cell:disabled {
          cursor: default;
        }

        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
