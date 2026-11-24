// Fixed read-only live denial check. No session, signing or submission.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {assessGenerationBacking,QUERY,P} from './generation-access.mjs';
import {newClient} from '../../nftree-generation/scripts/readiness.mjs';
import {createReadProvider} from '../browser/read-rpc.mjs';
const output=process.argv[2];assert(output);const reads=[],states=[];
const remote=createReadProvider({request:async()=>{throw Error('Use read-only remote');}});
const provider={request:async q=>{const result=await remote.request(q);reads.push({...q,result});return result;}};
const client=newClient(),sui={query:async q=>{assert.equal(q.query,QUERY);const result=await client.query(q);states.push(result);return result;}};
const result=await assessGenerationBacking({wallet:P.admin,approvedGeneration:'1',provider,sui});
fs.writeFileSync(output,JSON.stringify({result,reads,states},null,2)+'\n');assert.equal(result.backingEligible,false);assert.equal(result.gameplayAuthorized,false);assert.equal(result.reason,'generation-not-active-backed','Live reads must succeed, not just fail closed');console.log(result);
