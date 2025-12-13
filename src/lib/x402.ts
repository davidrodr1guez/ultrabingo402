// x402 Payment Protocol Integration
// https://www.x402.org/

import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';

export interface PaymentDetails {
  amount: string;
  currency: string;
  recipient: string;
  network: string;
  description: string;
}

export interface X402Response {
  status: 402;
  headers: {
    'X-Payment-Required': string;
    'X-Payment-Address': string;
    'X-Payment-Amount': string;
    'X-Payment-Network': string;
  };
  body: PaymentDetails;
}

// Default configuration for the Bingo game payments
export const PAYMENT_CONFIG = {
  recipient: process.env.PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000',
  network: 'base', // Using Base network for low fees
  currency: 'ETH',
  entryFee: '0.001', // Entry fee in ETH
  prizePoolPercentage: 90, // 90% goes to prize pool
};

// Create x402 payment required response
export function createPaymentRequired(amount: string, description: string): X402Response {
  const paymentDetails: PaymentDetails = {
    amount,
    currency: PAYMENT_CONFIG.currency,
    recipient: PAYMENT_CONFIG.recipient,
    network: PAYMENT_CONFIG.network,
    description,
  };

  return {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Address': PAYMENT_CONFIG.recipient,
      'X-Payment-Amount': amount,
      'X-Payment-Network': PAYMENT_CONFIG.network,
    },
    body: paymentDetails,
  };
}

// Verify payment on-chain
export async function verifyPayment(
  txHash: string,
  expectedAmount: string,
  expectedRecipient: string
): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt || receipt.status !== 'success') {
      return false;
    }

    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });

    // Verify recipient and amount
    const recipientMatch = tx.to?.toLowerCase() === expectedRecipient.toLowerCase();
    const amountMatch = tx.value >= parseEther(expectedAmount);

    return recipientMatch && amountMatch;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

// Calculate prize pool distribution
export function calculatePrize(totalPool: string, numWinners: number = 1): string {
  const poolWei = parseEther(totalPool);
  const prizeWei = poolWei / BigInt(numWinners);
  return formatEther(prizeWei);
}

// Generate payment request for game entry
export function generateEntryPaymentRequest(): X402Response {
  return createPaymentRequired(
    PAYMENT_CONFIG.entryFee,
    'UltraBingo game entry fee'
  );
}

// Generate payment for prize claim
export function generatePrizePayment(winnerAddress: string, amount: string) {
  return {
    recipient: winnerAddress,
    amount,
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
  };
}
