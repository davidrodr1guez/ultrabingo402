// Bingo game logic - Enhanced version

export interface BingoCard {
  id: string;
  numbers: (number | string | null)[][];
  marked: boolean[][];
  title?: string;
}

export interface BingoGame {
  id: string;
  calledNumbers: number[];
  currentNumber: number | null;
  isActive: boolean;
  prizePool: number;
  entryFee: number;
  winner: string | null;
  mode: GameMode;
  autoCallInterval: number | null;
}

export type GameMode = '1-75' | '1-90';
export type WinPattern = 'line' | 'full-house' | 'four-corners' | 'x-pattern' | 'blackout';

// Patterns for different win conditions
export const WIN_PATTERNS: Record<WinPattern, string> = {
  'line': 'Any complete row, column, or diagonal',
  'full-house': 'All numbers on the card',
  'four-corners': 'All four corner squares',
  'x-pattern': 'Both diagonals forming an X',
  'blackout': 'Every square on the card',
};

// Generate a random bingo card (1-75 American style)
// B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
export function generateBingoCard(mode: GameMode = '1-75', title?: string): BingoCard {
  if (mode === '1-90') {
    return generate90BallCard(title);
  }
  return generate75BallCard(title);
}

function generate75BallCard(title?: string): BingoCard {
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
    title,
  };
}

function generate90BallCard(title?: string): BingoCard {
  // 90-ball bingo: 3 rows x 9 columns, 5 numbers per row
  const numbers: (number | null)[][] = [];
  const marked: boolean[][] = [];

  // Generate numbers for each column (1-9, 10-19, ..., 80-90)
  const columns: number[][] = [];
  for (let col = 0; col < 9; col++) {
    const min = col === 0 ? 1 : col * 10;
    const max = col === 8 ? 90 : (col + 1) * 10 - 1;
    const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    // Shuffle and take 3
    const shuffled = available.sort(() => Math.random() - 0.5);
    columns.push(shuffled.slice(0, 3).sort((a, b) => a - b));
  }

  // Create 3 rows with 5 numbers each
  for (let row = 0; row < 3; row++) {
    const rowNumbers: (number | null)[] = [];
    const rowMarked: boolean[] = [];

    // Select 5 random columns to have numbers in this row
    const colIndices = Array.from({ length: 9 }, (_, i) => i);
    const selectedCols = colIndices.sort(() => Math.random() - 0.5).slice(0, 5).sort((a, b) => a - b);

    for (let col = 0; col < 9; col++) {
      if (selectedCols.includes(col) && columns[col][row] !== undefined) {
        rowNumbers.push(columns[col][row]);
        rowMarked.push(false);
      } else {
        rowNumbers.push(null);
        rowMarked.push(false);
      }
    }
    numbers.push(rowNumbers);
    marked.push(rowMarked);
  }

  return {
    id: crypto.randomUUID(),
    numbers,
    marked,
    title,
  };
}

