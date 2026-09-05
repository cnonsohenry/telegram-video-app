import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

const isLocal = !connectionString || connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected error on idle Postgres client:', err.message);
});

export default pool;
