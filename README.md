# UltraBingo

A Bingo game with x402 micropayment integration for entry fees and prize distribution.

## Features

- Classic 5x5 Bingo gameplay
- x402 protocol for micropayments
- Real-time number calling
- Win detection (rows, columns, diagonals)
- Prize pool accumulation and distribution

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- x402 Payment Protocol
- Viem (Ethereum interactions)
- Base Network (low-fee transactions)

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

## x402 Integration

This game uses the x402 payment protocol for:

1. **Entry Fees**: Players pay a small fee (0.001 ETH) to join a game
2. **Prize Distribution**: Winners receive the accumulated prize pool

### Payment Flow

1. Player clicks "Pay & Play"
2. Server returns HTTP 402 with payment details
3. Player's wallet sends payment to the game address
4. Server verifies payment on-chain
5. Player receives game access token

## API Endpoints

- `POST /api/pay-entry` - Submit payment for game entry
- `GET /api/pay-entry` - Get payment requirements
- `POST /api/claim-prize` - Claim winnings
- `GET /api/claim-prize` - Get current prize pool

## License

MIT
