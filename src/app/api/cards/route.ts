import { NextRequest, NextResponse } from 'next/server';
import { insertCard, getAllCards, getCardsByOwner, deleteAllCards } from '@/lib/db';
import { generateBingoCard, GameMode } from '@/lib/bingo';

// GET - Get all cards or by owner
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');

    let cards;
    if (owner) {
      cards = await getCardsByOwner(owner);
    } else {
      cards = await getAllCards();
    }

    // Parse the numbers JSON
    const parsedCards = cards.map(card => ({
      ...card,
      numbers: JSON.parse(card.numbers),
    }));

    return NextResponse.json({ cards: parsedCards });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}

// POST - Create new cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cards, // Pre-generated cards from frontend
      owner = 'anonymous',
      gameMode = '1-75',
      gameTitle = 'UltraBingo',
      count = 1, // If no cards provided, generate this many
    } = body;

    const createdCards = [];

    if (cards && Array.isArray(cards)) {
      // Save pre-generated cards
      for (const card of cards) {
        await insertCard({
          id: card.id,
          numbers: card.numbers,
          owner,
          gameMode,
          gameTitle,
          paymentStatus: 'pending',
        });
        createdCards.push(card);
      }
    } else {
      // Generate new cards
      for (let i = 0; i < count; i++) {
        const card = generateBingoCard(gameMode as GameMode, gameTitle);
        await insertCard({
          id: card.id,
          numbers: card.numbers as number[][],
          owner,
          gameMode,
          gameTitle,
          paymentStatus: 'pending',
        });
        createdCards.push(card);
      }
    }

    return NextResponse.json({
      success: true,
      cards: createdCards,
      message: `${createdCards.length} cards created`
    });
  } catch (error) {
    console.error('Error creating cards:', error);
    return NextResponse.json({ error: 'Failed to create cards' }, { status: 500 });
  }
}

// DELETE - Delete all cards (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await deleteAllCards();
    return NextResponse.json({ success: true, message: 'All cards deleted' });
  } catch (error) {
    console.error('Error deleting cards:', error);
    return NextResponse.json({ error: 'Failed to delete cards' }, { status: 500 });
  }
}
