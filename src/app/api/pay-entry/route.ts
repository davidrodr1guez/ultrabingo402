import { NextRequest, NextResponse } from 'next/server';
import { generateEntryPaymentRequest, verifyPayment, PAYMENT_CONFIG } from '@/lib/x402';

// In-memory store for demo (use a database in production)
const paidPlayers = new Map<string, boolean>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash, playerAddress } = body;

    // If no transaction hash provided, return x402 Payment Required
    if (!txHash) {
      const paymentRequest = generateEntryPaymentRequest();

      return new NextResponse(JSON.stringify(paymentRequest.body), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          ...paymentRequest.headers,
        },
      });
    }

    // Verify the payment on-chain
    const isValid = await verifyPayment(
      txHash,
      PAYMENT_CONFIG.entryFee,
      PAYMENT_CONFIG.recipient
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Mark player as paid
    if (playerAddress) {
      paidPlayers.set(playerAddress.toLowerCase(), true);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified. You can now play!',
      gameToken: crypto.randomUUID(), // Token to start the game
    });

  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return payment information
  const paymentRequest = generateEntryPaymentRequest();

  return NextResponse.json({
    entryFee: PAYMENT_CONFIG.entryFee,
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
    recipient: PAYMENT_CONFIG.recipient,
    ...paymentRequest.body,
  });
}
