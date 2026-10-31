import {createHash} from 'node:crypto';
import {getDatabase,getConnectionString} from '@netlify/database';
import evidence from './treeforce89-database-evidence.json' with {type:'json'};
import {inspectTreeForceSchema} from '../../scripts/lib/treeforce89-schema.mjs';
let cached;
let canonicalCached;

export function databaseIdentity(connectionString) {
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol)||
    !url.hostname.endsWith('.db.netlify.com')||url.pathname!=='/netlifydb')
    throw Error('Unapproved database provider');
  const host=url.hostname.replace(/-pooler(?=\.)/,'');
  return createHash('sha256').update(host+'|'+url.pathname).digest('hex');
}

export function previewRequestAllowed(build,context,request) {
  if(build?.branch!==evidence.branch||build?.context!=='deploy-preview'||
    context?.deploy?.context!=='deploy-preview'||context?.site?.id!==evidence.siteId||
    !/^[a-f0-9]{24}$/.test(context?.deploy?.id||'')||
    !Number.isSafeInteger(build.prNumber)||build.prNumber<1)return false;
  const url=new URL(request.url);
  return url.protocol==='https:'&&[
    `deploy-preview-${build.prNumber}--tree-token.netlify.app`,
    `${context.deploy.id}--tree-token.netlify.app`,
  ].includes(url.host)&&request.method==='POST'&&
    request.headers.get('origin')===url.origin&&
    request.headers.get('sec-fetch-site')!=='cross-site';
}

// This narrow release is the development Gateway mounted on TREE Arcade.
// It never selects the site's default (production) database.
export function canonicalDevelopmentRequestAllowed(build,context,request) {
  if(build?.branch!==evidence.branch||build?.mode!=='canonical-development'||
    context?.deploy?.context!=='production'||context?.site?.id!==evidence.siteId||
    !/^[a-f0-9]{24}$/.test(context?.deploy?.id||''))return false;
  const url=new URL(request.url);
  return url.protocol==='https:'&&[
    'tree-token.xyz','www.tree-token.xyz',
    // An immutable candidate can be verified with unfunded test keys before publication.
    `${context.deploy.id}--tree-token.netlify.app`,
  ].includes(url.host)&&url.pathname.startsWith('/play/treeforce89/api/')&&
    request.method==='POST'&&request.headers.get('origin')===url.origin&&
    request.headers.get('sec-fetch-site')!=='cross-site';
}

export function gatewayRequestAllowed(build,context,request) {
  return build?.mode==='canonical-development'
    ?canonicalDevelopmentRequestAllowed(build,context,request)
    :previewRequestAllowed(build,context,request);
}

export function getCanonicalDevelopmentDatabase() {
  const connectionString=process.env.TREEFORCE89_DEV_DATABASE_URL;
  if(!connectionString)throw Error('Development database binding unavailable');
  const identity=databaseIdentity(connectionString);
  if(evidence.isolationVerified!==true||
    evidence.productionDatabaseIdentities.includes(identity)||
    identity!==evidence.previewDatabaseIdentity)throw Error('Database isolation unverified');
  if(!canonicalCached||canonicalCached.identity!==identity)
    canonicalCached={identity,pool:getDatabase({connectionString}).pool};
  return canonicalCached;
}

export function getPreviewDatabase({requireVerified=true}={}) {
  const identity=databaseIdentity(getConnectionString());
  if(evidence.productionDatabaseIdentities.includes(identity))throw Error('Production database refused');
  if(requireVerified&&(evidence.isolationVerified!==true||
    identity!==evidence.previewDatabaseIdentity))throw Error('Database isolation unverified');
  if(!cached||cached.identity!==identity)cached={identity,pool:getDatabase().pool};
  return cached;
}

export async function databaseStatus() {
  const {identity,pool}=getPreviewDatabase({requireVerified:false});
  const schema=await inspectTreeForceSchema(pool);
  return {databaseIdentity:identity,distinctFromProduction:true,
    isolationVerified:evidence.isolationVerified===true&&identity===evidence.previewDatabaseIdentity,
    schemaReady:schema.schemaReady,tableCount:schema.tableCount,
    schemaChecks:{columns:Object.values(schema.columnChecks).every(Boolean),
      keys:Object.values(schema.keys).every(Boolean),checks:Object.values(schema.checks).every(Boolean),
      indexes:Object.values(schema.indexChecks).every(Boolean),defaults:Object.values(schema.defaults).every(Boolean)},
    paymentsEnabled:false};
}
