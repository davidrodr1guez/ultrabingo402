import { NextRequest, NextResponse } from 'next/server';
import { generatePrizePayment, PAYMENT_CONFIG } from '@/lib/x402';

// In-memory prize pool (use a database in production)
let prizePool = 0.1; // Starting prize pool in ETH

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

    // In production, verify the win on the server
    // For demo, we trust the client

    const prizeAmount = prizePool.toString();
    const payment = generatePrizePayment(
      winnerAddress || PAYMENT_CONFIG.recipient,
      prizeAmount
    );

    // Reset prize pool after payout
    prizePool = 0;

    return NextResponse.json({
      success: true,
      message: 'Prize claimed!',
      payment,
      txHash: '0x...', // In production, this would be the actual transaction hash
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
    prizePool: prizePool.toFixed(4),
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
  });
}
