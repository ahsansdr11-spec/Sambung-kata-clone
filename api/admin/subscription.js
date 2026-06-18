import { initDb, requireAuth, sql } from '../../lib/db.js';

// Same value+unit logic used by announcements (day / month / year / decade)
// so "extend subscription" and "set announcement expiry" behave identically.
function addUnit(date, value, unit) {
  const d = new Date(date);
  const val = parseInt(value) || 0;
  if (unit === 'day') d.setDate(d.getDate() + val);
  else if (unit === 'month') d.setMonth(d.getMonth() + val);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + val);
  else if (unit === 'decade') d.setFullYear(d.getFullYear() + (val * 10));
  else d.setDate(d.getDate() + val); // fallback: treat as days
  return d;
}

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
      const { username, action, value, unit, days } = req.body || {};
      const u = (username || '').trim();

      const { rows: [target] } = await sql`SELECT * FROM users WHERE username = ${u}`;
      if (!target) return res.status(404).json({ error: 'User tidak ditemukan' });

      if (action === 'set_permanent') {
        await sql`UPDATE users SET is_permanent = TRUE, subscription_expires_at = NULL WHERE username = ${u}`;
        return res.status(200).json({ success: true, message: `${u} sekarang PERMANEN` });
      }

      if (action === 'unset_permanent') {
        // Cancel permanent access. Subscription falls back to whatever
        // expiry it had before (or "expired now" if it never had one),
        // so the admin can immediately see/extend a real expiry date.
        const base = target.subscription_expires_at ? new Date(target.subscription_expires_at) : new Date();
        await sql`UPDATE users
                  SET is_permanent = FALSE, subscription_expires_at = ${base.toISOString()}
                  WHERE username = ${u}`;
        return res.status(200).json({ success: true, message: `Permanen untuk ${u} dibatalkan` });
      }

      if (action === 'extend') {
        // Accept either {value, unit} (day/month/year/decade) — same shape
        // as announcements — or the legacy {days} shortcut.
        const extVal = value != null ? value : (days != null ? days : 30);
        const extUnit = unit || 'day';

        const base = (target.is_permanent || !target.subscription_expires_at)
          ? new Date()
          : new Date(target.subscription_expires_at);
        const newExpiry = addUnit(base, extVal, extUnit);

        await sql`
          UPDATE users
          SET subscription_expires_at = ${newExpiry.toISOString()}, is_permanent = FALSE
          WHERE username = ${u}
        `;
        return res.status(200).json({ success: true, message: `Langganan ${u} diperpanjang ${extVal} ${extUnit}` });
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

