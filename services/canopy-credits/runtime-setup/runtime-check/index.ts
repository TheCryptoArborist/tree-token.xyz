import pg from 'npm:pg@8.16.3';
import { createRuntimeCheck, inspectConnections } from './check.mjs';
const { Pool } = pg;
const getEnv = (name: string) => Deno.env.get(name);
const handler = createRuntimeCheck({
  getEnv,
  inspect: () => inspectConnections({ getEnv, createPool: (settings: object) => {
    const pool = new Pool(settings);
    pool.on('error', () => { /* Do not log credential-bearing driver errors. */ });
    return pool;
  } }),
});
// Custom dedicated bearer authentication in createRuntimeCheck. No platform-key
// fallback, no origin wildcard, and no order/settlement/activation operation.
Deno.serve(handler);
