import { NextRequest, NextResponse } from 'next/server';
import {
  getAllClaims,
  getPendingClaims,
  getClaimById,
  verifyClaim,
  rejectClaim,
} from '@/lib/claims';

// GET - Get all claims or pending claims
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending');

    if (pending === 'true') {
      const claims = getPendingClaims();
      return NextResponse.json({ claims, count: claims.length });
    }

    const claims = getAllClaims();
    return NextResponse.json({ claims, count: claims.length });

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

    const claim = getClaimById(claimId);
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
    if (action === 'verify') {
      updatedClaim = verifyClaim(claimId);
    } else {
      if (!reason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        );
      }
      updatedClaim = rejectClaim(claimId, reason);
    }

    if (!updatedClaim) {
      return NextResponse.json(
        { error: 'Failed to update claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: action === 'verify' ? 'Claim verified!' : 'Claim rejected',
      claim: updatedClaim,
    });

  } catch (error) {
    console.error('Error updating claim:', error);
    return NextResponse.json(
      { error: 'Failed to update claim' },
      { status: 500 }
    );
  }
}
