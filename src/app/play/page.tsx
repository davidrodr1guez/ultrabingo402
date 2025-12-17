'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import Link from 'next/link';
import { BingoCard as BingoCardType, checkWin, getBingoLetter, speakNumber } from '@/lib/bingo';
import BingoCard from '@/components/BingoCard';
import ConnectWalletButton from '@/components/ConnectWalletButton';

// Game state interface
interface GameState {
    id: string;
    name: string;
    mode: '1-75' | '1-90';
    status: string;
    called_numbers: number[];
}

export default function PlayPage() {
    const { isConnected, address } = useAccount();

    // Game State
    const [activeGame, setActiveGame] = useState<GameState | null>(null);
    const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);

    // Player State
    const [myCards, setMyCards] = useState<BingoCardType[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState(false);

    // UI State
    const [notification, setNotification] = useState<{ msg: string, type: 'info' | 'win' } | null>(null);

    // Poll for active game
    useEffect(() => {
        const fetchGame = async () => {
            try {
                const res = await fetch('/api/games?active=true');
                const data = await res.json();

                if (data.game) {
                    setActiveGame(prev => {
                        // Detect new number
                        const newNumbers = data.game.called_numbers;
                        const oldNumbers = prev?.called_numbers || [];

                        if (newNumbers.length > oldNumbers.length) {
                            const last = newNumbers[newNumbers.length - 1];
                            // Only speak if it's a new number (not initial load)
                            if (prev && last !== oldNumbers[oldNumbers.length - 1]) {
                                setLastCalledNumber(last);
                                speakNumber(last, data.game.mode);
                            } else if (!prev) {
                                // Initial load
                                setLastCalledNumber(last);
                            }
                        }
                        return data.game;
                    });
                } else {
                    setActiveGame(null);
                }
            } catch (error) {
                console.error('Error polling game:', error);
            }
        };

        fetchGame();
        const interval = setInterval(fetchGame, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    // Fetch player cards when connected
    useEffect(() => {
        if (!isConnected || !address) {
            setMyCards([]);
            return;
        }

        const fetchCards = async () => {
            setIsLoadingCards(true);
            try {
                const res = await fetch(`/api/cards?owner=${address}`);
                const data = await res.json();
                if (data.cards) {
                    const formattedCards: BingoCardType[] = data.cards.map((c: any) => ({
                        id: c.id,
                        numbers: c.numbers,
                        marked: Array(5).fill(null).map(() => Array(5).fill(false)),
                        title: c.game_title
                    }));
                    setMyCards(formattedCards);
                }
            } catch (error) {
                console.error('Error fetching cards:', error);
            } finally {
                setIsLoadingCards(false);
            }
        };

        fetchCards();
    }, [isConnected, address]);

    // Handle marking a number
    const handleMarkNumber = (cardId: string, number: number) => {
        setMyCards(prevCards => prevCards.map(card => {
            if (card.id !== cardId) return card;

            // Find position of number
            let newMarked = [...card.marked.map(row => [...row])];
            let found = false;

            card.numbers.forEach((row, rIdx) => {
                row.forEach((n, cIdx) => {
                    if (n === number) {
                        newMarked[rIdx][cIdx] = true;
                        found = true;
                    }
                });
            });

            if (found) {
                // Check for Win (Line default)
                const updatedCard = { ...card, marked: newMarked };
                const isWin = checkWin(updatedCard, 'line');

                if (isWin) {
                    // Optional: Auto-notify or just let user click Bingo
                    console.log('Possible Line Bingo on card', card.id);
                }
                return updatedCard;
            }
            return card;
        }));
    };

    const handleClaimBingo = (card: BingoCardType) => {
        setNotification({ msg: `Verificando BINGO para cartón ${card.id.slice(0, 8)}...`, type: 'info' });

        // Simple client check for feedback
        if (checkWin(card, 'line') || checkWin(card, 'full-house')) {
            setNotification({ msg: `¡BINGO! Grita "Bingo" y muéstrale tu cartón (ID: ${card.id.slice(0, 4)}) al host!`, type: 'win' });

            // Fanfare speech
            if (window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance('Bingo! Bingo! Bingo!');
                utterance.rate = 1.2;
                window.speechSynthesis.speak(utterance);
            }
        } else {
            setNotification({ msg: `Aún no parece haber Bingo. Revisa tus números.`, type: 'info' });
        }
    };

    return (
        <main className="play-container">
            <header className="play-header">
                <Link href="/" className="logo-link">
                    <Image src="/logo.svg" alt="UltraBingo" width={120} height={70} />
                </Link>
                <div className="header-right">
                    <ConnectWalletButton />
                </div>
            </header>

            {/* Game Status Bar */}
            <div className="status-bar">
                {activeGame ? (
                    <div className="active-game-info">
                        <span className="live-indicator">● EN VIVO</span>
                        <span className="game-name">{activeGame.name}</span>
                        <span className="ball-count">Bolas: {activeGame.called_numbers.length}</span>
                    </div>
                ) : (
                    <div className="no-game-info">
                        <span className="offline-indicator">● OFFLINE</span>
                        <span>Esperando inicio de partida...</span>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="play-content">

                {/* Left: Last Ball Display */}
                <div className="ball-display-section">
                    {activeGame ? (
                        <div className="current-ball-wrapper">
                            <div className={`current-ball ${lastCalledNumber ? 'pop' : ''}`}>
                                {lastCalledNumber ? (
                                    <>
                                        {activeGame.mode === '1-75' && (
                                            <span className="ball-letter">{getBingoLetter(lastCalledNumber)}</span>
                                        )}
                                        <span className="ball-number">{lastCalledNumber}</span>
                                    </>
                                ) : (
                                    <span className="waiting-text">Esperando...</span>
                                )}
                            </div>
                            <div className="last-called-list">
                                {activeGame.called_numbers.slice(-5, -1).reverse().map((num, i) => (
                                    <span key={i} className="mini-ball">{num}</span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="waiting-screen">
                            <div className="loader">🎱</div>
                            <p>El juego comenzará pronto</p>
                        </div>
                    )}
                </div>

                {/* Right: Player Cards */}
                <div className="player-cards-section">
                    {!isConnected ? (
                        <div className="connect-prompt">
                            <h2>Conecta tu wallet para jugar</h2>
                            <p>Podrás ver tus cartones comprados aquí.</p>
                        </div>
                    ) : isLoadingCards ? (
                        <div className="loading-cards">Cargando tus cartones...</div>
                    ) : myCards.length === 0 ? (
                        <div className="no-cards">
                            <p>No tienes cartones para este juego.</p>
                            <Link href="/" className="buy-link">Comprar Cartones</Link>
                        </div>
                    ) : (
                        <div className="cards-grid-play">
                            {myCards.map(card => (
                                <div key={card.id} className="play-card-wrapper">
                                    <div className="play-card-header">
                                        <span className="card-id">#{card.id.slice(0, 4)}</span>
                                        <button
                                            className="btn-bingo"
                                            onClick={() => handleClaimBingo(card)}
                                        >
                                            ¡BINGO!
                                        </button>
                                    </div>
                                    <BingoCard
                                        card={card}
                                        onMarkNumber={(num) => handleMarkNumber(card.id, num)}
                                        mode={activeGame?.mode as any || '1-75'}
                                        calledNumbers={activeGame?.called_numbers || []}
                                        showAutoMark={true}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {notification && (
                <div className={`notification ${notification.type}`}>
                    {notification.msg}
                    <button onClick={() => setNotification(null)}>×</button>
                </div>
            )}

            <style jsx>{`
        .play-container {
          min-height: 100vh;
          background: #0a0a1a;
          color: white;
          padding-bottom: 40px;
        }

        .play-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: rgba(26, 26, 46, 0.9);
          border-bottom: 1px solid #2a2a40;
        }

        .status-bar {
          background: #0f3460;
          padding: 10px 20px;
          text-align: center;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .active-game-info, .no-game-info {
          display: flex;
          gap: 15px;
          justify-content: center;
          align-items: center;
        }

        .live-indicator { color: #e94560; animation: pulse 1.5s infinite; }
        .offline-indicator { color: #888; }
        .game-name { color: #fff; }
        .ball-count { color: #00b894; }

        .play-content {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Left Column */
        .ball-display-section {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          height: fit-content;
          border: 2px solid #0f3460;
          position: sticky;
          top: 20px;
        }

        .current-ball {
          width: 200px;
          height: 200px;
          margin: 0 auto 20px;
          background: radial-gradient(circle at 30% 30%, #e94560, #c0392b);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
          border: 5px solid rgba(255,255,255,0.1);
        }

        .current-ball.pop {
           animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .ball-letter { font-size: 2.5rem; line-height: 1; opacity: 0.9; }
        .ball-number { font-size: 5rem; font-weight: 800; line-height: 1; }
        .waiting-text { font-size: 1.2rem; color: rgba(255,255,255,0.7); }

        .last-called-list {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 15px;
        }

        .mini-ball {
          background: #0f3460;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #aaa;
        }

        /* Right Column */
        .player-cards-section {
           /* flex grow handled by grid */
        }

        .connect-prompt, .no-cards, .loading-cards {
          text-align: center;
          padding: 50px;
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          color: #aaa;
        }
        
        .buy-link {
          display: inline-block;
          margin-top: 20px;
          padding: 10px 25px;
          background: #00b894;
          color: white;
          border-radius: 25px;
          font-weight: bold;
        }

        .cards-grid-play {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .play-card-wrapper {
          background: rgba(0,0,0,0.2);
          padding: 10px;
          border-radius: 12px;
        }

        .play-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 0 5px;
        }

        .card-id { color: #888; font-size: 0.9rem; }
        
        .btn-bingo {
          background: linear-gradient(135deg, #f1c40f, #f39c12);
          border: none;
          color: #000;
          font-weight: 900;
          padding: 5px 15px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.9rem;
          box-shadow: 0 4px 10px rgba(243, 156, 18, 0.4);
          transition: transform 0.2s;
        }
        
        .btn-bingo:hover {
          transform: scale(1.1);
        }

        .notification {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          padding: 15px 30px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          gap: 15px;
          z-index: 1000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: slideUp 0.3s ease;
        }

        .notification.win { background: #00b894; color: white; font-weight: bold; font-size: 1.2rem; }
        .notification.info { background: #0f3460; color: white; border: 1px solid #1a4a7a; }
        
        .notification button {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.7;
        }

        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 80% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }

        @media (max-width: 900px) {
          .play-content {
            grid-template-columns: 1fr;
          }
          
          .ball-display-section {
            position: relative;
            top: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 20px;
            text-align: left;
          }
          
          .current-ball {
            width: 80px;
            height: 80px;
            margin: 0;
          }
          
          .ball-letter { font-size: 1.2rem; }
          .ball-number { font-size: 2.2rem; }
          .last-called-list { margin-top: 0; }
        }
      `}</style>
        </main>
    );
}
