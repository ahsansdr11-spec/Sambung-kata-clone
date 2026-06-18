import { initDb, requireAuth, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await sql`
      SELECT id, action, word, by_user, created_at
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return res.status(200).json({ logs: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
