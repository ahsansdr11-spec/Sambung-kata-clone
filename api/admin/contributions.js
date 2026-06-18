import { initDb, requireAuth, sql, logActivity } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session || !session.is_super) return res.status(403).json({ error: 'Superadmin only' });

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, type, word, requested_by, status, reviewed_by, reviewed_at, created_at
        FROM contribution_requests
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 200
      `;
      return res.status(200).json({ requests: rows });
    }

    if (req.method === 'POST') {
      const { id, action } = req.body || {};
      if (!id || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Data tidak valid' });
      }

      const { rows: [reqRow] } = await sql`SELECT * FROM contribution_requests WHERE id = ${id}`;
      if (!reqRow) return res.status(404).json({ error: 'Request tidak ditemukan' });
      if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Request sudah diproses sebelumnya' });

      if (action === 'approve') {
        if (reqRow.type === 'add') {
          await sql`INSERT INTO extra_words (word, verified, added_by)
                    VALUES (${reqRow.word}, FALSE, ${reqRow.requested_by})
                    ON CONFLICT (word) DO NOTHING`;
          await logActivity('add', reqRow.word, reqRow.requested_by);
        } else if (reqRow.type === 'reject') {
          await sql`INSERT INTO rejected (word, rejected_by) VALUES (${reqRow.word}, ${reqRow.requested_by})
                    ON CONFLICT (word) DO NOTHING`;
          await logActivity('reject', reqRow.word, reqRow.requested_by);
        }
        await sql`UPDATE contribution_requests
                  SET status = 'approved', reviewed_by = ${session.username}, reviewed_at = NOW()
                  WHERE id = ${id}`;
        return res.status(200).json({ ok: true, message: 'Request disetujui' });
      }

      // reject
      await sql`UPDATE contribution_requests
                SET status = 'rejected', reviewed_by = ${session.username}, reviewed_at = NOW()
                WHERE id = ${id}`;
      return res.status(200).json({ ok: true, message: 'Request ditolak' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
