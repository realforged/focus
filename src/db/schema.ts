import { getActiveDialect } from './active-dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as sqliteSchema from './schema.sqlite.ts';

// Get active schema based on the connected database dialect resolved in index.ts
const activeSchema = getActiveDialect() === 'postgres' ? pgSchema : sqliteSchema;

export const users = activeSchema.users;
export const habits = activeSchema.habits;
export const habitLogs = activeSchema.habitLogs;
export const routines = activeSchema.routines;
export const routineLogs = activeSchema.routineLogs;
