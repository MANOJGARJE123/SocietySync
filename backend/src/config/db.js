const { Pool } = require('pg');
const env = require('./env');
const { ensureSchema } = require('../db/schema');

let pool;

const connectDatabase = async () => {
  if (pool) return pool;

  pool = env.postgresUrl ? new Pool({ connectionString: env.postgresUrl }) : new Pool();

  // Validate connectivity early.
  await pool.query('SELECT 1 as ok');

  // Ensure schema exists (idempotent).
  await ensureSchema(pool);

  return pool;
};

const getConnectionTarget = () => {
  if (!env.postgresUrl) {
    return {
      source: 'PG* env vars',
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER
    };
  }

  try {
    const url = new URL(env.postgresUrl);
    return {
      source: 'DATABASE_URL',
      host: url.hostname,
      port: url.port || undefined,
      database: url.pathname?.replace(/^\//, '') || undefined,
      user: decodeURIComponent(url.username || '') || undefined
    };
  } catch {
    return { source: 'DATABASE_URL', note: 'unparseable connection string' };
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

const query = (text, params) => getPool().query(text, params);

const closeDatabase = async () => {
  if (!pool) return;
  const toClose = pool;
  pool = undefined;
  await toClose.end();
};

module.exports = {
  connectDatabase,
  getPool,
  query,
  closeDatabase,
  getConnectionTarget
};
