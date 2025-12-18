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
      ended_at TEXT,
      entry_fee TEXT DEFAULT '0.01',
      prize_pool TEXT DEFAULT '0',
      total_entries INTEGER DEFAULT 0,
      winner_address TEXT,
      winner_card_id TEXT,
      prize_paid TEXT DEFAULT '0',
      prize_tx_hash TEXT
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
      confirmed_at TEXT,
      game_id TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      game_id TEXT,
      wallet_address TEXT NOT NULL,
      marked_numbers TEXT NOT NULL,
      card_numbers TEXT NOT NULL,
      pattern TEXT NOT NULL,
      called_numbers_at_claim TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      verified_at TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      prize_amount TEXT,
      prize_tx_hash TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS winners (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      card_id TEXT NOT NULL,
      pattern TEXT NOT NULL,
      prize_amount TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stats (
      id TEXT PRIMARY KEY DEFAULT 'global',
      total_games INTEGER DEFAULT 0,
      total_cards_sold INTEGER DEFAULT 0,
      total_revenue TEXT DEFAULT '0',
      total_prizes_paid TEXT DEFAULT '0',
      total_winners INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `);

  // Initialize global stats if not exists
  await db.execute(`
    INSERT OR IGNORE INTO stats (id, total_games, total_cards_sold, total_revenue, total_prizes_paid, total_winners, updated_at)
    VALUES ('global', 0, 0, '0', '0', 0, datetime('now'))
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_payments_wallet ON payments(wallet_address)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_payments_game ON payments(game_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_claims_game ON claims(game_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_claims_wallet ON claims(wallet_address)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_winners_game ON winners(game_id)`);
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
  entry_fee: string;
  prize_pool: string;
  total_entries: number;
  winner_address: string | null;
  winner_card_id: string | null;
  prize_paid: string;
  prize_tx_hash: string | null;
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
  game_id: string | null;
}

export interface DbClaim {
  id: string;
  card_id: string;
  game_id: string | null;
  wallet_address: string;
  marked_numbers: string;
  card_numbers: string;
  pattern: string;
  called_numbers_at_claim: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  prize_amount: string | null;
  prize_tx_hash: string | null;
}

export interface DbWinner {
  id: string;
  game_id: string;
  claim_id: string;
  wallet_address: string;
  card_id: string;
  pattern: string;
  prize_amount: string;
  tx_hash: string | null;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
  paid_at: string | null;
}

export interface DbStats {
  id: string;
  total_games: number;
  total_cards_sold: number;
  total_revenue: string;
  total_prizes_paid: string;
  total_winners: number;
  updated_at: string;
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
export async function createGame(name: string, mode: string, entryFee: string = '0.01'): Promise<string> {
  await ensureInit();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO games (id, name, mode, called_numbers, status, created_at, entry_fee, prize_pool, total_entries)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, name, mode, '[]', 'active', new Date().toISOString(), entryFee, '0', 0]
  });

  // Update global stats
  await db.execute(`UPDATE stats SET total_games = total_games + 1, updated_at = datetime('now') WHERE id = 'global'`);

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

// Update game prize pool when payment is confirmed
export async function addToPrizePool(gameId: string, amount: string, numCards: number) {
  await ensureInit();
  const game = await getGameById(gameId);
  if (!game) return;

  const currentPool = parseFloat(game.prize_pool || '0');
  const newPool = currentPool + parseFloat(amount);
  const newEntries = (game.total_entries || 0) + numCards;

  await db.execute({
    sql: `UPDATE games SET prize_pool = ?, total_entries = ? WHERE id = ?`,
    args: [newPool.toFixed(6), newEntries, gameId]
  });

  // Update global stats
  await db.execute({
    sql: `UPDATE stats SET total_cards_sold = total_cards_sold + ?, total_revenue = CAST((CAST(total_revenue AS REAL) + ?) AS TEXT), updated_at = datetime('now') WHERE id = 'global'`,
    args: [numCards, parseFloat(amount)]
  });
}

// Set game winner
export async function setGameWinner(gameId: string, winnerAddress: string, cardId: string, prizeAmount: string, txHash?: string) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE games SET winner_address = ?, winner_card_id = ?, prize_paid = ?, prize_tx_hash = ?, status = ?, ended_at = ? WHERE id = ?`,
    args: [winnerAddress, cardId, prizeAmount, txHash || null, 'ended', new Date().toISOString(), gameId]
  });
}

// Claim operations
export async function createClaim(claim: {
  cardId: string;
  gameId: string | null;
  walletAddress: string;
  markedNumbers: number[];
  cardNumbers: (number | null)[][];
  pattern: string;
  calledNumbersAtClaim: number[];
}): Promise<string> {
  await ensureInit();
  const id = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.execute({
    sql: `INSERT INTO claims (id, card_id, game_id, wallet_address, marked_numbers, card_numbers, pattern, called_numbers_at_claim, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      claim.cardId,
      claim.gameId,
      claim.walletAddress,
      JSON.stringify(claim.markedNumbers),
      JSON.stringify(claim.cardNumbers),
      claim.pattern,
      JSON.stringify(claim.calledNumbersAtClaim),
      'pending',
      new Date().toISOString()
    ]
  });
  return id;
}

export async function getClaimById(id: string): Promise<DbClaim | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM claims WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] as unknown as DbClaim | undefined;
}

export async function getClaimsByGame(gameId: string): Promise<DbClaim[]> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM claims WHERE game_id = ? ORDER BY created_at DESC`,
    args: [gameId]
  });
  return result.rows as unknown as DbClaim[];
}

export async function getClaimsByWallet(walletAddress: string): Promise<DbClaim[]> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM claims WHERE wallet_address = ? ORDER BY created_at DESC`,
    args: [walletAddress.toLowerCase()]
  });
  return result.rows as unknown as DbClaim[];
}

export async function getPendingClaims(): Promise<DbClaim[]> {
  await ensureInit();
  const result = await db.execute(
    `SELECT * FROM claims WHERE status = 'pending' ORDER BY created_at ASC`
  );
  return result.rows as unknown as DbClaim[];
}

export async function getAllClaims(): Promise<DbClaim[]> {
  await ensureInit();
  const result = await db.execute(
    `SELECT * FROM claims ORDER BY created_at DESC`
  );
  return result.rows as unknown as DbClaim[];
}

export async function hasExistingClaim(cardId: string): Promise<boolean> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM claims WHERE card_id = ? AND status IN ('pending', 'verified')`,
    args: [cardId]
  });
  const count = (result.rows[0] as unknown as { count: number }).count;
  return count > 0;
}

