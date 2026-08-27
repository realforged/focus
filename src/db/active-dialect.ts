// Active dialect tracker — separate module to avoid circular imports.
// Set by db/index.ts after connection. Read by db/schema.ts.

let _activeDialect: 'postgres' | 'sqlite' = 'sqlite';

export function setActiveDialect(dialect: 'postgres' | 'sqlite') {
  _activeDialect = dialect;
}

export function getActiveDialect(): 'postgres' | 'sqlite' {
  return _activeDialect;
}
