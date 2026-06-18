import { initDb, requireAuth, hashPw, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { current, newPassword, confirm } = req.body || {};
    if (!current || !newPassword || !confirm) return res.status(400).json({ error: 'Semua field wajib diisi' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    if (newPassword !== confirm) return res.status(400).json({ error: 'Konfirmasi password tidak cocok' });

    const { rows } = await sql`SELECT * FROM users WHERE username = ${session.username}`;
    const user = rows[0];
    if (!user || user.password_hash !== hashPw(current)) return res.status(401).json({ error: 'Password lama salah' });

    await sql`UPDATE users SET password_hash = ${hashPw(newPassword)} WHERE username = ${session.username}`;
    return res.status(200).json({ ok: true, message: 'Password berhasil diganti' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
