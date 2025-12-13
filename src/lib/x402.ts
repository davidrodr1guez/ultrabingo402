// x402 Payment Protocol Integration with Ultravioleta DAO Facilitator
// https://www.x402.org/
// https://facilitator.ultravioletadao.xyz/

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// USDC contract addresses
export const USDC_ADDRESSES = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
} as const;

// Ultravioleta DAO x402 Facilitator
export const FACILITATOR_URL = 'https://facilitator.ultravioletadao.xyz';

export interface PaymentDetails {
  amount: string;
  currency: string;
  recipient: string;
  network: string;
  description: string;
  facilitator: string;
  asset: string;
}

export interface X402Response {
  status: 402;
  headers: {
    'X-Payment-Required': string;
    'X-Payment-Address': string;
    'X-Payment-Amount': string;
    'X-Payment-Network': string;
    'X-Payment-Asset': string;
    'X-Facilitator-URL': string;
  };
  body: PaymentDetails;
}

// Default configuration for the Bingo game payments
export const PAYMENT_CONFIG = {
  recipient: process.env.PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000',
  network: process.env.NEXT_PUBLIC_PAYMENT_NETWORK || 'base-sepolia',
  currency: 'USDC',
  asset: USDC_ADDRESSES.baseSepolia, // Default to testnet
  entryFee: '0.01', // Entry fee: $0.01 USDC (testing)
  prizePoolPercentage: 90, // 90% goes to prize pool
  facilitator: FACILITATOR_URL,
  decimals: 6, // USDC has 6 decimals
};

// Get the appropriate chain config
export function getChainConfig(network: string) {
  switch (network) {
    case 'base':
      return { chain: base, usdc: USDC_ADDRESSES.base };
    case 'base-sepolia':
      return { chain: baseSepolia, usdc: USDC_ADDRESSES.baseSepolia };
    default:
      return { chain: baseSepolia, usdc: USDC_ADDRESSES.baseSepolia };
  }
}

// Create x402 payment required response
export function createPaymentRequired(amount: string, description: string): X402Response {
  const paymentDetails: PaymentDetails = {
    amount,
    currency: PAYMENT_CONFIG.currency,
    recipient: PAYMENT_CONFIG.recipient,
    network: PAYMENT_CONFIG.network,
    description,
    facilitator: PAYMENT_CONFIG.facilitator,
    asset: PAYMENT_CONFIG.asset,
  };

  return {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Address': PAYMENT_CONFIG.recipient,
      'X-Payment-Amount': amount,
      'X-Payment-Network': PAYMENT_CONFIG.network,
      'X-Payment-Asset': PAYMENT_CONFIG.asset,
      'X-Facilitator-URL': PAYMENT_CONFIG.facilitator,
    },
    body: paymentDetails,
  };
}

// Verify payment via Ultravioleta facilitator
export async function verifyPaymentWithFacilitator(
  paymentHeader: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment: paymentHeader,
        recipient: PAYMENT_CONFIG.recipient,
        amount: parseUnits(PAYMENT_CONFIG.entryFee, 6).toString(),
        asset: PAYMENT_CONFIG.asset,
        network: PAYMENT_CONFIG.network,
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json();
    return { valid: false, error: error.message };
  } catch (error) {
    console.error('Facilitator verification error:', error);
    return { valid: false, error: 'Verification request failed' };
  }
}

// Settle payment via Ultravioleta facilitator (gasless)
export async function settlePaymentWithFacilitator(
  paymentHeader: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment: paymentHeader,
        recipient: PAYMENT_CONFIG.recipient,
        network: PAYMENT_CONFIG.network,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, txHash: result.txHash };
    }

    return { success: false, error: result.message };
  } catch (error) {
    console.error('Facilitator settlement error:', error);
    return { success: false, error: 'Settlement request failed' };
  }
}

// Verify payment on-chain (fallback)
export async function verifyPaymentOnChain(
  txHash: string,
  expectedAmount: string,
  expectedRecipient: string
): Promise<boolean> {
  try {
    const { chain } = getChainConfig(PAYMENT_CONFIG.network);
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt || receipt.status !== 'success') {
      return false;
    }

    // For USDC transfers, we need to check the Transfer event logs
    // This is a simplified check - in production, decode the logs properly
    return receipt.status === 'success';
  } catch (error) {
    console.error('On-chain payment verification error:', error);
    return false;
  }
}

// Calculate prize pool distribution
export function calculatePrize(totalPool: string, numWinners: number = 1): string {
  const poolAmount = parseUnits(totalPool, PAYMENT_CONFIG.decimals);
  const prizeAmount = poolAmount / BigInt(numWinners);
  return formatUnits(prizeAmount, PAYMENT_CONFIG.decimals);
}

// Generate payment request for game entry
export function generateEntryPaymentRequest(): X402Response {
  return createPaymentRequired(
    PAYMENT_CONFIG.entryFee,
    'UltraBingo game entry fee - $1 USDC'
  );
}

// Generate payment info for prize claim
export function generatePrizePayment(winnerAddress: string, amount: string) {
  return {
    recipient: winnerAddress,
    amount,
    currency: PAYMENT_CONFIG.currency,
    network: PAYMENT_CONFIG.network,
    asset: PAYMENT_CONFIG.asset,
    facilitator: PAYMENT_CONFIG.facilitator,
  };
}

// Format USDC amount for display
export function formatUSDC(amount: string): string {
  return `$${parseFloat(amount).toFixed(2)} USDC`;
}
