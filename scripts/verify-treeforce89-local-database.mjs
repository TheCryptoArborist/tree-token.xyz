// Local in-memory checks only. Never reads hosted credentials or uses a hosted database.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const sourceRoot=resolve(process.argv[2]||'../treeforce89');
const harnessRoot=resolve(process.argv[3]||'../local-db-harness');
const sourceRequire=createRequire(resolve(sourceRoot,'package.json'));
const {NetlifyDB}=await import(pathToFileURL(resolve(harnessRoot,'node_modules/@netlify/database-dev/dist/main.js')));
const {default:pg}=await import(pathToFileURL(sourceRequire.resolve('pg')));
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {Ed25519Keypair}=await import(pathToFileURL(resolve(sourceRoot,'node_modules/@mysten/sui/dist/keypairs/ed25519/keypair.mjs')));
import {inspectTreeForceSchema} from './lib/treeforce89-schema.mjs';
import {createIntegratedGatewayHandler} from '../netlify/preview-lib/treeforce89-gateway.mjs';
const {createWalletGatewayService}=await import(pathToFileURL(resolve(sourceRoot,'app/game/wallet-gateway-service.mjs')));
const {createAuthenticatedSessionResolver}=await import(pathToFileURL(resolve(sourceRoot,'app/game/authenticated-session.mjs')));
const {createGameRunService}=await import(pathToFileURL(resolve(sourceRoot,'app/game/game-run-service.mjs')));
const {NFTREE_TYPE}=await import(pathToFileURL(resolve(sourceRoot,'app/game/nftree-access.mjs')));

