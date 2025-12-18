// x402 Payment Protocol Integration
// Uses Ultravioleta DAO Facilitator: https://facilitator.ultravioletadao.xyz/

import { parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// Ultravioleta DAO Facilitator
export const FACILITATOR_URL = 'https://facilitator.ultravioletadao.xyz';

// USDC contract addresses
export const USDC_ADDRESSES = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

// USDC EIP-712 domain names (different per network)
export const USDC_DOMAIN_NAMES = {
  base: 'USD Coin',
  'base-sepolia': 'USDC',
} as const;

// Network type
export type NetworkType = 'base' | 'base-sepolia';

// Get current network from env
function getNetwork(): NetworkType {
  const network = process.env.NEXT_PUBLIC_PAYMENT_NETWORK || 'base-sepolia';
  return network as NetworkType;
}

// Payment configuration
export const PAYMENT_CONFIG = {
  recipient: process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '0x97a3935fBF2d4ac9437dc10e62722D1549C8C43A',
  network: getNetwork(),
  currency: 'USDC',
  asset: USDC_ADDRESSES[getNetwork()],
  entryFee: '0.01', // $0.01 USDC for testing
  decimals: 6,
};

// Get chain config
export function getChainConfig(network: NetworkType) {
  switch (network) {
    case 'base':
      return { chain: base, usdc: USDC_ADDRESSES.base, chainId: 8453, usdcName: USDC_DOMAIN_NAMES.base };
    case 'base-sepolia':
      return { chain: baseSepolia, usdc: USDC_ADDRESSES['base-sepolia'], chainId: 84532, usdcName: USDC_DOMAIN_NAMES['base-sepolia'] };
    default:
      return { chain: baseSepolia, usdc: USDC_ADDRESSES['base-sepolia'], chainId: 84532, usdcName: USDC_DOMAIN_NAMES['base-sepolia'] };
  }
}

// x402 PaymentPayload for EVM exact scheme
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

// x402 PaymentRequirements (must match x402 spec for facilitator)
export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: {
    name?: string;
    version?: string;
  };
}

// Build payment requirements for the facilitator
export function buildPaymentRequirements(amount?: string): PaymentRequirements {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ultrabingo402.vercel.app';
  const totalAmount = amount || PAYMENT_CONFIG.entryFee;
  const network = PAYMENT_CONFIG.network;
  const chainConfig = getChainConfig(network);

  return {
    scheme: 'exact',
    network: network,
    maxAmountRequired: parseUnits(totalAmount, 6).toString(),
    resource: `${baseUrl}/api/pay-entry`,
    description: `UltraBingo - $${totalAmount} USDC`,
    mimeType: 'application/json',
    payTo: PAYMENT_CONFIG.recipient,
    maxTimeoutSeconds: 300,
    asset: PAYMENT_CONFIG.asset,
    extra: {
      name: chainConfig.usdcName,
      version: '2',
    },
  };
}

// Helper to convert BigInt to string for JSON serialization
function toJsonSafe(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return typeof data === 'bigint' ? data.toString() : data;
  }
  if (Array.isArray(data)) {
    return data.map(toJsonSafe);
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, val]) => [key, toJsonSafe(val)])
  );
}

// Verify payment via Ultravioleta DAO facilitator
export async function verifyPayment(
  paymentPayload: X402PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }> {
  try {
    console.log('Verifying payment with Ultravioleta facilitator...');
    console.log('Payload:', JSON.stringify(paymentPayload, null, 2));
    console.log('Requirements:', JSON.stringify(paymentRequirements, null, 2));

    // x402 facilitator expects this format (from x402/verify useFacilitator):
    // { x402Version, paymentPayload, paymentRequirements }
    const verifyRequest = {
      x402Version: paymentPayload.x402Version,
      paymentPayload: toJsonSafe(paymentPayload),
      paymentRequirements: toJsonSafe(paymentRequirements),
    };

    console.log('Verify request:', JSON.stringify(verifyRequest, null, 2));

    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyRequest),
    });

    const result = await response.json();
    console.log('Verify response:', result);

    if (response.ok && result.isValid) {
      return { isValid: true, payer: result.payer };
    }

    return {
      isValid: false,
      invalidReason: result.invalidReason || result.error || 'Verification failed',
      payer: result.payer,
    };
  } catch (error) {
    console.error('Verify error:', error);
    return { isValid: false, invalidReason: 'Verification request failed' };
  }
}

// Settle payment via Ultravioleta DAO facilitator (gasless on-chain execution)
export async function settlePayment(
  paymentPayload: X402PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<{ success: boolean; transaction?: string; error?: string; payer?: string; network?: string }> {
  try {
    console.log('Settling payment with Ultravioleta facilitator...');

    // x402 facilitator expects this format (from x402/verify useFacilitator):
    // { x402Version, paymentPayload, paymentRequirements }
    const settleRequest = {
      x402Version: paymentPayload.x402Version,
      paymentPayload: toJsonSafe(paymentPayload),
      paymentRequirements: toJsonSafe(paymentRequirements),
    };

    console.log('Settle request:', JSON.stringify(settleRequest, null, 2));

    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settleRequest),
    });

    const result = await response.json();
    console.log('Settle response:', result);

    if (response.ok && result.success) {
      return {
        success: true,
        transaction: result.transaction || result.txHash,
        payer: result.payer,
        network: result.network,
      };
    }

    return {
      success: false,
      error: result.errorReason || result.error || 'Settlement failed',
      payer: result.payer,
    };
  } catch (error) {
    console.error('Settle error:', error);
    return { success: false, error: 'Settlement request failed' };
  }
}

// Decode x402 payment header (base64 JSON)
export function decodePaymentHeader(header: string): X402PaymentPayload | null {
  try {
    return JSON.parse(atob(header));
  } catch (e) {
    console.error('Failed to decode payment header:', e);
    return null;
  }
}

// Encode x402 payment header
export function encodePaymentHeader(payload: X402PaymentPayload): string {
  return btoa(JSON.stringify(payload));
}

// Format USDC for display
export function formatUSDC(amount: string): string {
  return `$${parseFloat(amount).toFixed(2)} USDC`;
}

// Calculate total price
export function calculateTotalPrice(cardCount: number): string {
  const pricePerCard = parseFloat(PAYMENT_CONFIG.entryFee);
  return (pricePerCard * cardCount).toFixed(2);
}
