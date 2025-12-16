import { NextRequest, NextResponse } from 'next/server';
import { createGame, getActiveGame, gameOps, DbGame } from '@/lib/db';

// GET - Get active game or all games
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    if (active === 'true') {
      const game = getActiveGame();
      if (!game) {
        return NextResponse.json({ game: null, message: 'No active game' });
      }
      return NextResponse.json({
        game: {
          ...game,
          called_numbers: JSON.parse(game.called_numbers),
        }
      });
    }

    const games = gameOps.getAll.all() as DbGame[];
    const parsedGames = games.map(game => ({
      ...game,
      called_numbers: JSON.parse(game.called_numbers),
    }));

    return NextResponse.json({ games: parsedGames });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}

// POST - Create new game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name = 'Partida', mode = '1-75' } = body;

    // Check if there's already an active game
    const activeGame = getActiveGame();
    if (activeGame) {
      return NextResponse.json(
        { error: 'There is already an active game. End it first.' },
        { status: 400 }
      );
    }

    const gameId = createGame(name, mode);

    return NextResponse.json({
      success: true,
      gameId,
      message: 'Game created'
    });
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