function transposeMatrix<T>(matrix: T[][]): T[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

// Mark a number on the card
export function markNumber(card: BingoCard, number: number): BingoCard {
  const newMarked = card.marked.map(row => [...row]);

  for (let row = 0; row < card.numbers.length; row++) {
    for (let col = 0; col < card.numbers[row].length; col++) {
      if (card.numbers[row][col] === number) {
        newMarked[row][col] = true;
      }
    }
  }

  return { ...card, marked: newMarked };
}

// Auto-mark all called numbers on a card
export function autoMarkCard(card: BingoCard, calledNumbers: number[]): BingoCard {
  const newMarked = card.marked.map(row => [...row]);

  for (let row = 0; row < card.numbers.length; row++) {
    for (let col = 0; col < card.numbers[row].length; col++) {
      const num = card.numbers[row][col];
      if (num !== null && calledNumbers.includes(num as number)) {
        newMarked[row][col] = true;
      }
    }
  }

  return { ...card, marked: newMarked };
}

// Check for different win patterns
export function checkWin(card: BingoCard, pattern: WinPattern = 'line'): boolean {
  switch (pattern) {
    case 'line':
      return checkLineWin(card);
    case 'full-house':
    case 'blackout':
      return checkFullHouse(card);
    case 'four-corners':
      return checkFourCorners(card);
    case 'x-pattern':
      return checkXPattern(card);
    default:
      return checkLineWin(card);
  }
}

function checkLineWin(card: BingoCard): boolean {
  const rows = card.marked.length;
  const cols = card.marked[0].length;

  // Check rows
  for (let row = 0; row < rows; row++) {
    if (card.marked[row].every(m => m)) return true;
  }

  // Check columns
  for (let col = 0; col < cols; col++) {
    if (card.marked.every(row => row[col])) return true;
  }

  // Check diagonals (only for 5x5 cards)
  if (rows === 5 && cols === 5) {
    const diagonal1 = [0, 1, 2, 3, 4].every(i => card.marked[i][i]);
    const diagonal2 = [0, 1, 2, 3, 4].every(i => card.marked[i][4 - i]);
    if (diagonal1 || diagonal2) return true;
  }

  return false;
}

function checkFullHouse(card: BingoCard): boolean {
  return card.marked.every(row =>
    row.every((marked, col) => marked || card.numbers[card.marked.indexOf(row)][col] === null)
  );
}

function checkFourCorners(card: BingoCard): boolean {
  const rows = card.marked.length;
  const cols = card.marked[0].length;
  return (
    card.marked[0][0] &&
    card.marked[0][cols - 1] &&
    card.marked[rows - 1][0] &&
    card.marked[rows - 1][cols - 1]
  );
}

function checkXPattern(card: BingoCard): boolean {
  if (card.marked.length !== 5 || card.marked[0].length !== 5) return false;

  const diagonal1 = [0, 1, 2, 3, 4].every(i => card.marked[i][i]);
  const diagonal2 = [0, 1, 2, 3, 4].every(i => card.marked[i][4 - i]);
  return diagonal1 && diagonal2;
}

// Generate a random called number
export function callNumber(calledNumbers: number[], mode: GameMode = '1-75'): number | null {
  const maxNumber = mode === '1-75' ? 75 : 90;
  const available = Array.from({ length: maxNumber }, (_, i) => i + 1)
    .filter(n => !calledNumbers.includes(n));

  if (available.length === 0) return null;

  return available[Math.floor(Math.random() * available.length)];
}

// Get the letter for a bingo number (1-75 mode)
export function getBingoLetter(number: number): string {
  if (number <= 15) return 'B';
  if (number <= 30) return 'I';
  if (number <= 45) return 'N';
  if (number <= 60) return 'G';
  return 'O';
}

// Text-to-speech for number calling
export function speakNumber(number: number, mode: GameMode = '1-75'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const letter = mode === '1-75' ? getBingoLetter(number) : '';
  const text = mode === '1-75' ? `${letter} ${number}` : `${number}`;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

// Create a new game
export function createGame(entryFee: number, mode: GameMode = '1-75'): BingoGame {
  return {
    id: crypto.randomUUID(),
    calledNumbers: [],
    currentNumber: null,
    isActive: true,
    prizePool: 0,
    entryFee,
    winner: null,
    mode,
    autoCallInterval: null,
  };
}

// Generate multiple cards at once
export function generateMultipleCards(count: number, mode: GameMode = '1-75'): BingoCard[] {
  return Array.from({ length: count }, (_, i) =>
    generateBingoCard(mode, `Card ${i + 1}`)
  );
}

// Validate if a claimed bingo is legitimate
export function validateBingo(card: BingoCard, calledNumbers: number[], pattern: WinPattern = 'line'): boolean {
  // First, verify all marked numbers were actually called
  for (let row = 0; row < card.numbers.length; row++) {
    for (let col = 0; col < card.numbers[row].length; col++) {
      const num = card.numbers[row][col];
      if (card.marked[row][col] && num !== null) {
        if (!calledNumbers.includes(num as number)) {
          return false; // Marked a number that wasn't called
        }
      }
    }
  }

  // Then check if the win pattern is achieved
  return checkWin(card, pattern);
}
