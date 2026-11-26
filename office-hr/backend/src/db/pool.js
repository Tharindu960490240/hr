import pg from 'pg';
import { config } from '../config.js';

// return DATE columns as 'YYYY-MM-DD' strings, not JS Dates shifted by timezone
pg.types.setTypeParser(1082, (v) => v);
// numeric -> number
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

// On Vercel each function instance keeps a tiny pool; the database's own pooler (e.g. Neon "-pooler" URL) does the rest.
// migrations & seeding need a direct (unpooled) connection; Neon on Vercel provides DATABASE_URL_UNPOOLED
const isScript = /db[\\/](migrate|seed|create-admin)\.js$/.test(process.argv[1] || '');
const connectionString = (isScript && process.env.DATABASE_URL_UNPOOLED) || config.databaseUrl;

export const pool = new pg.Pool({
  connectionString,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: process.env.VERCEL ? 5000 : 10000,
});

export const query = (text, params) => pool.query(text, params);

export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

export async function many(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

/** Run fn(client) inside a transaction. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
