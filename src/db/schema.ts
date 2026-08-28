import { getActiveDialect } from './active-dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as sqliteSchema from './schema.sqlite.ts';

// Lazy schema selector - resolves to the dialect that is actually connected.
function getSchema() {
  return getActiveDialect() === 'postgres' ? pgSchema : sqliteSchema;
}

// Full proxy wrapper delegating all reflection traps to the active Drizzle table object
function createTableProxy<T extends object>(getTable: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const table = getTable();
      const val = Reflect.get(table, prop, table);
      return typeof val === 'function' ? val.bind(table) : val;
    },
    has(_target, prop) {
      return Reflect.has(getTable(), prop);
    },
    ownKeys(_target) {
      return Reflect.ownKeys(getTable());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(getTable(), prop);
      if (desc) {
        desc.configurable = true;
      }
      return desc;
    },
    getPrototypeOf(_target) {
      return Reflect.getPrototypeOf(getTable());
    }
  });
}

export const users = createTableProxy(() => getSchema().users);
export const habits = createTableProxy(() => getSchema().habits);
export const habitLogs = createTableProxy(() => getSchema().habitLogs);
export const routines = createTableProxy(() => getSchema().routines);
export const routineLogs = createTableProxy(() => getSchema().routineLogs);
