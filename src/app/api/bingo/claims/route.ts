import { NextRequest, NextResponse } from 'next/server';
import {
  getAllClaims,
  getPendingClaims,
  getClaimById,
  verifyClaim,
  rejectClaim,
  createWinner,
  getGameById,
  setGameWinner,
} from '@/lib/db';
import { PAYMENT_CONFIG } from '@/lib/x402';

// GET - Get all claims or pending claims
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending');

    let claims;
    if (pending === 'true') {
      claims = await getPendingClaims();
    } else {
      claims = await getAllClaims();
    }

    // Parse JSON fields for response
    const parsedClaims = claims.map(claim => ({
      id: claim.id,
      cardId: claim.card_id,
      gameId: claim.game_id,
      walletAddress: claim.wallet_address,
      markedNumbers: JSON.parse(claim.marked_numbers),
      cardNumbers: JSON.parse(claim.card_numbers),
      pattern: claim.pattern,
      calledNumbersAtClaim: JSON.parse(claim.called_numbers_at_claim),
      status: claim.status,
      createdAt: claim.created_at,
      verifiedAt: claim.verified_at,
      rejectedAt: claim.rejected_at,
      rejectionReason: claim.rejection_reason,
      prizeAmount: claim.prize_amount,
      prizeTxHash: claim.prize_tx_hash,
    }));

    return NextResponse.json({ claims: parsedClaims, count: parsedClaims.length });

  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// PATCH - Verify or reject a claim
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimId, action, reason } = body;

    if (!claimId) {
      return NextResponse.json(
        { error: 'Claim ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['verify', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "verify" or "reject"' },
        { status: 400 }
      );
    }

    const claim = await getClaimById(claimId);
    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'pending') {
      return NextResponse.json(
        { error: `Claim is already ${claim.status}` },
        { status: 400 }
      );
    }

    let updatedClaim;
    let prizeAmount: string | undefined;
    let winnerId: string | undefined;

    if (action === 'verify') {
      // Get game info for prize calculation
      let game = null;
      if (claim.game_id) {
        game = await getGameById(claim.game_id);
      }

      // Calculate prize amount (use game's prize pool or default)
      if (game && parseFloat(game.prize_pool) > 0) {
        prizeAmount = game.prize_pool;
      } else {
        // Default prize for testing
        prizeAmount = '1.00';
      }

      // Verify the claim
      updatedClaim = await verifyClaim(claimId, prizeAmount);

      // Create winner record
      if (updatedClaim) {
        winnerId = await createWinner({
          gameId: claim.game_id || 'unknown',
          claimId: claim.id,
          walletAddress: claim.wallet_address,
          cardId: claim.card_id,
          pattern: claim.pattern,
          prizeAmount,
        });

        // Update game with winner info
        if (claim.game_id) {
          await setGameWinner(
            claim.game_id,
            claim.wallet_address,
            claim.card_id,
            prizeAmount
          );
        }
      }
    } else {
      if (!reason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        );
      }
      updatedClaim = await rejectClaim(claimId, reason);
    }

    if (!updatedClaim) {
      return NextResponse.json(
        { error: 'Failed to update claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: action === 'verify'
        ? `Claim verified! Prize: $${prizeAmount} ${PAYMENT_CONFIG.currency}`
        : 'Claim rejected',
      claim: {
        id: updatedClaim.id,
        cardId: updatedClaim.card_id,
        status: updatedClaim.status,
        prizeAmount: updatedClaim.prize_amount,
        verifiedAt: updatedClaim.verified_at,
        rejectedAt: updatedClaim.rejected_at,
      },
      winnerId,
      prizeAmount,
    });

  } catch (error) {
    console.error('Error updating claim:', error);
    return NextResponse.json(
      { error: 'Failed to update claim' },
      { status: 500 }
    );
  }
}
