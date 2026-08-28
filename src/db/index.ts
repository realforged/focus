import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Pool } from 'pg';
import { usePostgres } from './dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as sqliteSchema from './schema.sqlite.ts';
import { initPgDatabase } from './init-pg.ts';
import { initSqliteDatabase } from './init-sqlite.ts';
import { createPgPoolConfig } from './connection.ts';
import { setActiveDialect } from './active-dialect.ts';

export { usePostgres };
export { getActiveDialect } from './active-dialect.ts';

export type AppDb = BetterSQLite3Database<typeof sqliteSchema>;

export const createPool = () => {
  return new Pool(createPgPoolConfig());
};

function createSqliteDb(): AppDb {
  // On Vercel/Lambda the cwd is read-only — use /tmp for SQLite
  const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const dataDir = isServerless
    ? '/tmp/focus_data'
    : path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'habit_mountain.db');
  const sqlite = initSqliteDatabase(dbPath);
  setActiveDialect('sqlite');
  console.log(`Using local SQLite database at ${dbPath}`);
  return drizzleSqlite(sqlite, { schema: sqliteSchema });
}

async function createPostgresDb(): Promise<AppDb> {
  const hasDbConfig = !!(
    process.env.SUPABASE_DB_PASSWORD ||
    process.env.DATABASE_URL ||
    process.env.SQL_HOST
  );

  if (!hasDbConfig) {
    if (process.env.VERCEL === '1') {
      throw new Error(
        'No database configured. Add a Neon PostgreSQL database via Vercel Dashboard → Storage → Create → Neon Postgres (free tier available).'
      );
    }
    // On non-Vercel (Render etc.) fall back to SQLite
    console.warn('⚡ No DATABASE_URL found. Falling back to SQLite.');
    return createSqliteDb();
  }

  try {
    const pool = createPool();
    pool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });

    await initPgDatabase(pool);
    setActiveDialect('postgres');
    console.log('Connected to PostgreSQL.');
    return drizzlePg(pool, { schema: pgSchema }) as unknown as AppDb;
  } catch (err: any) {
    console.error('⚠️ PostgreSQL connection failed:', err?.message || err);
    if (err?.code === '28P01') {
      console.error('Supabase rejected the PostgreSQL password. Check your DATABASE_URL.');
    }
    if (process.env.VERCEL === '1') {
      // Don't fall back to SQLite on Vercel — it won't work reliably
      throw new Error(
        `PostgreSQL connection failed: ${err?.message}. ` +
        'Check your DATABASE_URL in Vercel Environment Variables.'
      );
    }
    console.warn('⚡ Falling back to SQLite (data will not persist on serverless platforms).');
    return createSqliteDb();
  }
}

// Lazy singleton — initialized on first call so boot errors are catchable per-request
let _db: AppDb | null = null;
let _dbInitError: Error | null = null;
let _dbInitialized = false;

export async function getDb(): Promise<AppDb> {
  if (_dbInitialized) {
    if (_dbInitError) throw _dbInitError;
    return _db!;
  }
  _dbInitialized = true;
  try {
    _db = usePostgres ? await createPostgresDb() : createSqliteDb();
    return _db;
  } catch (err: any) {
    _dbInitError = err;
    throw err;
  }
}

// Top-level await for non-Vercel environments (keeps Render working as before)
// On Vercel, db init happens lazily on first request via getDb()
export const db: AppDb = process.env.VERCEL !== '1'
  ? (usePostgres ? await createPostgresDb() : createSqliteDb())
  : new Proxy({} as AppDb, {
      get: (_target, prop) => {
        throw new Error(
          `Database not initialized. Call getDb() first. (Vercel lazy-init mode) Tried to access: ${String(prop)}`
        );
      }
    });
