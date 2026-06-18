import { initDb, requireAuth, sql } from '../../lib/db.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    // Base word list (same file the public app loads in the browser).
    let base = { words: [] };
    try {
      const wordsPath = path.join(process.cwd(), 'data', 'words.json');
      base = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
    } catch (e) {
      console.error('Could not read base words.json for export:', e.message);
    }

    const byWord = new Map();
    for (const e of base.words || []) byWord.set(e.w, { word: e.w, verified: e.v ? 1 : 0 });

    const [extra, rejected, verifs] = await Promise.all([
      sql`SELECT word, verified FROM extra_words`,
      sql`SELECT word FROM rejected`,
      sql`SELECT word, verified FROM verifications`
    ]);

    extra.rows.forEach(r => byWord.set(r.word, { word: r.word, verified: r.verified ? 1 : 0 }));
    verifs.rows.forEach(r => { const e = byWord.get(r.word); if (e) e.verified = r.verified ? 1 : 0; });
    rejected.rows.forEach(r => byWord.delete(r.word));

    const rows = Array.from(byWord.values()).sort((a, b) => a.word.localeCompare(b.word));

    let csv = 'word,verified\n';
    for (const r of rows) csv += `${r.word},${r.verified}\n`;

    const filename = `sambung-kata-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
