import {Pool} from 'pg';
import {createContinueGateway} from '../../../services/canopy-credits/continue-gateway.mjs';
import {createPlatformRuntime,PLATFORM_SETTINGS} from '../../../services/canopy-credits/platform-runtime.mjs';
import {DIRECT_CONTINUE,TRANSFER_DEPLOYMENT} from '../../../services/canopy-credits/continue-product.mjs';
import {connectMainnetReader} from '../../../services/canopy-credits/reader/client.mjs';
import {transferPaymentVerifier} from '../../../services/canopy-credits/transfer-payment.mjs';
import {createReceiptDiscovery} from '../../../services/canopy-credits/receipt-discovery.mjs';

const url=Deno.env.get('SUPABASE_DB_URL');
if(!url||Deno.env.get('SUPABASE_URL')!=='https://lehswszuekjqottolmsf.supabase.co')throw Error('platform-database-unavailable');
const parsed=new URL(url);
if(!['postgres:','postgresql:'].includes(parsed.protocol))throw Error('invalid-platform-database-url');
// URL-level SSL options must not override certificate verification.
for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])parsed.searchParams.delete(name);
const options={connectionString:parsed.href,max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,ssl:{rejectUnauthorized:true}};
const pool=new Pool(options),auxiliaryPool=new Pool(options);
const reader=connectMainnetReader(),verifyPayment=transferPaymentVerifier(reader);
const discovery=createReceiptDiscovery({endpoint:'https://graphql.mainnet.sui.io/graphql',verify:verifyPayment,maxPages:2,pageSize:8});
const service=createPlatformRuntime({pool,auxiliaryPool,
 configuration:{paymentsEnabled:true,deployment:TRANSFER_DEPLOYMENT,metadata:{network:DIRECT_CONTINUE.network,coinType:DIRECT_CONTINUE.coinType,decimals:6}},
 verifyPayment,discover:async terms=>{try{return await discovery(terms);}catch{return{status:'unavailable'};}}});
const handler=createContinueGateway({authOrigin:PLATFORM_SETTINGS.authOrigin,
 gameOrigin:'https://deploy-preview-3--treeforce89.netlify.app',service});
Deno.serve(handler);
