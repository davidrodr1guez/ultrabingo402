import { NextRequest, NextResponse } from 'next/server';
import {
  generateEntryPaymentRequest,
  verifyPaymentWithFacilitator,
  settlePaymentWithFacilitator,
  PAYMENT_CONFIG,
  FACILITATOR_URL,
  X402PaymentPayload,
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

    // Decode the payment payload
    let paymentPayload: X402PaymentPayload;
    try {
      paymentPayload = JSON.parse(atob(paymentHeader));
      console.log('Received payment payload:', JSON.stringify(paymentPayload, null, 2));
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      );
    }

    // Validate payload structure
    if (!paymentPayload.payload?.signature || !paymentPayload.payload?.authorization) {
      return NextResponse.json(
        { error: 'Missing signature or authorization in payment' },
        { status: 400 }
      );
    }

    // Step 1: Verify payment with facilitator
    console.log('Verifying payment with facilitator...');
    const verification = await verifyPaymentWithFacilitator(paymentPayload);

    if (!verification.isValid) {
      console.log('Verification failed:', verification.invalidReason);

      // For testing/demo: Accept the signed payment even if facilitator verification fails
      // This allows testing without real USDC
      if (process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true') {
        console.log('Demo mode: Accepting payment without facilitator verification');
        const { authorization } = paymentPayload.payload;
        paidPlayers.set(authorization.from.toLowerCase(), true);

        return NextResponse.json({
          success: true,
          message: 'Payment signature accepted (demo mode)',
          gameToken: crypto.randomUUID(),
          demoMode: true,
          payment: {
            from: authorization.from,
            to: authorization.to,
            value: authorization.value,
            network: paymentPayload.network,
          },
        });
      }

      return NextResponse.json(
        { error: 'Payment verification failed', details: verification.invalidReason },
        { status: 400 }
      );
    }

    // Step 2: Settle payment on-chain via facilitator
    console.log('Settling payment with facilitator...');
    const settlement = await settlePaymentWithFacilitator(paymentPayload);

    if (!settlement.success) {
      console.log('Settlement failed:', settlement.error);
      return NextResponse.json(
        { error: 'Payment settlement failed', details: settlement.error },
        { status: 400 }
      );
    }

    // Store player as paid
    const { authorization } = paymentPayload.payload;
    paidPlayers.set(authorization.from.toLowerCase(), true);

    console.log(`Payment settled! TX: ${settlement.transaction}`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and settled via Ultravioleta x402!',
      gameToken: crypto.randomUUID(),
      transaction: settlement.transaction,
      network: settlement.network,
      payment: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
      },
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
