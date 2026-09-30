export const RECOVERY_AUTH_ORIGIN='https://deploy-preview-48--tree-token.netlify.app';
export const RECOVERY_GAME_ORIGIN='https://deploy-preview-3--treeforce89.netlify.app';
/** Exact non-production origin; preserve the existing wallet-account alias namespace. */
export function accountDeployment(request,env){
 const storedOrigin=env.get('TREE_ACCOUNT_PREVIEW_ORIGIN');
 const candidate=new URL(request.url).origin===RECOVERY_AUTH_ORIGIN;
 const origin=candidate?RECOVERY_AUTH_ORIGIN:storedOrigin;
 const gameOrigin=candidate?RECOVERY_GAME_ORIGIN:env.get('TREE_ACCOUNT_GAME_ORIGIN');
 const enabled=env.get('TREE_ACCOUNT_PREVIEW_ENABLED')==='true';
 if(!enabled||!storedOrigin||!/^https:\/\/deploy-preview-[0-9]+--tree-token\.netlify\.app$/.test(storedOrigin)||!origin||!gameOrigin||new URL(request.url).origin!==origin)return null;
 return {origin,gameOrigin,storedOrigin};
}
