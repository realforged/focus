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

export type AppDb = BetterSQLite3Database<typeof sqliteSchema>;

export const createPool = () => {
  return new Pool(createPgPoolConfig());
};

function createSqliteDb(): AppDb {
  const dataDir = path.join(process.cwd(), 'data');
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
  if (
    process.env.VERCEL === '1' &&
    !process.env.SUPABASE_DB_PASSWORD &&
    !process.env.DATABASE_URL &&
    !process.env.SQL_HOST
  ) {
    throw new Error(
      'DATABASE_URL or SUPABASE_DB_PASSWORD must be set in Vercel environment variables. SQLite is not supported on serverless deployments.'
    );
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
      console.error(
        'Supabase rejected the PostgreSQL password. In Render, use the Database Password from Supabase Project Settings > Database.'
      );
    }
    if (process.env.VERCEL === '1') {
      throw err;
    }
    console.warn('⚡ DATABASE_URL is invalid or unreachable. Fix the DATABASE_URL in Render dashboard.');
    console.warn('⚡ Booting with local SQLite as a temporary fallback (data will not persist across deploys).');
    return createSqliteDb();
  }
}

export const db: AppDb = usePostgres ? await createPostgresDb() : createSqliteDb();
