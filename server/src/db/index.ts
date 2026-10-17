import pg from 'pg';
import Redis from 'ioredis';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reputation_cache (
      domain TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      score INT NOT NULL,
      reasons JSONB,
      sources JSONB,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      ttl INT NOT NULL
    );
  `);
  console.log('[DB] PostgreSQL connected and schema ready');
}

redis.on('connect', () => console.log('[DB] Redis connected'));
redis.on('error', (err) => console.error('[DB] Redis error:', err));
