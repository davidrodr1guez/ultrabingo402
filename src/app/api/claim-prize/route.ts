import { NextRequest, NextResponse } from 'next/server';
import { generatePrizePayment, PAYMENT_CONFIG, FACILITATOR_URL } from '@/lib/x402';
import { getActiveGame, getWinnersByGame, markWinnerPaid, getClaimById, getWinnerById } from '@/lib/db';

// POST - Claim prize for a verified winner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardId, winnerAddress, claimId, winnerId } = body;

    if (!winnerAddress) {
      return NextResponse.json(
        { error: 'Winner address required' },
        { status: 400 }
      );
    }

    // Get prize info from claim or winner record
    let prizeAmount = '0';

    if (winnerId) {
      const winner = await getWinnerById(winnerId);
      if (winner && winner.wallet_address.toLowerCase() === winnerAddress.toLowerCase()) {
        prizeAmount = winner.prize_amount;

        // Mark winner as paid (in real implementation, execute transfer first)
        // For now we simulate the payment
        const txHash = `0x${Date.now().toString(16)}${'0'.repeat(40)}`.slice(0, 66);
        await markWinnerPaid(winnerId, txHash);

        const payment = generatePrizePayment(winnerAddress, prizeAmount);

        return NextResponse.json({
          success: true,
          message: `Prize of $${prizeAmount} ${PAYMENT_CONFIG.currency} claimed!`,
          payment,
          txHash,
          facilitator: FACILITATOR_URL,
        });
      }
    }

    if (claimId) {
      const claim = await getClaimById(claimId);
      if (claim && claim.status === 'verified' && claim.prize_amount) {
        prizeAmount = claim.prize_amount;
      }
    }

    if (parseFloat(prizeAmount) <= 0) {
      return NextResponse.json(
        { error: 'No verified prize found for this claim' },
        { status: 400 }
      );
    }

    const payment = generatePrizePayment(winnerAddress, prizeAmount);

    return NextResponse.json({
      success: true,
      message: `Prize of $${prizeAmount} ${PAYMENT_CONFIG.currency} ready to claim!`,
      payment,
      facilitator: FACILITATOR_URL,
    });

  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      { error: 'Prize claim failed' },
      { status: 500 }
    );
  }
}

// GET - Get current prize pool info
export async function GET() {
  try {
    const activeGame = await getActiveGame();

    let prizePool = '0';
    let gameId = null;
    let gameName = null;
    let totalEntries = 0;

    if (activeGame) {
      prizePool = activeGame.prize_pool || '0';
      gameId = activeGame.id;
      gameName = activeGame.name;
      totalEntries = activeGame.total_entries || 0;
    }

    return NextResponse.json({
      prizePool,
      gameId,
      gameName,
      totalEntries,
      currency: PAYMENT_CONFIG.currency,
      network: PAYMENT_CONFIG.network,
      asset: PAYMENT_CONFIG.asset,
      facilitator: FACILITATOR_URL,
      entryFee: PAYMENT_CONFIG.entryFee,
    });

  } catch (error) {
    console.error('Error getting prize pool:', error);
    return NextResponse.json({
      prizePool: '0',
      currency: PAYMENT_CONFIG.currency,
      network: PAYMENT_CONFIG.network,
      asset: PAYMENT_CONFIG.asset,
      facilitator: FACILITATOR_URL,
    });
  }
}
