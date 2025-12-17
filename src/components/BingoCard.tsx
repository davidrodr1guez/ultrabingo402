import { BingoCard as BingoCardType, GameMode } from '@/lib/bingo';
import { BINGO_THEMES, BingoTheme, DEFAULT_THEME } from '@/lib/themes';

interface BingoCardProps {
  card: BingoCardType;
  onMarkNumber: (number: number) => void;
  disabled?: boolean;
  mode?: GameMode;
  calledNumbers?: number[];
  showAutoMark?: boolean;
  theme?: BingoTheme;
}

export default function BingoCard({
  card,
  onMarkNumber,
  disabled,
  mode = '1-75',
  calledNumbers = [],
  showAutoMark = true,
  theme = DEFAULT_THEME,
}: BingoCardProps) {
  const headers = mode === '1-75' ? ['B', 'I', 'N', 'G', 'O'] : null;
  const is75Mode = mode === '1-75';

  const isNumberCalled = (num: number | string | null): boolean => {
    if (num === null) return false;
    return calledNumbers.includes(num as number);
  };

  const canMark = (num: number | string | null, rowIndex: number, colIndex: number): boolean => {
    if (disabled) return false;
    if (num === null) return false;
    if (card.marked[rowIndex][colIndex]) return false;
    return isNumberCalled(num);
  };

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
      {card.title && <div className="card-title">{card.title}</div>}

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
            const isMarked = card.marked[rowIndex][colIndex];
            const isCalled = isNumberCalled(number);
            const isFree = number === null;
            const canClick = canMark(number, rowIndex, colIndex);

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-cell
                  ${isMarked ? 'marked' : ''}
                  ${isFree ? 'free' : ''}
                  ${isCalled && !isMarked ? 'callable' : ''}
                  ${!isCalled && !isFree && !isMarked ? 'uncalled' : ''}
                `}
                onClick={() => {
                  if (canClick && number !== null) {
                    onMarkNumber(number as number);
                  }
                }}
                disabled={!canClick}
              >
                {isFree ? 'FREE' : number}
                {isMarked && !isFree && <span className="mark-indicator">X</span>}
              </button>
            );
          })}
        </div>
      ))}

      <style jsx>{`
        .bingo-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: var(--card-bg);
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          border: 2px solid var(--border-color);
        }

        .card-title {
          text-align: center;
          font-weight: bold;
          color: var(--cell-text);
          margin-bottom: 10px;
          font-size: 1.1rem;
        }

        .bingo-header, .bingo-row {
          display: flex;
          gap: 4px;
        }

        .mode-75 .bingo-cell {
          width: 60px;
          height: 60px;
          font-size: 1.2rem;
        }

        .mode-90 .bingo-cell {
          width: 45px;
          height: 50px;
          font-size: 1rem;
        }

        .bingo-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          border-radius: 8px;
          transition: all 0.2s ease;
          position: relative;
        }

        .bingo-cell.header {
          background: var(--header-bg);
          color: var(--header-text);
          font-size: 1.5rem;
        }

        .bingo-cell:not(.header) {
          background: var(--cell-bg);
          color: var(--cell-text);
          cursor: pointer;
          border: none;
        }

        .bingo-cell.uncalled {
          background: var(--uncalled-bg);
          color: var(--uncalled-text);
        }

        .bingo-cell.callable {
          background: var(--callable-bg);
          color: var(--cell-text);
          animation: glow 1.5s infinite;
          cursor: pointer;
        }

        .bingo-cell.callable:hover {
          transform: scale(1.05);
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px var(--accent-color); }
          50% { box-shadow: 0 0 15px var(--accent-color); }
        }

        .bingo-cell.marked {
          background: var(--marked-bg);
          color: var(--marked-text);
          animation: pop 0.3s ease;
        }

        .mark-indicator {
          position: absolute;
          font-size: 2rem;
          color: rgba(255, 255, 255, 0.3);
          pointer-events: none;
        }

        .bingo-cell.free {
          background: var(--free-bg);
          color: var(--free-text);
          font-size: 0.7rem;
          font-weight: bold;
        }

        .bingo-cell:disabled {
          cursor: default;
        }

        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        @media (max-width: 480px) {
          .mode-75 .bingo-cell {
            width: 50px;
            height: 50px;
            font-size: 1rem;
          }

          .mode-90 .bingo-cell {
            width: 35px;
            height: 40px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}
