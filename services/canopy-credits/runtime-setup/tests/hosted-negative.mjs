/** Three real HTTP checks, no token, SQL, wallet, or secret provisioning. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
const url='https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-continue-runtime-check';
for(const [name,init,status,error] of [
 ['GET cannot invoke credential reads',{method:'GET'},405,'method-not-allowed'],
 ['browser origin cannot invoke credential reads',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:'{"action":"check"}'},403,'server-channel-required'],
 ['missing setup secret keeps endpoint disabled',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"check"}'},503,'setup-not-configured'],
])await test(name,async()=>{
 const r=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,status);const p=await r.json();assert.equal(p.error,error);
 assert.equal(p.credentialsVerified,false);assert.equal(p.paymentsEnabled,false);assert.equal(p.restoreAuthorized,false);
 assert.match(r.headers.get('cache-control'),/no-store/);
});
