import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
};

let _pool = new Pool(poolConfig);
let _db: NodePgDatabase<typeof schema> = drizzle(_pool, { schema });

export function getPool(): Pool {
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return _db;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return (_pool as any)[prop];
  },
});
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return (_db as any)[prop];
  },
});

export async function resetPool(): Promise<void> {
  try {
    await _pool.end();
  } catch (_e) {}
  _pool = new Pool(poolConfig);
  _db = drizzle(_pool, { schema });
}
