import {Pool} from 'pg';
import {createContinueGateway} from '../../../services/canopy-credits/continue-gateway.mjs';
import {createPlatformRuntime,PLATFORM_SETTINGS} from '../../../services/canopy-credits/platform-runtime.mjs';

const url=Deno.env.get('SUPABASE_DB_URL');
if(!url||Deno.env.get('SUPABASE_URL')!=='https://lehswszuekjqottolmsf.supabase.co')throw Error('platform-database-unavailable');
const parsed=new URL(url);
if(!['postgres:','postgresql:'].includes(parsed.protocol))throw Error('invalid-platform-database-url');
// URL-level SSL options must not override certificate verification.
for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])parsed.searchParams.delete(name);
const pool=new Pool({connectionString:parsed.href,max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,ssl:{rejectUnauthorized:true}});
const service=createPlatformRuntime({pool});
const handler=createContinueGateway({authOrigin:PLATFORM_SETTINGS.authOrigin,
 gameOrigin:'https://deploy-preview-3--treeforce89.netlify.app',service});
Deno.serve(handler);
