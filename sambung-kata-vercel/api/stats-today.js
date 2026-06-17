// PUBLIC — counts of admin actions performed today (reset midnight WITA / UTC+8)
import { initDb, getTodayCounts } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const counts = await getTodayCounts();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json(counts);
  } catch (e) {
    // Don't break the page if DB unavailable
    return res.status(200).json({ verified: 0, rejected: 0, added: 0 });
  }
}
