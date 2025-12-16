import { createClient } from '@libsql/client';

// Initialize Turso database client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:ultrabingo.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize tables
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      numbers TEXT NOT NULL,
      owner TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      game_title TEXT NOT NULL,
      purchased_at TEXT NOT NULL,
      tx_hash TEXT,
      payment_status TEXT DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      called_numbers TEXT DEFAULT '[]',
      current_number INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      ended_at TEXT
    )
  `);

  await db.execute(`
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
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_payments_wallet ON payments(wallet_address)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);
}

// Initialize on first import
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

export interface DbCard {
  id: string;
  numbers: string;
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
  called_numbers: string;
  current_number: number | null;
  status: string;
  created_at: string;
  ended_at: string | null;
}

export interface DbPayment {
  id: string;
  card_ids: string;
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
export async function insertCard(card: {
  id: string;
  numbers: number[][];
  owner: string;
  gameMode: string;
  gameTitle: string;
  txHash?: string;
  paymentStatus?: string;
}) {
  await ensureInit();
  await db.execute({
    sql: `INSERT INTO cards (id, numbers, owner, game_mode, game_title, purchased_at, tx_hash, payment_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      card.id,
      JSON.stringify(card.numbers),
      card.owner,
      card.gameMode,
      card.gameTitle,
      new Date().toISOString(),
      card.txHash || null,
      card.paymentStatus || 'pending'
    ]
  });
}

export async function getCardById(id: string): Promise<DbCard | undefined> {
  await ensureInit();
  // Try exact match first
  let result = await db.execute({
    sql: `SELECT * FROM cards WHERE id = ?`,
    args: [id]
  });

  if (result.rows.length === 0) {
    // Try prefix match
    result = await db.execute({
      sql: `SELECT * FROM cards WHERE id LIKE ?`,
      args: [`${id}%`]
    });
  }

  return result.rows[0] as unknown as DbCard | undefined;
}

export async function getCardsByOwner(owner: string): Promise<DbCard[]> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM cards WHERE owner = ? ORDER BY purchased_at DESC`,
    args: [owner]
  });
  return result.rows as unknown as DbCard[];
}

export async function getAllCards(): Promise<DbCard[]> {
  await ensureInit();
  const result = await db.execute(`SELECT * FROM cards ORDER BY purchased_at DESC`);
  return result.rows as unknown as DbCard[];
}

export async function updateCardPayment(id: string, status: string, txHash: string) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE cards SET payment_status = ?, tx_hash = ? WHERE id = ?`,
    args: [status, txHash, id]
  });
}

export async function deleteCard(id: string) {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM cards WHERE id = ?`,
    args: [id]
  });
}

export async function deleteAllCards() {
  await ensureInit();
  await db.execute(`DELETE FROM cards`);
}

// Game operations
export async function createGame(name: string, mode: string): Promise<string> {
  await ensureInit();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO games (id, name, mode, called_numbers, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, name, mode, '[]', 'active', new Date().toISOString()]
  });
  return id;
}

export async function getGameById(id: string): Promise<DbGame | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM games WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] as unknown as DbGame | undefined;
}

export async function getActiveGame(): Promise<DbGame | undefined> {
  await ensureInit();
  const result = await db.execute(
    `SELECT * FROM games WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
  );
  return result.rows[0] as unknown as DbGame | undefined;
}

export async function getAllGames(): Promise<DbGame[]> {
  await ensureInit();
  const result = await db.execute(`SELECT * FROM games ORDER BY created_at DESC`);
  return result.rows as unknown as DbGame[];
}

export async function updateGameNumbers(id: string, calledNumbers: number[], currentNumber: number | null) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE games SET called_numbers = ?, current_number = ? WHERE id = ?`,
    args: [JSON.stringify(calledNumbers), currentNumber, id]
  });
}

export async function endGame(id: string) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE games SET status = ?, ended_at = ? WHERE id = ?`,
    args: ['ended', new Date().toISOString(), id]
  });
}

export async function deleteGame(id: string) {
  await ensureInit();
  await db.execute({
    sql: `DELETE FROM games WHERE id = ?`,
    args: [id]
  });
}

// Payment operations
export async function createPayment(payment: {
  cardIds: string[];
  walletAddress: string;
  amount: string;
  currency?: string;
  network?: string;
}): Promise<string> {
  await ensureInit();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO payments (id, card_ids, wallet_address, amount, currency, network, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      JSON.stringify(payment.cardIds),
      payment.walletAddress,
      payment.amount,
      payment.currency || 'USDC',
      payment.network || 'base-sepolia',
      'pending',
      new Date().toISOString()
    ]
  });
  return id;
}

export async function confirmPayment(id: string, txHash: string) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE payments SET status = ?, tx_hash = ?, confirmed_at = ? WHERE id = ?`,
    args: ['confirmed', txHash, new Date().toISOString(), id]
  });
}

export default db;
