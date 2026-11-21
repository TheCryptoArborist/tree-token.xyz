import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeConfiguration,config} from '../netlify/bnb-test-functions/arcade-bnb-test.mjs';

const url='https://lehswszuekjqottolmsf.supabase.co';
const secret='test-only-placeholder-not-a-real-secret';
const existing={TREE_KNOWLEDGE_TRIAL_SUPABASE_URL:url,TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY:secret};
const read=values=>name=>values[name];
test('runtime reuses only the same-project protected server binding and official BNB endpoint',()=>{
  const configured=runtimeConfiguration(read(existing));
  assert.equal(configured.getEnv('BNB_TEST_SUPABASE_URL'),url);
  assert.equal(configured.getEnv('BNB_TEST_SUPABASE_SECRET_KEY'),secret);
  assert.equal(configured.getEnv('UNRELATED_SECRET'),undefined);
  assert.equal(configured.rpcUrl,'https://bsc-dataseed.bnbchain.org');
  assert.equal(config.path,'/api/arcade-bnb-test');
  assert.deepEqual(config.rateLimit,{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:60});
});
test('wrong project, missing binding, partial override and insecure RPC fail closed',()=>{
  for(const values of [{},{...existing,TREE_KNOWLEDGE_TRIAL_SUPABASE_URL:'https://different.supabase.co'},
    {...existing,BNB_TEST_SUPABASE_URL:url},{...existing,BNB_TEST_SUPABASE_SECRET_KEY:secret},
    {...existing,BNB_TEST_SUPABASE_URL:'https://different.supabase.co',BNB_TEST_SUPABASE_SECRET_KEY:secret},
    {...existing,BNB_TEST_RPC_URL:'http://rpc.example'},
    {...existing,BNB_TEST_RPC_URL:'https://user:secret@rpc.example'}]){
    assert.throws(()=>runtimeConfiguration(read(values)));
  }
  const configured=runtimeConfiguration(read({...existing,BNB_TEST_SUPABASE_URL:url,BNB_TEST_SUPABASE_SECRET_KEY:secret+'-isolated'}));
  assert.equal(configured.getEnv('BNB_TEST_SUPABASE_SECRET_KEY'),secret+'-isolated');
});
