import type { Pool } from 'pg';

const STATEMENTS = [
  // 1. Create tables if they do not exist
  `CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT,
    total_points INTEGER DEFAULT 0,
    locked_in_days INTEGER DEFAULT 0,
    consecutive_locked_in_streak INTEGER DEFAULT 0,
    journey_start_date TEXT,
    challenge_days INTEGER DEFAULT 90,
    is_challenge_started BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 10,
    type TEXT NOT NULL,
    target INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL,
    repeat TEXT NOT NULL,
    repeat_days TEXT,
    time_of_day TEXT,
    time_block TEXT,
    enable_focus_timer INTEGER DEFAULT 0,
    routine_id TEXT,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS habit_logs (
    id SERIAL PRIMARY KEY,
    habit_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    value INTEGER NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 10,
    time_block TEXT NOT NULL,
    repeat TEXT NOT NULL,
    repeat_days TEXT,
    habit_ids TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS routine_logs (
    id SERIAL PRIMARY KEY,
    routine_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    completed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 2. Migration: If tables already existed with older/different schema, ensure required columns exist
  `DO $$ 
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'uid'
    ) THEN
      ALTER TABLE public.users ADD COLUMN uid TEXT;
      UPDATE public.users SET uid = id::text;
    END IF;
  END $$;`,

  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS uid TEXT;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_in_days INTEGER DEFAULT 0;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS consecutive_locked_in_streak INTEGER DEFAULT 0;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS journey_start_date TEXT;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS challenge_days INTEGER DEFAULT 90;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_challenge_started BOOLEAN DEFAULT FALSE;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,

  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS id TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS user_id TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS name TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS category TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 10;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Count';`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS target INTEGER DEFAULT 1;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'times';`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS repeat TEXT DEFAULT 'Daily';`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS repeat_days TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS time_of_day TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS time_block TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS enable_focus_timer INTEGER DEFAULT 0;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS routine_id TEXT;`,
  `ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS created_at TEXT;`,

  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS habit_id TEXT;`,
  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;`,
  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS date TEXT;`,
  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS value INTEGER;`,
  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;`,
  `ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,

  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS id TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS user_id TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS name TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 10;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS time_block TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS repeat TEXT DEFAULT 'Daily';`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS repeat_days TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS habit_ids TEXT;`,
  `ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,

  `ALTER TABLE public.routine_logs ADD COLUMN IF NOT EXISTS routine_id TEXT;`,
  `ALTER TABLE public.routine_logs ADD COLUMN IF NOT EXISTS user_id TEXT;`,
  `ALTER TABLE public.routine_logs ADD COLUMN IF NOT EXISTS date TEXT;`,
  `ALTER TABLE public.routine_logs ADD COLUMN IF NOT EXISTS completed BOOLEAN;`,
  `ALTER TABLE public.routine_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,

  // 3. Performance Indexes
  `CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);`,
  `CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_routine_logs_user_id ON routine_logs(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_id ON routine_logs(routine_id);`
];

let initialized = false;

export async function initPgDatabase(pool: Pool): Promise<void> {
  if (initialized) return;
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn(`[initPgDatabase] Migration statement notice:`, err?.message || err);
    }
  }
  initialized = true;
  console.log('PostgreSQL schema verified and migrated successfully.');
}
