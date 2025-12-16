import { NextRequest, NextResponse } from 'next/server';
import { gameOps, updateGameNumbers, endGame, DbGame } from '@/lib/db';

// GET - Get game by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const game = gameOps.getById.get(id) as DbGame | undefined;

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({
      game: {
        ...game,
        called_numbers: JSON.parse(game.called_numbers),
      }
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
  }
}

// PATCH - Update game (call numbers, end game)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, number, calledNumbers } = body;

    const game = gameOps.getById.get(id) as DbGame | undefined;
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status !== 'active') {
      return NextResponse.json({ error: 'Game is not active' }, { status: 400 });
    }

    if (action === 'call') {
      // Call a specific number
      const currentNumbers = JSON.parse(game.called_numbers) as number[];

      if (currentNumbers.includes(number)) {
        return NextResponse.json({ error: 'Number already called' }, { status: 400 });
      }

      const maxNumber = game.mode === '1-75' ? 75 : 90;
      if (number < 1 || number > maxNumber) {
        return NextResponse.json({ error: 'Invalid number' }, { status: 400 });
      }

      currentNumbers.push(number);
      updateGameNumbers(id, currentNumbers, number);

      return NextResponse.json({
        success: true,
        calledNumbers: currentNumbers,
        currentNumber: number
      });
    }

    if (action === 'uncall') {
      // Remove the last called number
      const currentNumbers = JSON.parse(game.called_numbers) as number[];

      if (currentNumbers.length === 0) {
        return NextResponse.json({ error: 'No numbers to uncall' }, { status: 400 });
      }

      currentNumbers.pop();
      const newCurrent = currentNumbers[currentNumbers.length - 1] || null;
      updateGameNumbers(id, currentNumbers, newCurrent);

      return NextResponse.json({
        success: true,
        calledNumbers: currentNumbers,
        currentNumber: newCurrent
      });
    }

    if (action === 'sync') {
      // Sync called numbers from admin panel
      if (!Array.isArray(calledNumbers)) {
        return NextResponse.json({ error: 'calledNumbers must be an array' }, { status: 400 });
      }

      const currentNumber = calledNumbers[calledNumbers.length - 1] || null;
      updateGameNumbers(id, calledNumbers, currentNumber);

      return NextResponse.json({
        success: true,
        calledNumbers,
        currentNumber
      });
    }

    if (action === 'end') {
      endGame(id);
      return NextResponse.json({
        success: true,
        message: 'Game ended'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}

// DELETE - Delete game
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const game = gameOps.getById.get(id) as DbGame | undefined;
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    gameOps.delete.run(id);

    return NextResponse.json({
      success: true,
      message: 'Game deleted'
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}
