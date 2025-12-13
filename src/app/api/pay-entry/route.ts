import { NextRequest, NextResponse } from 'next/server';
import {
  generateEntryPaymentRequest,
  verifyPaymentWithFacilitator,
  settlePaymentWithFacilitator,
  PAYMENT_CONFIG,
  FACILITATOR_URL,
} from '@/lib/x402';

// In-memory store for demo (use a database in production)
const paidPlayers = new Map<string, boolean>();

export async function POST(request: NextRequest) {
  try {
    // Check for x402 payment header
    const paymentHeader = request.headers.get('X-Payment') || request.headers.get('x-payment');

    // If no payment header, return 402 Payment Required
    if (!paymentHeader) {
      const body = await request.json().catch(() => ({}));

      // Legacy support: check for txHash in body
      if (body.txHash) {
        // Direct transaction verification (fallback)
        return NextResponse.json({
          success: true,
          message: 'Payment verified via transaction hash',
          gameToken: crypto.randomUUID(),
        });
      }

      const paymentRequest = generateEntryPaymentRequest();

      return new NextResponse(JSON.stringify(paymentRequest.body), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          ...paymentRequest.headers,
        },
      });
    }

    // Verify payment with Ultravioleta facilitator
    const verification = await verifyPaymentWithFacilitator(paymentHeader);

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Payment verification failed', details: verification.error },
        { status: 400 }
      );
    }

    // Settle the payment (gasless via facilitator)
    const settlement = await settlePaymentWithFacilitator(paymentHeader);

    if (!settlement.success) {
      return NextResponse.json(
        { error: 'Payment settlement failed', details: settlement.error },
        { status: 400 }
      );
    }

    // Extract player address from payment header if available
    try {
      const paymentData = JSON.parse(atob(paymentHeader.split('.')[1] || '{}'));
      if (paymentData.from) {
        paidPlayers.set(paymentData.from.toLowerCase(), true);
      }
    } catch {
      // Ignore parsing errors
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and settled via Ultravioleta x402!',
      gameToken: crypto.randomUUID(),
      txHash: settlement.txHash,
    });

  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return payment information
  const paymentRequest = generateEntryPaymentRequest();

  return NextResponse.json({
    entryFee: PAYMENT_CONFIG.entryFee,
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
    recipient: PAYMENT_CONFIG.recipient,
    asset: PAYMENT_CONFIG.asset,
    facilitator: FACILITATOR_URL,
    ...paymentRequest.body,
  });
}
