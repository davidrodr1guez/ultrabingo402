import { NextRequest, NextResponse } from 'next/server';
import { parseUnits } from 'viem';
import {
  verifyPayment,
  settlePayment,
  PAYMENT_CONFIG,
  FACILITATOR_URL,
  X402PaymentPayload,
  buildPaymentRequirements,
  decodePaymentHeader,
} from '@/lib/x402';
import { insertCard, createPayment, confirmPayment } from '@/lib/db';

// Calculate price based on number of cards
function calculatePrice(cardCount: number): string {
  const pricePerCard = parseFloat(PAYMENT_CONFIG.entryFee);
  return (pricePerCard * cardCount).toFixed(2);
}

export async function POST(request: NextRequest) {
  try {
    // Check for x402 payment header
    const paymentHeader = request.headers.get('X-Payment') || request.headers.get('x-payment');

    const body = await request.json().catch(() => ({}));
    const { cards, cardCount = 1, walletAddress } = body;

    // If no payment header, return 402 Payment Required
    if (!paymentHeader) {
      const totalPrice = calculatePrice(cards?.length || cardCount);
      const requirements = buildPaymentRequirements(totalPrice);

      // x402 spec: response body should have { x402Version, accepts: [PaymentRequirements] }
      return new NextResponse(JSON.stringify({
        x402Version: 1,
        error: 'X-PAYMENT header is required',
        accepts: [requirements],
        // Additional info for client convenience
        paymentInfo: {
          amount: totalPrice,
          currency: 'USDC',
          recipient: PAYMENT_CONFIG.recipient,
          network: PAYMENT_CONFIG.network,
          asset: PAYMENT_CONFIG.asset,
          facilitator: FACILITATOR_URL,
        },
      }), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Required': 'true',
          'X-Payment-Address': PAYMENT_CONFIG.recipient,
          'X-Payment-Amount': parseUnits(totalPrice, 6).toString(),
          'X-Payment-Network': PAYMENT_CONFIG.network,
          'X-Payment-Asset': PAYMENT_CONFIG.asset,
          'X-Facilitator-URL': FACILITATOR_URL,
        },
      });
    }

    // Decode the payment payload
    const paymentPayload = decodePaymentHeader(paymentHeader);
    if (!paymentPayload) {
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      );
    }

    console.log('Received payment payload:', JSON.stringify(paymentPayload, null, 2));

    // Validate payload structure
    if (!paymentPayload.payload?.signature || !paymentPayload.payload?.authorization) {
      return NextResponse.json(
        { error: 'Missing signature or authorization in payment' },
        { status: 400 }
      );
    }

    const { authorization } = paymentPayload.payload;

    // Create payment record in DB
    const cardIds = cards?.map((c: any) => c.id) || [];
    const paymentId = await createPayment({
      cardIds,
      walletAddress: authorization.from,
      amount: authorization.value,
      network: paymentPayload.network,
    });

    // Build payment requirements with the actual amount
    const totalPrice = calculatePrice(cards?.length || cardCount);
    const paymentRequirements = buildPaymentRequirements(totalPrice);

    // DEMO MODE: Skip verification for local testing
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';

    if (isDemoMode) {
      console.log('DEMO MODE: Skipping payment verification');

      // Save cards to database with demo payment
      if (cards && Array.isArray(cards)) {
        for (const card of cards) {
          await insertCard({
            id: card.id,
            numbers: card.numbers,
            owner: walletAddress || authorization.from,
            gameMode: body.gameMode || '1-75',
            gameTitle: body.gameTitle || 'UltraBingo',
            txHash: 'demo-' + Date.now(),
            paymentStatus: 'confirmed',
          });
        }
      }

      await confirmPayment(paymentId, 'demo-' + Date.now());

      return NextResponse.json({
        success: true,
        message: 'DEMO: Payment simulated!',
        gameToken: crypto.randomUUID(),
        transaction: 'demo-tx-' + Date.now(),
        network: 'demo',
        paymentId,
        cardIds,
        demo: true,
      });
    }

    // Step 1: Verify payment with Ultravioleta facilitator
    console.log('Verifying payment with facilitator...');
    const verification = await verifyPayment(paymentPayload, paymentRequirements);

    if (!verification.isValid) {
      console.log('Verification failed:', verification.invalidReason);
      return NextResponse.json(
        { error: 'Payment verification failed', details: verification.invalidReason },
        { status: 400 }
      );
    }

    console.log('Payment verified successfully!');

    // Step 2: Settle payment on-chain via facilitator (gasless)
    console.log('Settling payment with facilitator...');
    const settlement = await settlePayment(paymentPayload, paymentRequirements);

    if (!settlement.success) {
      console.log('Settlement failed:', settlement.error);
      return NextResponse.json(
        { error: 'Payment settlement failed', details: settlement.error },
        { status: 400 }
      );
    }

    // Update payment status in DB
    await confirmPayment(paymentId, settlement.transaction || '');

    // Save cards to database with confirmed payment
    if (cards && Array.isArray(cards)) {
      for (const card of cards) {
        await insertCard({
          id: card.id,
          numbers: card.numbers,
          owner: authorization.from,
          gameMode: body.gameMode || '1-75',
          gameTitle: body.gameTitle || 'UltraBingo',
          txHash: settlement.transaction,
          paymentStatus: 'confirmed',
        });
      }
    }

    console.log(`Payment settled! TX: ${settlement.transaction}`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and settled!',
      gameToken: crypto.randomUUID(),
      transaction: settlement.transaction,
      network: paymentPayload.network,
      paymentId,
      cardIds,
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
  return NextResponse.json({
    entryFee: PAYMENT_CONFIG.entryFee,
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
    recipient: PAYMENT_CONFIG.recipient,
    asset: PAYMENT_CONFIG.asset,
    facilitator: FACILITATOR_URL,
    requirements: buildPaymentRequirements(),
  });
}
