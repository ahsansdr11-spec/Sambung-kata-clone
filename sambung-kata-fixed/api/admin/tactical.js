import { initDb, requireAuth, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    await sql`CREATE TABLE IF NOT EXISTS tactical (
      suffix TEXT PRIMARY KEY, tier INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT suffix, tier FROM tactical ORDER BY suffix`;
      return res.status(200).json({ tactical: rows });
    }
    if (req.method === 'POST') {
      const { action, suffix, tier } = req.body || {};
      const s = (suffix || '').trim().toLowerCase();
      if (!s || !/^[a-z]+$/.test(s)) return res.status(400).json({ error: 'Suffix harus huruf a-z' });
      if (action === 'add') {
        await sql`INSERT INTO tactical (suffix, tier) VALUES (${s}, ${tier || 1})
                  ON CONFLICT (suffix) DO UPDATE SET tier = ${tier || 1}`;
        return res.status(200).json({ ok: true, message: `Tactical suffix "${s.toUpperCase()}" disimpan` });
      }
      if (action === 'delete') {
        await sql`DELETE FROM tactical WHERE suffix = ${s}`;
        return res.status(200).json({ ok: true, message: `Suffix "${s.toUpperCase()}" dihapus` });
      }
      return res.status(400).json({ error: 'Action tidak dikenal' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
