import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalStats,
  getRecentGamesWithStats,
  getAllWinners,
  getActiveGame,
} from '@/lib/db';
import { PAYMENT_CONFIG } from '@/lib/x402';

// GET - Get global stats and recent activity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'global';

    if (type === 'global') {
      const stats = await getGlobalStats();
      const activeGame = await getActiveGame();

      return NextResponse.json({
        stats: {
          totalGames: stats?.total_games || 0,
          totalCardsSold: stats?.total_cards_sold || 0,
          totalRevenue: stats?.total_revenue || '0',
          totalPrizesPaid: stats?.total_prizes_paid || '0',
          totalWinners: stats?.total_winners || 0,
          updatedAt: stats?.updated_at,
        },
        activeGame: activeGame ? {
          id: activeGame.id,
          name: activeGame.name,
          status: activeGame.status,
          prizePool: activeGame.prize_pool,
          totalEntries: activeGame.total_entries,
          calledNumbers: JSON.parse(activeGame.called_numbers).length,
        } : null,
        config: {
          entryFee: PAYMENT_CONFIG.entryFee,
          currency: PAYMENT_CONFIG.currency,
          network: PAYMENT_CONFIG.network,
          prizePoolPercentage: PAYMENT_CONFIG.prizePoolPercentage,
        },
      });
    }

    if (type === 'games') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const games = await getRecentGamesWithStats(limit);

      const parsedGames = games.map(game => ({
        id: game.id,
        name: game.name,
        mode: game.mode,
        status: game.status,
        createdAt: game.created_at,
        endedAt: game.ended_at,
        entryFee: game.entry_fee,
        prizePool: game.prize_pool,
        totalEntries: game.total_entries,
        winnerAddress: game.winner_address,
        winnerCardId: game.winner_card_id,
        prizePaid: game.prize_paid,
        winnerCount: game.winner_count,
      }));

      return NextResponse.json({ games: parsedGames });
    }

    if (type === 'winners') {
      const winners = await getAllWinners();

      const parsedWinners = winners.map(winner => ({
        id: winner.id,
        gameId: winner.game_id,
        claimId: winner.claim_id,
        walletAddress: winner.wallet_address,
        cardId: winner.card_id,
        pattern: winner.pattern,
        prizeAmount: winner.prize_amount,
        txHash: winner.tx_hash,
        status: winner.status,
        createdAt: winner.created_at,
        paidAt: winner.paid_at,
      }));

      return NextResponse.json({ winners: parsedWinners });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter. Use: global, games, or winners' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
