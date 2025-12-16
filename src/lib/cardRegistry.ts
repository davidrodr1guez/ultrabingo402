// Registry for sold bingo cards
// This uses localStorage for demo - Felipe can connect to a real database

import { BingoCard, GameMode, checkWin, WinPattern } from './bingo';

export interface RegisteredCard {
  card: BingoCard;
  owner: string; // wallet address or name
  purchasedAt: string;
  gameMode: GameMode;
  gameTitle: string;
}

const REGISTRY_KEY = 'ultrabingo_cards';

// Get all registered cards
export function getRegisteredCards(): RegisteredCard[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(REGISTRY_KEY);
  return data ? JSON.parse(data) : [];
}

// Register new cards
export function registerCards(
  cards: BingoCard[],
  owner: string,
  gameMode: GameMode,
  gameTitle: string
): void {
  const existing = getRegisteredCards();
  const newEntries: RegisteredCard[] = cards.map(card => ({
    card,
    owner,
    purchasedAt: new Date().toISOString(),
    gameMode,
    gameTitle,
  }));
  localStorage.setItem(REGISTRY_KEY, JSON.stringify([...existing, ...newEntries]));
}

// Find card by ID
export function findCardById(cardId: string): RegisteredCard | null {
  const cards = getRegisteredCards();
  return cards.find(entry => entry.card.id === cardId || entry.card.id.startsWith(cardId)) || null;
}

// Verify if a card has bingo
export function verifyBingo(
  cardId: string,
  calledNumbers: number[],
  pattern: WinPattern = 'line'
): {
  found: boolean;
  card?: RegisteredCard;
  hasBingo: boolean;
  markedNumbers: number[];
  missingForBingo: number[];
} {
  const entry = findCardById(cardId);

  if (!entry) {
    return { found: false, hasBingo: false, markedNumbers: [], missingForBingo: [] };
  }

  // Find which numbers on the card have been called
  const markedNumbers: number[] = [];
  const cardNumbers: number[] = [];

  for (const row of entry.card.numbers) {
    for (const num of row) {
      if (num !== null) {
        cardNumbers.push(num as number);
        if (calledNumbers.includes(num as number)) {
          markedNumbers.push(num as number);
        }
      }
    }
  }

  // Create a marked version of the card
  const markedCard: BingoCard = {
    ...entry.card,
    marked: entry.card.numbers.map(row =>
      row.map(num => num === null || calledNumbers.includes(num as number))
    ),
  };

  const hasBingo = checkWin(markedCard, pattern);

  // Calculate missing numbers for bingo (simple line check)
  const missingForBingo = cardNumbers.filter(n => !calledNumbers.includes(n));

  return {
    found: true,
    card: entry,
    hasBingo,
    markedNumbers,
    missingForBingo,
  };
}

// Clear all registered cards
export function clearRegistry(): void {
  localStorage.removeItem(REGISTRY_KEY);
}

// Get cards by owner
export function getCardsByOwner(owner: string): RegisteredCard[] {
  return getRegisteredCards().filter(
    entry => entry.owner.toLowerCase() === owner.toLowerCase()
  );
}

// Delete a specific card
export function deleteCard(cardId: string): boolean {
  const cards = getRegisteredCards();
  const filtered = cards.filter(entry => entry.card.id !== cardId);
  if (filtered.length < cards.length) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}
