import { runOnce } from '../src/worker.mjs';

try { console.log(JSON.stringify(await runOnce())); }
catch { console.error('TREE Telegram worker failed. Check server configuration and queue status.'); process.exitCode = 1; }
