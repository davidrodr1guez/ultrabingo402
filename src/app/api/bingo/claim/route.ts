import { NextRequest, NextResponse } from 'next/server';
import { submitClaim, hasExistingClaim, getClaimsByWallet } from '@/lib/claims';
import { validateBingo, WinPattern, BingoCard } from '@/lib/bingo';
import { getActiveGame } from '@/lib/db';

// POST - Submit a BINGO claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cardId,
      walletAddress,
      markedNumbers,
      cardNumbers,
      pattern = 'line',
    } = body;

    // Validate required fields
    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!markedNumbers || !Array.isArray(markedNumbers)) {
      return NextResponse.json(
        { error: 'Marked numbers are required' },
        { status: 400 }
      );
    }

    if (!cardNumbers || !Array.isArray(cardNumbers)) {
      return NextResponse.json(
        { error: 'Card numbers are required' },
        { status: 400 }
      );
    }

    // Check if this card already has a claim
    if (hasExistingClaim(cardId)) {
      return NextResponse.json(
        { error: 'This card already has a pending or verified claim' },
        { status: 400 }
      );
    }

    // Get active game info
    let gameId: string | null = null;
    let gameName: string | null = null;
    let calledNumbers: number[] = [];

    try {
      const activeGame = await getActiveGame();
      if (activeGame) {
        gameId = activeGame.id;
        gameName = activeGame.name;
        calledNumbers = JSON.parse(activeGame.called_numbers);
      }
    } catch (error) {
      // Database might not be available in demo mode
      console.log('Could not fetch active game:', error);
    }

    // Create a card object for validation
    const card: BingoCard = {
      id: cardId,
      numbers: cardNumbers,
      marked: cardNumbers.map((row: (number | null)[]) =>
        row.map((num: number | null) =>
          num === null ? true : markedNumbers.includes(num)
        )
      ),
    };

    // Validate the BINGO claim
    const isValid = validateBingo(card, markedNumbers, pattern as WinPattern);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid BINGO claim. The marked numbers do not form a valid winning pattern.' },
        { status: 400 }
      );
    }

    // If we have called numbers from the game, verify marked numbers were actually called
    if (calledNumbers.length > 0) {
      const invalidMarks = markedNumbers.filter(num => !calledNumbers.includes(num));
      if (invalidMarks.length > 0) {
        return NextResponse.json(
          {
            error: 'Invalid claim. You marked numbers that were not called.',
            invalidNumbers: invalidMarks
          },
          { status: 400 }
        );
      }
    }

    // Submit the claim
    const claim = submitClaim({
      cardId,
      walletAddress,
      markedNumbers,
      cardNumbers,
      pattern,
      gameId,
      gameName,
      calledNumbersAtClaim: calledNumbers,
    });

    return NextResponse.json({
      success: true,
      message: 'BINGO claim submitted! Waiting for verification.',
      claim: {
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
      },
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    return NextResponse.json(
      { error: 'Failed to submit claim' },
      { status: 500 }
    );
  }
}

// GET - Get claims for a wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const claims = getClaimsByWallet(walletAddress);

    return NextResponse.json({ claims });

  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}