const db=new NetlifyDB({logger:()=>{}});
let pool;
try {
  const connectionString=await db.start();
  pool=new pg.Pool({connectionString,max:1});
  const {execFileSync}=await import('node:child_process');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),
    'a38e08e37e1f71ea41b86add8e26a92b0789cf22');
  const {createHash}=await import('node:crypto');
  const migration=await readFile(new URL('../db/staged-migrations/20261016030500_tree_authentication.sql',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(migration).digest('hex'),
    'c98e97212e3b9bc2a8731324f2b11a682cc03fbd6c262fb1ab93ac1aa3076c36');
  assert.equal((await inspectTreeForceSchema(pool)).schemaReady,false);
  await db.applyMigrations(new URL('../db/staged-migrations',import.meta.url).pathname);
  const schema=await inspectTreeForceSchema(pool);
  assert.equal(schema.schemaReady,true,JSON.stringify(schema));
  assert.equal(schema.tableCount,4);
  await pool.query('ALTER TABLE tree_game_sessions DROP CONSTRAINT tree_game_sessions_session_token_hash_key');
  assert.equal((await inspectTreeForceSchema(pool)).schemaReady,false);
  await pool.query('ALTER TABLE tree_game_sessions ADD UNIQUE(session_token_hash)');
  await pool.query('ALTER TABLE tree_game_sessions ALTER COLUMN wave TYPE bigint');
  assert.equal((await inspectTreeForceSchema(pool)).schemaReady,false);
  await pool.query('ALTER TABLE tree_game_sessions ALTER COLUMN wave TYPE integer');
  await pool.query('ALTER TABLE tree_game_sessions ALTER COLUMN expires_at DROP DEFAULT');
  assert.equal((await inspectTreeForceSchema(pool)).schemaReady,false);
  await pool.query("ALTER TABLE tree_game_sessions ALTER COLUMN expires_at SET DEFAULT (now()+INTERVAL '2 hours')");
  assert.equal((await inspectTreeForceSchema(pool)).schemaReady,true);
  const origin='https://deploy-preview-69--tree-token.netlify.app';
  const keypair=new Ed25519Keypair();
  const client=owns=>({network:'mainnet',core:{listOwnedObjects:async input=>{
    assert.equal(input.type,NFTREE_TYPE);
    return {objects:owns?[{type:NFTREE_TYPE}]:[],cursor:null};
  }}});
  const sign=async(service,key)=>{
    const challenge=await service.issue({wallet:key.toSuiAddress()});
    const {signature}=await key.signPersonalMessage(new TextEncoder().encode(challenge.message));
    return {wallet:key.toSuiAddress(),nonce:challenge.nonce,signature};
  };
  const service=createWalletGatewayService({pool,client:client(true),origin});
  const proof=await sign(service,keypair);
  const session=await service.enter(proof);
  const resolver=createAuthenticatedSessionResolver(pool);
  assert.equal((await resolver(session)).wallet,keypair.toSuiAddress());
  await assert.rejects(service.enter(proof),{code:'SIGN_IN_REJECTED'});
  const runs=createGameRunService({pool,ownershipChecker:async()=>true});
  const rotated=await runs.restart(session);
  assert.notEqual(rotated.runId,session.runId);
  assert.notEqual(rotated.sessionToken,session.sessionToken);
  assert.equal(rotated.expiresAt,session.expiresAt);
  await assert.rejects(resolver(session),{code:'SESSION_REQUIRED'});
  assert.equal((await resolver(rotated)).runId,rotated.runId);
  await service.revoke(rotated);
  await assert.rejects(resolver(rotated),{code:'SESSION_REQUIRED'});
  const denied=createWalletGatewayService({pool,client:client(false),origin});
  await assert.rejects(denied.enter(await sign(denied,new Ed25519Keypair())),{code:'NFTREE_REQUIRED'});
  const invalid=await sign(service,new Ed25519Keypair());
  invalid.signature=(await new Ed25519Keypair().signPersonalMessage(new TextEncoder().encode('wrong message'))).signature;
  await assert.rejects(service.enter(invalid),{code:'SIGN_IN_REJECTED'});
  // Exercise the actual TREE Token HTTP adapters with real signatures and SQL.
  // Only NFT ownership is a fixture; this injection is never request-controlled.
  const httpOrigin='https://deploy-preview-70--tree-token.netlify.app';
  const build={branch:'feature/treeforce89-play-integration',context:'deploy-preview',prNumber:70};
  const context={site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'},
    deploy:{id:'a'.repeat(24),context:'deploy-preview'}};
  const httpGateway=createWalletGatewayService({pool,client:client(true),origin:httpOrigin});
  const httpRuns=createGameRunService({pool,ownershipChecker:async()=>true});
  const http=async(action,body,token)=>{
    const request=new Request(httpOrigin+'/.netlify/functions/tree-test',{
      method:'POST',headers:{origin:httpOrigin,...(body?{'Content-Type':'application/json'}:{}),
        ...(token?{Authorization:'Bearer '+token}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    return createIntegratedGatewayHandler({action,build,services:async()=>({gateway:httpGateway,runs:httpRuns})})(request,context);
  };
  const httpKey=new Ed25519Keypair();
  const challengeResponse=await http('challenge',{wallet:httpKey.toSuiAddress()});
  assert.equal(challengeResponse.status,201);
  const challengeBody=await challengeResponse.json();
  const httpSignature=await httpKey.signPersonalMessage(new TextEncoder().encode(challengeBody.message));
  const httpProof={wallet:httpKey.toSuiAddress(),nonce:challengeBody.nonce,signature:httpSignature.signature};
  const sessionResponse=await http('enter',httpProof);assert.equal(sessionResponse.status,201);
  const httpSession=await sessionResponse.json();
  assert.equal((await http('enter',httpProof)).status,401);
  const restartResponse=await http('restart',{runId:httpSession.runId},httpSession.sessionToken);
  assert.equal(restartResponse.status,201);const httpNext=await restartResponse.json();
  assert.notEqual(httpNext.sessionToken,httpSession.sessionToken);
  assert.equal((await http('restart',{runId:httpSession.runId},httpSession.sessionToken)).status,401);
  assert.equal((await http('logout',undefined,httpNext.sessionToken)).status,200);
  assert.equal((await http('restart',{runId:httpNext.runId},httpNext.sessionToken)).status,401);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM tree_continue_redemptions')).rows[0].n),0);
  console.log(JSON.stringify({engine:'Netlify local PostgreSQL emulation (PGlite)',
    migrationAppliedLocally:true,tableCount:schema.tableCount,
    columnChecks:Object.keys(schema.columnChecks).length,
    keyChecks:Object.keys(schema.keys).length,checkConstraints:schema.checks,
    indexes:schema.indexChecks,defaults:schema.defaults,
    missingSchemaRejected:true,missingUniqueRejected:true,wrongTypeRejected:true,missingExpiryRejected:true,
    realSignatures:true,challengeReplayRejected:true,holderFixtureAllowed:true,nonholderFixtureRejected:true,
    forgedSignatureRejected:true,runRotation:true,oldTokenRejected:true,logout:true,
    integratedHttpGateway:true,integratedHttpRunRotation:true,integratedHttpLogout:true,
    paymentRows:0,hostedDatabaseTested:false,liveNFTreeOwnershipTested:false}));
} finally {if(pool)await pool.end();await db.stop();}
