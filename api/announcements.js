import { initDb, sql } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const now = new Date().toISOString();

    const { rows } = await sql`
      SELECT id, title, content, color, expires_at, created_at 
      FROM announcements 
      WHERE (expires_at IS NULL OR expires_at > ${now})
      ORDER BY created_at DESC
      LIMIT 6
    `;

    return res.status(200).json({ announcements: rows });
  } catch (e) {
    return res.status(200).json({ announcements: [] });
  }
}
