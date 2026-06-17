import { initDb, requireAuth, sql, logActivity } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized — login dulu' });

    const by = session.username;

    if (req.method === 'GET') {
      // List admin-managed words
      const [extra, rejected, verifs] = await Promise.all([
        sql`SELECT word, verified, added_by, created_at FROM extra_words ORDER BY created_at DESC LIMIT 500`,
        sql`SELECT word, rejected_by, created_at FROM rejected ORDER BY created_at DESC LIMIT 500`,
        sql`SELECT word, verified, set_by FROM verifications ORDER BY created_at DESC LIMIT 500`
      ]);
      return res.status(200).json({
        added: extra.rows,
        rejected: rejected.rows,
        verifications: verifs.rows
      });
    }

    if (req.method === 'POST') {
      const { action, word, verified } = req.body || {};
      const w = (word || '').trim().toLowerCase();
      if (!w) return res.status(400).json({ error: 'Kata kosong' });
      if (!/^[a-z]+$/.test(w)) return res.status(400).json({ error: 'Kata hanya boleh huruf a-z (sesuai aturan game)' });

      switch (action) {
        case 'add':
          await sql`INSERT INTO extra_words (word, verified, added_by)
                    VALUES (${w}, ${!!verified}, ${by})
                    ON CONFLICT (word) DO UPDATE SET verified = ${!!verified}`;
          await logActivity('add', w, by);
          return res.status(200).json({ ok: true, message: `Kata "${w}" ditambahkan` });

        case 'reject':
          await sql`INSERT INTO rejected (word, rejected_by) VALUES (${w}, ${by})
                    ON CONFLICT (word) DO NOTHING`;
          await logActivity('reject', w, by);
          return res.status(200).json({ ok: true, message: `Kata "${w}" di-reject` });

        case 'unreject':
          await sql`DELETE FROM rejected WHERE word = ${w}`;
          return res.status(200).json({ ok: true, message: `Reject "${w}" dibatalkan` });

        case 'verify':
          await sql`INSERT INTO verifications (word, verified, set_by)
                    VALUES (${w}, ${!!verified}, ${by})
                    ON CONFLICT (word) DO UPDATE SET verified = ${!!verified}`;
          await logActivity('verify', w, by);
          return res.status(200).json({ ok: true, message: `Status "${w}" → ${verified ? 'verified' : 'unverified'}` });

        case 'delete_added':
          await sql`DELETE FROM extra_words WHERE word = ${w}`;
          return res.status(200).json({ ok: true, message: `Kata tambahan "${w}" dihapus` });

        default:
          return res.status(400).json({ error: 'Action tidak dikenal' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
