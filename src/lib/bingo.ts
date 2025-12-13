// Bingo game logic

export interface BingoCard {
  id: string;
  numbers: (number | null)[][];
  marked: boolean[][];
}

export interface BingoGame {
  id: string;
  calledNumbers: number[];
  currentNumber: number | null;
  isActive: boolean;
  prizePool: number;
  entryFee: number;
  winner: string | null;
}

// Generate a random bingo card
// B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
export function generateBingoCard(): BingoCard {
  const ranges = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 },  // O
  ];

  const numbers: (number | null)[][] = [];
  const marked: boolean[][] = [];

  for (let col = 0; col < 5; col++) {
    const columnNumbers: (number | null)[] = [];
    const columnMarked: boolean[] = [];
    const available = Array.from(
      { length: ranges[col].max - ranges[col].min + 1 },
      (_, i) => ranges[col].min + i
    );

    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        // Free space in the center
        columnNumbers.push(null);
        columnMarked.push(true);
      } else {
        const randomIndex = Math.floor(Math.random() * available.length);
        columnNumbers.push(available.splice(randomIndex, 1)[0]);
        columnMarked.push(false);
      }
    }
    numbers.push(columnNumbers);
    marked.push(columnMarked);
  }

  return {
    id: crypto.randomUUID(),
    numbers: transposeMatrix(numbers),
    marked: transposeMatrix(marked),
  };
}

function transposeMatrix<T>(matrix: T[][]): T[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

// Mark a number on the card
export function markNumber(card: BingoCard, number: number): BingoCard {
  const newMarked = card.marked.map(row => [...row]);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (card.numbers[row][col] === number) {
        newMarked[row][col] = true;
      }
    }
  }

  return { ...card, marked: newMarked };
}

// Check if the card has a winning pattern
export function checkWin(card: BingoCard): boolean {
  // Check rows
  for (let row = 0; row < 5; row++) {
    if (card.marked[row].every(m => m)) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (card.marked.every(row => row[col])) return true;
  }

  // Check diagonals
  const diagonal1 = [0, 1, 2, 3, 4].every(i => card.marked[i][i]);
  const diagonal2 = [0, 1, 2, 3, 4].every(i => card.marked[i][4 - i]);

  return diagonal1 || diagonal2;
}

// Generate a random called number (1-75)
export function callNumber(calledNumbers: number[]): number | null {
  const available = Array.from({ length: 75 }, (_, i) => i + 1)
    .filter(n => !calledNumbers.includes(n));

  if (available.length === 0) return null;

  return available[Math.floor(Math.random() * available.length)];
}

// Get the letter for a bingo number
export function getBingoLetter(number: number): string {
  if (number <= 15) return 'B';
  if (number <= 30) return 'I';
  if (number <= 45) return 'N';
  if (number <= 60) return 'G';
  return 'O';
}

// Create a new game
export function createGame(entryFee: number): BingoGame {
  return {
    id: crypto.randomUUID(),
    calledNumbers: [],
    currentNumber: null,
    isActive: true,
    prizePool: 0,
    entryFee,
    winner: null,
  };
}
