/**
 * TREE FORCE '89 preview backend deployment gate.
 *
 * No database client is constructed here. The caller must provide independent
 * verification that the TREE FORCE preview DB is not the TREE Token production
 * DB or the original TREE FORCE production DB.
 *
 * This module MUST NOT be used to enable public handlers until database
 * isolation has been independently verified in Netlify.
 */
export const TREE_TOKEN_SITE_ID='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
export const TREE_FORCE_SITE_ID='35f5591a-5c7d-4bc6-ae9a-3e61e816b641';
export const INTEGRATION_BRANCH='feature/treeforce89-play-integration';

export function assertTreeForcePreviewIsolation({
  build,context,request,
  databaseIdentity,
  productionDatabaseIdentities,
  isolationVerified=false,
}={}){
  if(build?.branch!==INTEGRATION_BRANCH ||
     build?.context!=='deploy-preview' ||
     context?.deploy?.context!=='deploy-preview' ||
     context?.site?.id!==TREE_TOKEN_SITE_ID ||
     typeof context?.deploy?.id!=='string' || !context.deploy.id)
    throw Error('TREE FORCE preview deployment identity not verified');
  const url=new URL(request?.url);
  const allowedHost='deploy-preview-'+String(build.prNumber)+'--tree-token.netlify.app';
  const deployHost=context.deploy.id+'--tree-token.netlify.app';
  if(!Number.isSafeInteger(build.prNumber) || build.prNumber<1 ||
     url.protocol!=='https:' ||
     (url.host!==allowedHost && url.host!==deployHost) ||
     request.method!=='POST' ||
     request.headers.get('origin')!==url.origin ||
     request.headers.get('sec-fetch-site')==='cross-site')
    throw Error('TREE FORCE preview request origin not verified');

  // These identities must come from independently reviewed Netlify
  // configuration, never from a browser request or a self-attested boolean.
  if(isolationVerified!==true ||
     typeof databaseIdentity!=='string' || !databaseIdentity.trim() ||
     !Array.isArray(productionDatabaseIdentities) ||
     productionDatabaseIdentities.length<2 ||
     productionDatabaseIdentities.some(id=>typeof id!=='string'||!id.trim()) ||
     productionDatabaseIdentities.includes(databaseIdentity))
    throw Error('TREE FORCE preview database isolation not verified');
  return {approved:true,siteId:TREE_TOKEN_SITE_ID,branch:INTEGRATION_BRANCH};
}
