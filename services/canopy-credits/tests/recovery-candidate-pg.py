import os,json,uuid,hashlib,subprocess,unittest
from pathlib import Path
assert os.environ.get('PGHOST')=='127.0.0.1' and os.environ.get('PGDATABASE')=='recovery_ci','Disposable database only'
root=Path(__file__).resolve().parents[1]
def sql(q,fail=False):
 r=subprocess.run(['psql','-XqAt','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True,check=False)
 if fail:
  assert r.returncode!=0,'Expected rejection';return r.stderr
 assert r.returncode==0,r.stderr
 s=r.stdout.strip();return json.loads(s) if s.startswith(('{','[')) else s
def lit(x):return 'NULL' if x is None else "'"+str(x).replace("'","''")+"'"
def call(a,p,action,run=None,req=None,snap=None,h=None,role='service_role',fail=False):
 return sql('BEGIN;SET LOCAL ROLE '+role+';SELECT public.tree_recovery_candidate_rpc('+','.join(map(lit,[a,p,action,run,req,snap,h]))+');COMMIT;',fail)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  sql('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;')
  sql((root/'direct-continue-schema.sql').read_text());sql((root/'migrations/flight-storage-v1.sql').read_text());sql((root/'migrations/recovery-candidate-rpc.sql').read_text())
 def setUp(self):
  self.a=str(uuid.uuid4());self.run=str(uuid.uuid4());self.p='0x'+hashlib.sha256(self.a.encode()).hexdigest()
 def save(self):
  s=json.dumps(dict(format='treeforce89.checkpoint.v1',ruleset='treeforce89.v1',runId=self.run,wave=3,score=15000,lives=0,continuesUsed=0,scene=dict(codec='formation-recovery.v1')),sort_keys=True,separators=(',',':'));h=hashlib.sha256(s.encode()).hexdigest()
  return call(self.a,self.p,'save',self.run,str(uuid.uuid4()),s,h),s,h
 def test_empty_list(self):self.assertEqual(call(self.a,self.p,'list')['flights'],[])
 def test_save_recover_and_idempotent(self):
  one,s,h=self.save();two=call(self.a,self.p,'save',self.run,str(uuid.uuid4()),s,h);self.assertEqual(one['checkpointId'],two['checkpointId']);r=call(self.a,self.p,'recover',self.run);self.assertEqual(r['snapshotText'],s);self.assertFalse(r['restoreAuthorized']);self.assertFalse(r['paymentsEnabled']);self.assertEqual(len(call(self.a,self.p,'list')['flights']),1)
 def test_wrong_payer(self):self.save();self.assertIn('identity',call(self.a,'0x'+'2'*64,'recover',self.run,fail=True))
 def test_cross_account(self):self.save();self.assertEqual(call(str(uuid.uuid4()),self.p,'list')['flights'],[])
 def test_public_grants_denied(self):
  for role in ['anon','authenticated']:self.assertIn('permission denied',call(self.a,self.p,'list',role=role,fail=True))
 def test_service_has_no_private_access(self):self.assertIn('permission denied',sql('BEGIN;SET LOCAL ROLE service_role;SELECT * FROM tree_continue_v1.orders;COMMIT;',True))
 def test_no_payment_or_review_writer(self):
  self.save();self.assertIn('invalid_candidate_request',call(self.a,self.p,'verify',self.run,fail=True));self.assertEqual(sql('SELECT count(*) FROM tree_continue_v1.orders'),'0');self.assertEqual(sql('SELECT count(*) FROM tree_continue_v1.checkpoint_reviews'),'0')
 def test_rate_limit(self):
  for _ in range(60):call(self.a,self.p,'list')
  self.assertIn('candidate_rate_limit',call(self.a,self.p,'list',fail=True))
 def test_hash_mismatch(self):
  _,s,h=self.save();self.assertIn('already_fixed',call(self.a,self.p,'save',self.run,str(uuid.uuid4()),s,'0'*64,fail=True))
if __name__=='__main__':unittest.main(verbosity=2)
