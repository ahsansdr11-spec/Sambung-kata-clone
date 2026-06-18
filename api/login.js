import { initDb, hashPw, createSession, sql } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initDb();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username & password wajib diisi' });

    const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = rows[0];
    if (!user || user.password_hash !== hashPw(password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const session = await createSession(user.username, user.is_super);
    return res.status(200).json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      username: user.username,
      isSuper: user.is_super
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
