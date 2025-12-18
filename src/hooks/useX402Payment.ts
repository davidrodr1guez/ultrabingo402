'use client';

import { useAccount, useSignTypedData, usePublicClient } from 'wagmi';
import { useState, useCallback } from 'react';
import { parseUnits } from 'viem';
import { baseSepolia, base } from 'viem/chains';

// USDC contract addresses
const USDC_ADDRESSES = {
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const;

// USDC ABI for balance check
const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// EIP-3009 TransferWithAuthorization types for EIP-712 signing
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

// Get USDC EIP-712 domain based on chain
// Note: Base Sepolia USDC uses "USDC" as domain name, mainnet uses "USD Coin"
const getUSDCDomain = (chainId: number) => {
  const isTestnet = chainId === baseSepolia.id;
  return {
    name: isTestnet ? 'USDC' : 'USD Coin',
    version: '2',
    chainId,
    verifyingContract: USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES] as `0x${string}`,
  };
};

interface PaymentResult {
  success: boolean;
  signature?: string;
  payload?: string;
  txHash?: string;
  error?: string;
}

export function useX402Payment() {
  const { address, isConnected, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Check USDC balance
  const checkBalance = useCallback(async (amount: string): Promise<boolean> => {
    if (!address || !publicClient || !chain) return false;

    const usdcAddress = USDC_ADDRESSES[chain.id as keyof typeof USDC_ADDRESSES];
    if (!usdcAddress) return false;

    try {
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address],
      });

      const requiredAmount = parseUnits(amount, 6);
      return balance >= requiredAmount;
    } catch (error) {
      console.error('Balance check error:', error);
      return false;
    }
  }, [address, publicClient, chain]);

  // Generate random nonce for EIP-3009
  const generateNonce = (): `0x${string}` => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  };

  // Create and sign x402 payment using EIP-712
  const createPayment = useCallback(async (
    recipient: string,
    amount: string,
  ): Promise<PaymentResult> => {
    if (!address || !isConnected || !chain) {
      return { success: false, error: 'Wallet not connected' };
    }

    const usdcAddress = USDC_ADDRESSES[chain.id as keyof typeof USDC_ADDRESSES];
    if (!usdcAddress) {
      return { success: false, error: 'USDC not supported on this network' };
    }

    setIsProcessing(true);

    try {
      // Check balance first
      const hasBalance = await checkBalance(amount);
      if (!hasBalance) {
        return { success: false, error: 'Insufficient USDC balance' };
      }

      const value = parseUnits(amount, 6);
      const nonce = generateNonce();
      const validAfter = BigInt(0);
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

      // Get domain for EIP-712
      const domain = getUSDCDomain(chain.id);

      console.log('Signing EIP-712 TransferWithAuthorization...');
      console.log('Domain:', domain);
      console.log('Message:', {
        from: address,
        to: recipient,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      });

      // Sign EIP-712 typed data for TransferWithAuthorization
      const signature = await signTypedDataAsync({
        domain,
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: recipient as `0x${string}`,
          value,
          validAfter,
          validBefore,
          nonce,
        },
      });

      console.log('Signature:', signature);

      // Create x402 v1 payment payload
      const networkName = chain.id === base.id ? 'base' : 'base-sepolia';

      const payload = {
        x402Version: 1,
        scheme: 'exact' as const,
        network: networkName,
        payload: {
          signature,
          authorization: {
            from: address,
            to: recipient,
            value: value.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      };

      // Base64 encode the payload for X-PAYMENT header
      const encodedPayload = btoa(JSON.stringify(payload));

      console.log('Payment payload created:', payload);

      return {
        success: true,
        signature,
        payload: encodedPayload,
      };
    } catch (error: any) {
      console.error('Payment creation error:', error);
      return {
        success: false,
        error: error.shortMessage || error.message || 'Payment failed',
      };
    } finally {
      setIsProcessing(false);
    }
  }, [address, isConnected, chain, signTypedDataAsync, checkBalance]);

  // Submit payment to server with X-PAYMENT header
  const submitPayment = useCallback(async (
    endpoint: string,
    paymentPayload: string,
    body: any = {},
  ): Promise<PaymentResult> => {
    try {
      console.log('Submitting payment to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': paymentPayload,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (response.ok && data.success) {
        return {
          success: true,
          txHash: data.transaction,
        };
      }

      return {
        success: false,
        error: data.error || data.details || 'Payment submission failed',
      };
    } catch (error: any) {
      console.error('Submit error:', error);
      return {
        success: false,
        error: error.message || 'Network error',
      };
    }
  }, []);

  // Full payment flow: create + submit
  const pay = useCallback(async (
    recipient: string,
    amount: string,
    endpoint: string = '/api/pay-entry',
    body: any = {},
  ): Promise<PaymentResult> => {
    // Step 1: Create and sign payment
    const paymentResult = await createPayment(recipient, amount);
    if (!paymentResult.success || !paymentResult.payload) {
      return paymentResult;
    }

    // Step 2: Submit to server
    const submitResult = await submitPayment(endpoint, paymentResult.payload, body);
    return submitResult;
  }, [createPayment, submitPayment]);

  return {
    pay,
    createPayment,
    submitPayment,
    checkBalance,
    isProcessing,
    isConnected,
    address,
    chain,
  };
}
