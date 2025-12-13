# UltraBingo

A Bingo game with x402 micropayment integration using USDC and Ultravioleta DAO facilitator.

## Features

- Classic 5x5 Bingo gameplay
- **USDC payments** via x402 protocol
- **Gasless transactions** via Ultravioleta DAO facilitator
- Real-time number calling
- Win detection (rows, columns, diagonals)
- Prize pool accumulation and distribution

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- x402 Payment Protocol
- Ultravioleta DAO Facilitator
- Viem (Ethereum interactions)
- Base Network (USDC)

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your wallet address in .env.local
# PAYMENT_RECIPIENT=0xYourAddress

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## x402 + Ultravioleta Integration

This game uses the x402 payment protocol with Ultravioleta DAO's facilitator:

- **Currency**: USDC (stablecoin)
- **Entry Fee**: $1 USDC
- **Network**: Base (mainnet) or Base Sepolia (testnet)
- **Facilitator**: https://facilitator.ultravioletadao.xyz

### Benefits

1. **Gasless Payments**: Players only need USDC, no ETH for gas
2. **EIP-3009**: Meta-transactions for seamless UX
3. **Multi-chain**: Supports Base, Avalanche, Polygon, and more

### Payment Flow

1. Player clicks "Pay & Play"
2. Server returns HTTP 402 with payment details
3. Player signs EIP-712 authorization (no gas needed)
4. Ultravioleta facilitator verifies and settles on-chain
5. Player receives game access

## API Endpoints

- `POST /api/pay-entry` - Submit x402 payment for game entry
- `GET /api/pay-entry` - Get payment requirements (USDC amount, facilitator)
- `POST /api/claim-prize` - Claim winnings
- `GET /api/claim-prize` - Get current prize pool

## USDC Contract Addresses

| Network | Address |
|---------|---------|
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Resources

- [x402 Protocol](https://www.x402.org/)
- [Ultravioleta DAO Facilitator](https://facilitator.ultravioletadao.xyz/)
- [EIP-3009 Specification](https://eips.ethereum.org/EIPS/eip-3009)

## License

MIT
