// ============================================================
// Database helper — Vercel Postgres
// ============================================================
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NO_SSL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 3
});

export async function sql(strings, ...values) {
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += '$' + (i + 1);
  }
  return pool.query(text, values);
}

let initialized = false;

export async function initDb() {
  if (initialized) return;

  // Users
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_super BOOLEAN DEFAULT FALSE,
    subscription_expires_at TIMESTAMPTZ,
    is_permanent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Core tables
  await sql`CREATE TABLE IF NOT EXISTS extra_words (
    id SERIAL PRIMARY KEY,
    word TEXT UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    added_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS rejected (
    word TEXT PRIMARY KEY,
    rejected_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS verifications (
    word TEXT PRIMARY KEY,
    verified BOOLEAN NOT NULL,
    set_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    is_super BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    word TEXT,
    by_user TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS contribution_requests (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    word TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // NEW: Announcements
  await sql`CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT 'emerald',
    expires_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Bootstrap
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM users`;
  if (rows[0].n === 0) {
    const u = process.env.ADMIN_USERNAME || 'admin';
    const p = process.env.ADMIN_PASSWORD || 'changeme123';
    await sql`INSERT INTO users (username, password_hash, is_super, is_permanent)
              VALUES (${u}, ${hashPw(p)}, TRUE, TRUE)
              ON CONFLICT (username) DO NOTHING`;
  }

  initialized = true;
}

export function hashPw(pw) {
  const salt = process.env.PW_SALT || 'sambung-kata-salt-2026';
  return crypto.createHash('sha256').update(salt + pw).digest('hex');
}

export function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

export async function createSession(username, isSuper) {
  const token = newToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await sql`INSERT INTO sessions (token, username, is_super, expires_at)
            VALUES (${token}, ${username}, ${isSuper}, ${expires.toISOString()})`;
  return { token, expiresAt: expires.toISOString() };
}

export async function getSession(token) {
  if (!token) return null;
  const { rows } = await sql`SELECT * FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
  return rows[0] || null;
}

export async function requireAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return await getSession(token);
}

export async function logActivity(action, word, byUser) {
  try {
    await sql`INSERT INTO activity_log (action, word, by_user) VALUES (${action}, ${word}, ${byUser})`;
  } catch (e) {}
}

export async function getTodayCounts() {
  const now = new Date();
  const witaMs = now.getTime() + 8 * 3600 * 1000;
  const wita = new Date(witaMs);
  const startWitaUtc = Date.UTC(wita.getUTCFullYear(), wita.getUTCMonth(), wita.getUTCDate()) - 8 * 3600 * 1000;
  const startIso = new Date(startWitaUtc).toISOString();

  const { rows } = await sql`
    SELECT action, COUNT(*)::int AS n
    FROM activity_log
    WHERE created_at >= ${startIso}
    GROUP BY action
  `;
  const out = { verified: 0, rejected: 0, added: 0 };
  for (const r of rows) {
    if (r.action === 'verify') out.verified += r.n;
    else if (r.action === 'reject') out.rejected += r.n;
    else if (r.action === 'add') out.added += r.n;
  }
  return out;
}
