import { initDb, requireAuth, sql } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    await initDb();
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const me = session.username;

    const [addedQ, rejectedQ, verifiedQ, pendingQ, approvedQ, declinedQ, todayQ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM activity_log WHERE by_user = ${me} AND action = 'add'`,
      sql`SELECT COUNT(*)::int AS n FROM activity_log WHERE by_user = ${me} AND action = 'reject'`,
      sql`SELECT COUNT(*)::int AS n FROM activity_log WHERE by_user = ${me} AND action = 'verify'`,
      sql`SELECT COUNT(*)::int AS n FROM contribution_requests WHERE requested_by = ${me} AND status = 'pending'`,
      sql`SELECT COUNT(*)::int AS n FROM contribution_requests WHERE requested_by = ${me} AND status = 'approved'`,
      sql`SELECT COUNT(*)::int AS n FROM contribution_requests WHERE requested_by = ${me} AND status = 'rejected'`,
      sql`SELECT action, COUNT(*)::int AS n FROM activity_log
          WHERE by_user = ${me} AND created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY action`
    ]);

    const today = { added: 0, verified: 0, rejected: 0 };
    todayQ.rows.forEach(r => {
      if (r.action === 'add') today.added = r.n;
      else if (r.action === 'verify') today.verified = r.n;
      else if (r.action === 'reject') today.rejected = r.n;
    });

    return res.status(200).json({
      username: me,
      today,
      totals: {
        added: addedQ.rows[0].n,
        rejected: rejectedQ.rows[0].n,
        verified: verifiedQ.rows[0].n
      },
      contributions: {
        pending: pendingQ.rows[0].n,
        approved: approvedQ.rows[0].n,
        rejected: declinedQ.rows[0].n
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
