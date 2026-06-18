import { initDb, requireAuth, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session || !session.is_super) return res.status(403).json({ error: 'Superadmin only' });

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, title, content, color, expires_at, created_by, created_at 
        FROM announcements 
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ announcements: rows });
    }

    if (req.method === 'POST') {
      const { title, content, color, value, unit, noExpiry } = req.body || {};
      if (!title || !content) return res.status(400).json({ error: 'Judul dan isi wajib diisi' });

      let expires_at = null;
      if (!noExpiry && value && unit) {
        const val = parseInt(value) || 7;
        const d = new Date();
        if (unit === 'day') d.setDate(d.getDate() + val);
        else if (unit === 'month') d.setMonth(d.getMonth() + val);
        else if (unit === 'year') d.setFullYear(d.getFullYear() + val);
        else if (unit === 'decade') d.setFullYear(d.getFullYear() + (val * 10));
        expires_at = d.toISOString();
      }

      await sql`
        INSERT INTO announcements (title, content, color, expires_at, created_by)
        VALUES (${title.trim()}, ${content.trim()}, ${color || 'emerald'}, ${expires_at}, ${session.username})
      `;
      return res.status(200).json({ success: true, message: 'Announcement berhasil dibuat' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID diperlukan' });
      await sql`DELETE FROM announcements WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
