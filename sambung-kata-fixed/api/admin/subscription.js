import { initDb, requireAuth, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session || !session.is_super) return res.status(403).json({ error: 'Superadmin only' });

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, username, is_super, is_permanent, subscription_expires_at, created_at
        FROM users ORDER BY created_at DESC
      `;
      return res.status(200).json({ users: rows });
    }

    if (req.method === 'POST') {
      const { username, action, days } = req.body || {};
      const u = (username || '').trim();

      const { rows: [target] } = await sql`SELECT * FROM users WHERE username = ${u}`;
      if (!target) return res.status(404).json({ error: 'User tidak ditemukan' });

      if (action === 'set_permanent') {
        await sql`UPDATE users SET is_permanent = TRUE, subscription_expires_at = NULL WHERE username = ${u}`;
        return res.status(200).json({ success: true, message: `${u} sekarang PERMANEN` });
      }

      if (action === 'extend') {
        const addDays = parseInt(days) || 30;
        let newExpiry;

        if (target.is_permanent || !target.subscription_expires_at) {
          newExpiry = new Date(Date.now() + addDays * 86400000);
        } else {
          const current = new Date(target.subscription_expires_at);
          newExpiry = new Date(current.getTime() + addDays * 86400000);
        }

        await sql`
          UPDATE users 
          SET subscription_expires_at = ${newExpiry.toISOString()}, is_permanent = FALSE 
          WHERE username = ${u}
        `;
        return res.status(200).json({ success: true, message: `Langganan ${u} diperpanjang ${addDays} hari` });
      }

      if (action === 'remove_expiry') {
        await sql`UPDATE users SET subscription_expires_at = NULL, is_permanent = FALSE WHERE username = ${u}`;
        return res.status(200).json({ success: true, message: `Expiry direset untuk ${u}` });
      }

      return res.status(400).json({ error: 'Action tidak valid' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
