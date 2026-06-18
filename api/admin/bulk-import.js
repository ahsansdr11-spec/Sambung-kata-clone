import { initDb, requireAuth, sql, logActivity } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { words, verified } = req.body || {};
    if (!words || typeof words !== 'string') return res.status(400).json({ error: 'Daftar kata wajib diisi' });

    // Accept words separated by newline, comma, or semicolon.
    const raw = words.split(/[\n,;]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
    const unique = Array.from(new Set(raw));
    if (!unique.length) return res.status(400).json({ error: 'Tidak ada kata valid' });
    if (unique.length > 5000) return res.status(400).json({ error: 'Maksimal 5000 kata per import' });

    let added = 0;
    const bad = [];

    for (const w of unique) {
      if (!/^[a-z]+$/.test(w)) { bad.push(w); continue; }
      try {
        await sql`INSERT INTO extra_words (word, verified, added_by)
                  VALUES (${w}, ${!!verified}, ${session.username})
                  ON CONFLICT (word) DO UPDATE SET verified = ${!!verified}`;
        await logActivity('add', w, session.username);
        added++;
      } catch (e) {
        bad.push(w);
      }
    }

    return res.status(200).json({
      ok: true,
      added,
      skipped: bad.length,
      bad: bad.slice(0, 30),
      message: `${added} kata berhasil ditambahkan, ${bad.length} dilewati`
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
