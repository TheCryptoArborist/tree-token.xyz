import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withoutApprovedFlag,FLAG} from '../scripts/activate-treeforce89-payments.mjs';
const row=()=>({key:FLAG,scopes:['functions'],is_secret:false,values:[{context:'production',value:'true'}]});
test('only the production function flag is excluded from preservation comparisons',()=>{
 const other={key:'DATABASE_BINDING',scopes:['functions'],values:[{id:'unchanged'}]};
 assert.deepEqual(withoutApprovedFlag([other,row()],true),[other]);
 assert.deepEqual(withoutApprovedFlag([other],false),[other]);
 for(const alter of [r=>r.scopes.push('builds'),r=>r.values.push({context:'deploy-preview',value:'true'}),r=>r.values[0].value='false',r=>r.values[0].context='all',r=>r.is_secret=true]){
  const r=row();alter(r);assert.throws(()=>withoutApprovedFlag([r],true));
 }
 assert.throws(()=>withoutApprovedFlag([],true));
 assert.throws(()=>withoutApprovedFlag([row(),row()],true));
 assert.throws(()=>withoutApprovedFlag([row()],false));
});
