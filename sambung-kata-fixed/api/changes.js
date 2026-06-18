// PUBLIC endpoint — diambil oleh web utama untuk menerapkan perubahan admin.
// Mengembalikan: kata tambahan, kata yang di-reject, dan override verifikasi.
import { initDb, sql } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const [extra, rejected, verifs] = await Promise.all([
      sql`SELECT word, verified FROM extra_words`,
      sql`SELECT word FROM rejected`,
      sql`SELECT word, verified FROM verifications`
    ]);
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({
      added: extra.rows.map(r => ({ w: r.word, v: r.verified ? 1 : 0 })),
      rejected: rejected.rows.map(r => r.word),
      verifications: verifs.rows.map(r => ({ w: r.word, v: r.verified ? 1 : 0 }))
    });
  } catch (e) {
    console.error(e);
    // Kalau DB belum siap, jangan bikin web utama error — balikin kosong
    return res.status(200).json({ added: [], rejected: [], verifications: [] });
  }
}
