import { initDb, requireAuth, hashPw, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!session.is_super) return res.status(403).json({ error: 'Hanya superadmin yang boleh mengelola user' });

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT id, username, is_super, created_at FROM users ORDER BY created_at`;
      return res.status(200).json({ users: rows });
    }

    if (req.method === 'POST') {
      const { action, username, password, isSuper } = req.body || {};
      const u = (username || '').trim();

      if (action === 'create') {
        if (!u || !password) return res.status(400).json({ error: 'Username & password wajib' });
        if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
        await sql`INSERT INTO users (username, password_hash, is_super)
                  VALUES (${u}, ${hashPw(password)}, ${!!isSuper})`;
        return res.status(200).json({ ok: true, message: `User "${u}" dibuat` });
      }

      if (action === 'promote') {
        await sql`UPDATE users SET is_super = TRUE WHERE username = ${u}`;
        return res.status(200).json({ ok: true, message: `"${u}" jadi superadmin` });
      }

      if (action === 'demote') {
        if (u === session.username) return res.status(400).json({ error: 'Tidak bisa menurunkan diri sendiri' });
        await sql`UPDATE users SET is_super = FALSE WHERE username = ${u}`;
        return res.status(200).json({ ok: true, message: `"${u}" bukan superadmin lagi` });
      }

      if (action === 'delete') {
        if (u === session.username) return res.status(400).json({ error: 'Tidak bisa menghapus diri sendiri' });
        await sql`DELETE FROM users WHERE username = ${u}`;
        return res.status(200).json({ ok: true, message: `User "${u}" dihapus` });
      }

      if (action === 'reset_password') {
        if (!password || password.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        await sql`UPDATE users SET password_hash = ${hashPw(password)} WHERE username = ${u}`;
        return res.status(200).json({ ok: true, message: `Password "${u}" direset` });
      }

      return res.status(400).json({ error: 'Action tidak dikenal' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    if (String(e.message).includes('duplicate')) return res.status(400).json({ error: 'Username sudah ada' });
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
