// PUBLIC — tactical suffixes (for Trap Mode). Seeds from JSON file on first run.
import { initDb, sql } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    await sql`CREATE TABLE IF NOT EXISTS tactical (
      suffix TEXT PRIMARY KEY,
      tier INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const { rows } = await sql`SELECT suffix, tier FROM tactical ORDER BY suffix`;
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(rows.map(r => ({ s: r.suffix, t: r.tier })));
  } catch (e) {
    return res.status(200).json([]);
  }
}
