import { Pool } from 'pg';
const g = globalThis;
const pool = g.__pool || new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') g.__pool = pool;
export default pool;
