import Database from 'better-sqlite3';
import path from 'path';

// Initialize database
const dbPath = path.join(process.cwd(), 'ultrabingo.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    numbers TEXT NOT NULL,
    owner TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    game_title TEXT NOT NULL,
    purchased_at TEXT NOT NULL,
    tx_hash TEXT,
    payment_status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    called_numbers TEXT DEFAULT '[]',
    current_number INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    card_ids TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT DEFAULT 'USDC',
    network TEXT DEFAULT 'base-sepolia',
    tx_hash TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    confirmed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner);
  CREATE INDEX IF NOT EXISTS idx_payments_wallet ON payments(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
`);

export interface DbCard {
  id: string;
  numbers: string; // JSON stringified
  owner: string;
  game_mode: string;
  game_title: string;
  purchased_at: string;
  tx_hash: string | null;
  payment_status: string;
}

export interface DbGame {
  id: string;
  name: string;
  mode: string;
  called_numbers: string; // JSON stringified array
  current_number: number | null;
  status: string;
  created_at: string;
  ended_at: string | null;
}

export interface DbPayment {
  id: string;
  card_ids: string; // JSON stringified array
  wallet_address: string;
  amount: string;
  currency: string;
  network: string;
  tx_hash: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
}

// Card operations
export const cardOps = {
  create: db.prepare(`
    INSERT INTO cards (id, numbers, owner, game_mode, game_title, purchased_at, tx_hash, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM cards WHERE id = ?`),

  getByIdPrefix: db.prepare(`SELECT * FROM cards WHERE id LIKE ?`),

  getByOwner: db.prepare(`SELECT * FROM cards WHERE owner = ? ORDER BY purchased_at DESC`),

  getAll: db.prepare(`SELECT * FROM cards ORDER BY purchased_at DESC`),

  updatePaymentStatus: db.prepare(`UPDATE cards SET payment_status = ?, tx_hash = ? WHERE id = ?`),

  delete: db.prepare(`DELETE FROM cards WHERE id = ?`),

  deleteAll: db.prepare(`DELETE FROM cards`),
};

// Game operations
export const gameOps = {
  create: db.prepare(`
    INSERT INTO games (id, name, mode, called_numbers, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM games WHERE id = ?`),

  getActive: db.prepare(`SELECT * FROM games WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`),

  getAll: db.prepare(`SELECT * FROM games ORDER BY created_at DESC`),

  updateCalledNumbers: db.prepare(`UPDATE games SET called_numbers = ?, current_number = ? WHERE id = ?`),

  updateStatus: db.prepare(`UPDATE games SET status = ?, ended_at = ? WHERE id = ?`),

  delete: db.prepare(`DELETE FROM games WHERE id = ?`),
};

// Payment operations
export const paymentOps = {
  create: db.prepare(`
    INSERT INTO payments (id, card_ids, wallet_address, amount, currency, network, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM payments WHERE id = ?`),

  getByWallet: db.prepare(`SELECT * FROM payments WHERE wallet_address = ? ORDER BY created_at DESC`),

  updateStatus: db.prepare(`UPDATE payments SET status = ?, tx_hash = ?, confirmed_at = ? WHERE id = ?`),
};

// Helper functions
export function insertCard(card: {
  id: string;
  numbers: number[][];
  owner: string;
  gameMode: string;
  gameTitle: string;
  txHash?: string;
  paymentStatus?: string;
}) {
  return cardOps.create.run(
    card.id,
    JSON.stringify(card.numbers),
    card.owner,
    card.gameMode,
    card.gameTitle,
    new Date().toISOString(),
    card.txHash || null,
    card.paymentStatus || 'pending'
  );
}

export function getCardById(id: string): DbCard | undefined {
  // Try exact match first
  let card = cardOps.getById.get(id) as DbCard | undefined;
  if (!card) {
    // Try prefix match
    card = cardOps.getByIdPrefix.get(`${id}%`) as DbCard | undefined;
  }
  return card;
}

export function getCardsByOwner(owner: string): DbCard[] {
  return cardOps.getByOwner.all(owner) as DbCard[];
}

export function getAllCards(): DbCard[] {
  return cardOps.getAll.all() as DbCard[];
}

export function updateCardPayment(id: string, status: string, txHash: string) {
  return cardOps.updatePaymentStatus.run(status, txHash, id);
}

export function createGame(name: string, mode: string): string {
  const id = crypto.randomUUID();
  gameOps.create.run(id, name, mode, '[]', 'active', new Date().toISOString());
  return id;
}

export function getActiveGame(): DbGame | undefined {
  return gameOps.getActive.get() as DbGame | undefined;
}

export function updateGameNumbers(id: string, calledNumbers: number[], currentNumber: number | null) {
  return gameOps.updateCalledNumbers.run(JSON.stringify(calledNumbers), currentNumber, id);
}

export function endGame(id: string) {
  return gameOps.updateStatus.run('ended', new Date().toISOString(), id);
}

export function createPayment(payment: {
  cardIds: string[];
  walletAddress: string;
  amount: string;
  currency?: string;
  network?: string;
}): string {
  const id = crypto.randomUUID();
  paymentOps.create.run(
    id,
    JSON.stringify(payment.cardIds),
    payment.walletAddress,
    payment.amount,
    payment.currency || 'USDC',
    payment.network || 'base-sepolia',
    'pending',
    new Date().toISOString()
  );
  return id;
}

export function confirmPayment(id: string, txHash: string) {
  return paymentOps.updateStatus.run('confirmed', txHash, new Date().toISOString(), id);
}

export default db;
