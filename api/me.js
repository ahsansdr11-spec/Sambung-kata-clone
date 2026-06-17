import { initDb, requireAuth } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    return res.status(200).json({ username: session.username, isSuper: session.is_super });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