export async function verifyClaim(id: string, prizeAmount?: string, txHash?: string): Promise<DbClaim | null> {
  await ensureInit();
  await db.execute({
    sql: `UPDATE claims SET status = ?, verified_at = ?, prize_amount = ?, prize_tx_hash = ? WHERE id = ?`,
    args: ['verified', new Date().toISOString(), prizeAmount || null, txHash || null, id]
  });

  // Update global stats
  await db.execute(`UPDATE stats SET total_winners = total_winners + 1, updated_at = datetime('now') WHERE id = 'global'`);

  return getClaimById(id) as Promise<DbClaim | null>;
}

export async function rejectClaim(id: string, reason: string): Promise<DbClaim | null> {
  await ensureInit();
  await db.execute({
    sql: `UPDATE claims SET status = ?, rejected_at = ?, rejection_reason = ? WHERE id = ?`,
    args: ['rejected', new Date().toISOString(), reason, id]
  });
  return getClaimById(id) as Promise<DbClaim | null>;
}

// Winner operations
export async function createWinner(winner: {
  gameId: string;
  claimId: string;
  walletAddress: string;
  cardId: string;
  pattern: string;
  prizeAmount: string;
}): Promise<string> {
  await ensureInit();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO winners (id, game_id, claim_id, wallet_address, card_id, pattern, prize_amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      winner.gameId,
      winner.claimId,
      winner.walletAddress,
      winner.cardId,
      winner.pattern,
      winner.prizeAmount,
      'pending',
      new Date().toISOString()
    ]
  });
  return id;
}

export async function markWinnerPaid(id: string, txHash: string) {
  await ensureInit();
  await db.execute({
    sql: `UPDATE winners SET status = ?, tx_hash = ?, paid_at = ? WHERE id = ?`,
    args: ['paid', txHash, new Date().toISOString(), id]
  });

  // Update global stats with prize amount
  const winner = await getWinnerById(id);
  if (winner) {
    await db.execute({
      sql: `UPDATE stats SET total_prizes_paid = CAST((CAST(total_prizes_paid AS REAL) + ?) AS TEXT), updated_at = datetime('now') WHERE id = 'global'`,
      args: [parseFloat(winner.prize_amount)]
    });
  }
}

export async function getWinnerById(id: string): Promise<DbWinner | undefined> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM winners WHERE id = ?`,
    args: [id]
  });
  return result.rows[0] as unknown as DbWinner | undefined;
}

export async function getWinnersByGame(gameId: string): Promise<DbWinner[]> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT * FROM winners WHERE game_id = ? ORDER BY created_at DESC`,
    args: [gameId]
  });
  return result.rows as unknown as DbWinner[];
}

export async function getAllWinners(): Promise<DbWinner[]> {
  await ensureInit();
  const result = await db.execute(
    `SELECT * FROM winners ORDER BY created_at DESC`
  );
  return result.rows as unknown as DbWinner[];
}

// Stats operations
export async function getGlobalStats(): Promise<DbStats | undefined> {
  await ensureInit();
  const result = await db.execute(
    `SELECT * FROM stats WHERE id = 'global'`
  );
  return result.rows[0] as unknown as DbStats | undefined;
}

export async function getGameStats(gameId: string): Promise<{
  game: DbGame | undefined;
  totalClaims: number;
  verifiedClaims: number;
  prizePool: string;
}> {
  await ensureInit();
  const game = await getGameById(gameId);

  const claimsResult = await db.execute({
    sql: `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
          FROM claims WHERE game_id = ?`,
    args: [gameId]
  });

  const stats = claimsResult.rows[0] as unknown as { total: number; verified: number };

  return {
    game,
    totalClaims: stats.total || 0,
    verifiedClaims: stats.verified || 0,
    prizePool: game?.prize_pool || '0'
  };
}

// Get recent games with stats
export async function getRecentGamesWithStats(limit: number = 10): Promise<Array<DbGame & { winner_count: number }>> {
  await ensureInit();
  const result = await db.execute({
    sql: `SELECT g.*,
            (SELECT COUNT(*) FROM winners w WHERE w.game_id = g.id) as winner_count
          FROM games g
          ORDER BY g.created_at DESC
          LIMIT ?`,
    args: [limit]
  });
  return result.rows as unknown as Array<DbGame & { winner_count: number }>;
}

export default db;
