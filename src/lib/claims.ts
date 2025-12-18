// In-memory claims store (use a database in production)
// This stores BINGO claims that players submit

export interface BingoClaim {
  id: string;
  cardId: string;
  walletAddress: string;
  markedNumbers: number[];
  cardNumbers: (number | null)[][];
  pattern: string;
  gameId: string | null;
  gameName: string | null;
  calledNumbersAtClaim: number[];
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Global claims store
const claims: Map<string, BingoClaim> = new Map();

// Generate unique ID
function generateClaimId(): string {
  return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Submit a new claim
export function submitClaim(data: {
  cardId: string;
  walletAddress: string;
  markedNumbers: number[];
  cardNumbers: (number | null)[][];
  pattern: string;
  gameId: string | null;
  gameName: string | null;
  calledNumbersAtClaim: number[];
}): BingoClaim {
  const claim: BingoClaim = {
    id: generateClaimId(),
    ...data,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  claims.set(claim.id, claim);
  return claim;
}

// Get all claims
export function getAllClaims(): BingoClaim[] {
  return Array.from(claims.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Get pending claims
export function getPendingClaims(): BingoClaim[] {
  return getAllClaims().filter(c => c.status === 'pending');
}

// Get claim by ID
export function getClaimById(id: string): BingoClaim | undefined {
  return claims.get(id);
}

// Verify a claim (mark as verified)
export function verifyClaim(id: string): BingoClaim | null {
  const claim = claims.get(id);
  if (!claim) return null;

  claim.status = 'verified';
  claim.verifiedAt = new Date().toISOString();
  claims.set(id, claim);
  return claim;
}

// Reject a claim
export function rejectClaim(id: string, reason: string): BingoClaim | null {
  const claim = claims.get(id);
  if (!claim) return null;

  claim.status = 'rejected';
  claim.rejectedAt = new Date().toISOString();
  claim.rejectionReason = reason;
  claims.set(id, claim);
  return claim;
}

// Clear all claims (for testing/reset)
export function clearAllClaims(): void {
  claims.clear();
}

// Get claims by wallet address
export function getClaimsByWallet(walletAddress: string): BingoClaim[] {
  return getAllClaims().filter(
    c => c.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
}

// Check if a card already has a pending/verified claim
export function hasExistingClaim(cardId: string): boolean {
  return getAllClaims().some(
    c => c.cardId === cardId && (c.status === 'pending' || c.status === 'verified')
  );
}
