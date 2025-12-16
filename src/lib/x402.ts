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

// x402 Payment Payload interface (EVM)
export interface X402PaymentPayload {
  x402Version: number;
  scheme: 'exact';
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

// x402 Payment Requirements interface
export interface X402PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
}

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

// Get USDC address based on network
function getUSDCAddress(network: string): string {
  switch (network) {
    case 'base':
      return USDC_ADDRESSES.base;
    case 'base-sepolia':
      return USDC_ADDRESSES.baseSepolia;
    default:
      return USDC_ADDRESSES.baseSepolia;
  }
}

const network = process.env.NEXT_PUBLIC_PAYMENT_NETWORK || 'base-sepolia';

// Default configuration for the Bingo game payments
export const PAYMENT_CONFIG = {
  recipient: process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000',
  network,
  currency: 'USDC',
  asset: getUSDCAddress(network),
  entryFee: '1.00', // Entry fee: $1.00 USDC
  prizePoolPercentage: 90,
  facilitator: FACILITATOR_URL,
  decimals: 6,
};

// Get the appropriate chain config
export function getChainConfig(network: string) {
  switch (network) {
    case 'base':
      return { chain: base, usdc: USDC_ADDRESSES.base, networkId: '8453' };
    case 'base-sepolia':
      return { chain: baseSepolia, usdc: USDC_ADDRESSES.baseSepolia, networkId: '84532' };
    default:
      return { chain: baseSepolia, usdc: USDC_ADDRESSES.baseSepolia, networkId: '84532' };
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

// Build payment requirements for facilitator
export function buildPaymentRequirements(): X402PaymentRequirements {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ultrabingo402.vercel.app';
  return {
    scheme: 'exact',
    network: PAYMENT_CONFIG.network,
    maxAmountRequired: parseUnits(PAYMENT_CONFIG.entryFee, 6).toString(),
    resource: `${baseUrl}/api/pay-entry`,
    description: 'UltraBingo game entry fee',
    mimeType: 'application/json',
    payTo: PAYMENT_CONFIG.recipient,
    maxTimeoutSeconds: 60,
    asset: PAYMENT_CONFIG.asset,
  };
}

// Verify payment via Ultravioleta facilitator
export async function verifyPaymentWithFacilitator(
  paymentPayload: X402PaymentPayload
): Promise<{ isValid: boolean; payer?: string; invalidReason?: string }> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': btoa(JSON.stringify(paymentPayload)),
      },
      body: JSON.stringify({
        requirements: buildPaymentRequirements(),
      }),
    });

    const result = await response.json();
    console.log('Verify response:', result);

    if (response.ok && result.isValid) {
      return { isValid: true, payer: result.payer };
    }

    return { isValid: false, invalidReason: result.invalidReason || 'Verification failed' };
  } catch (error) {
    console.error('Facilitator verification error:', error);
    return { isValid: false, invalidReason: 'Verification request failed' };
  }
}

// Settle payment via Ultravioleta facilitator (gasless)
export async function settlePaymentWithFacilitator(
  paymentPayload: X402PaymentPayload
): Promise<{ success: boolean; transaction?: string; network?: string; error?: string }> {
  try {
    const requestBody = {
      x402Version: 1,
      paymentPayload,
      paymentRequirements: buildPaymentRequirements(),
    };

    console.log('Settle request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': btoa(JSON.stringify(paymentPayload)),
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log('Settle response:', result);

    if (response.ok && result.success) {
      return {
        success: true,
        transaction: result.transaction,
        network: result.network,
      };
    }

    return { success: false, error: result.errorReason || result.error || 'Settlement failed' };
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
    `UltraBingo game entry fee - $${PAYMENT_CONFIG.entryFee} USDC`
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
