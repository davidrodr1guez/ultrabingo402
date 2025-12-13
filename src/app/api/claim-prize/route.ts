import { NextRequest, NextResponse } from 'next/server';
import { generatePrizePayment, PAYMENT_CONFIG, FACILITATOR_URL } from '@/lib/x402';

// In-memory prize pool (use a database in production)
let prizePool = 100; // Starting prize pool: $100 USDC

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardId, winnerAddress } = body;

    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID required' },
        { status: 400 }
      );
    }

    if (!winnerAddress) {
      return NextResponse.json(
        { error: 'Winner address required' },
        { status: 400 }
      );
    }

    // In production, verify the win on the server
    // For demo, we trust the client

    const prizeAmount = prizePool.toFixed(2);
    const payment = generatePrizePayment(winnerAddress, prizeAmount);

    // Reset prize pool after payout
    prizePool = 0;

    return NextResponse.json({
      success: true,
      message: `Prize of $${prizeAmount} USDC claimed!`,
      payment,
      facilitator: FACILITATOR_URL,
      // In production, initiate the transfer via facilitator
    });

  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      { error: 'Prize claim failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    prizePool: prizePool.toFixed(2),
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
    asset: PAYMENT_CONFIG.asset,
    facilitator: FACILITATOR_URL,
  });
}
