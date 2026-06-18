// PUBLIC (logged-in) endpoint — basic users submit add/reject requests
// that a superadmin must approve before they take effect.
import { initDb, requireAuth, sql } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized — login dulu' });

    const { type, word } = req.body || {};
    const w = (word || '').trim().toLowerCase();
    if (!w) return res.status(400).json({ error: 'Kata kosong' });
    if (!/^[a-z]+$/.test(w)) return res.status(400).json({ error: 'Kata hanya boleh huruf a-z (sesuai aturan game)' });
    if (!['add', 'reject'].includes(type)) return res.status(400).json({ error: 'Type tidak dikenal' });

    await sql`INSERT INTO contribution_requests (type, word, requested_by)
              VALUES (${type}, ${w}, ${session.username})`;

    return res.status(200).json({ ok: true, message: `Request "${type}" untuk "${w}" terkirim, menunggu approval admin` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
