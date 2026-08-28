import type { Pool } from 'pg';

const STATEMENTS = [
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
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
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
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value INTEGER NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
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
    routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    date TEXT NOT NULL,
    completed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

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
      console.warn(`[initPgDatabase] Notice executing statement:`, err?.message || err);
    }
  }
  initialized = true;
  console.log('PostgreSQL schema auto-initialized (users, habits, routines, logs).');
}
