import { getActiveDialect } from './active-dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as sqliteSchema from './schema.sqlite.ts';

// Lazy schema selector - resolves to the dialect that is actually connected.
// This is important: if usePostgres=true but Postgres failed and fell back to SQLite,
// this will correctly return sqliteSchema tables (without defaultNow() etc).
function s() {
  return getActiveDialect() === 'postgres' ? pgSchema : sqliteSchema;
}

export const users = new Proxy({} as typeof pgSchema.users, {
  get: (_t, p) => (s().users as any)[p],
});

export const habits = new Proxy({} as typeof pgSchema.habits, {
  get: (_t, p) => (s().habits as any)[p],
});

export const habitLogs = new Proxy({} as typeof pgSchema.habitLogs, {
  get: (_t, p) => (s().habitLogs as any)[p],
});

export const routines = new Proxy({} as typeof pgSchema.routines, {
  get: (_t, p) => (s().routines as any)[p],
});

export const routineLogs = new Proxy({} as typeof pgSchema.routineLogs, {
  get: (_t, p) => (s().routineLogs as any)[p],
});
