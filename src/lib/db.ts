import {Pool, PoolClient} from 'pg';

const globalPool = globalThis as typeof globalThis & {__koyaPool?:Pool};

export function pool(): Pool {
  if (!globalPool.__koyaPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    globalPool.__koyaPool = new Pool({connectionString:process.env.DATABASE_URL, max:5,
      connectionTimeoutMillis:10000, idleTimeoutMillis:30000});
  }
  return globalPool.__koyaPool;
}

export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}

export function asISO(value:Date|string):string {
  return new Date(value).toISOString();
}
