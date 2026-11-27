// Narrow declarations for the pinned pg 8.23.1 operations used by this reader.
// Runtime dependencies are isolated in vendor/arcade-growth-backend.
declare module 'pg' {
  class Pool {
    constructor(options: { connectionString: string; max: number; connectionTimeoutMillis: number;
      query_timeout: number; statement_timeout: number; idleTimeoutMillis: number; allowExitOnIdle: boolean });
    query(text: string, values: string[]): Promise<{ rows: Record<string, unknown>[] }>;
    on(event: 'error', callback: (error: Error) => void): void;
    end(): Promise<void>;
  }
  const pg: { Pool: typeof Pool };
  export default pg;
}
