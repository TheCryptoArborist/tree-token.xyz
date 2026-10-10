"""No live requests or credentials: controlled Management API fixtures."""
import base64
import copy
import hashlib
import hmac
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import uuid
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import tree_runtime_setup as s
POLICY=dict(new_orders_enabled=False,settlement_enabled=False,auth_origin=s.AUTH_ORIGIN,
 environment='release-candidate',admin_wallet=s.ADMIN,pilot_wallet=s.PILOT,
 deployment_unconfigured=True,total_limit_raw='0',reserved_raw='0')
ROLES=[dict(rolname=g,rolcanlogin=False,rolsuper=False,rolcreatedb=False,rolcreaterole=False,
 rolreplication=False,rolbypassrls=False) for g in s.GROUPS.values()]
POOLER=[dict(database_type='PRIMARY',pool_mode='transaction',is_using_scram_auth=True,
 db_host='aws-0-us-east-2.pooler.supabase.com',db_user='postgres.'+s.PROJECT,db_port=6543,db_name='postgres')]
OK=dict(protocol='tree-runtime-check.v1',projectRef=s.PROJECT,credentialsVerified=True,
 paymentsEnabled=False,restoreAuthorized=False,policyDisabled=True,checkedRoles=list(s.MODES))
class FakeApi:
 def __init__(self):
  self.calls=[];self.policy=copy.deepcopy(POLICY);self.roles=copy.deepcopy(ROLES)
  self.names=set();self.pooler=copy.deepcopy(POOLER);self.project=s.PROJECT
  self.written={};self.probe_result=copy.deepcopy(OK);self.fail_write=False;self.fail_probe=False
  self.conflict_after_create=False;self.created=False
 def request(self,method,suffix='',body=None):
  self.calls.append((method,suffix,body))
  if (method,suffix)==('GET',''):return {'id':self.project,'status':'ACTIVE_HEALTHY'}
  if (method,suffix)==('GET','/config/database/pooler'):return copy.deepcopy(self.pooler)
  if (method,suffix)==('GET','/secrets'):
   names=self.names|set(self.written)
   if self.created and self.conflict_after_create:names=names|{s.SETUP_SECRET}
   return [{'name':k,'value':'DO NOT DISPLAY'} for k in names]
  if (method,suffix)==('POST','/secrets'):
   if self.fail_write:raise s.SetupError('network-error')
   self.written={r['name']:r['value'] for r in body};return {}
  raise AssertionError((method,suffix))
 def query(self,q,read_only=True):
  self.calls.append(('QUERY',read_only,q))
  if q==s.POLICY_SQL:return [copy.deepcopy(self.policy)]
  if q==s.ROLE_SQL:return copy.deepcopy(self.roles)
  if 'CREATE ROLE' in q:self.created=True
  return [{'ok':True}]
 def probe(self,token):
  self.calls.append(('PROBE',None,None))
  if self.fail_probe:raise s.SetupError('network-error')
  assert token==self.written[s.SETUP_SECRET]
  return copy.deepcopy(self.probe_result)
class SetupTests(unittest.TestCase):
 def run_fake(self,api,confirm=True):
  progress=[]
  result=s.run_setup(api,lambda _:confirm,progress.append,lambda _:None)
  return result,progress
 def test_01_project_is_pinned(self):
  a=FakeApi();a.project='another-project'
  with self.assertRaisesRegex(s.SetupError,'project-not-ready'):self.run_fake(a)
  self.assertFalse(a.created)
 def test_02_disabled_policy_required(self):
  for field,value in [('new_orders_enabled',True),('settlement_enabled',True),('total_limit_raw','1'),('deployment_unconfigured',False),('admin_wallet',s.PILOT),('pilot_wallet',s.ADMIN)]:
   with self.subTest(field=field):
    a=FakeApi();a.policy[field]=value
    with self.assertRaisesRegex(s.SetupError,'policy-not-disabled'):self.run_fake(a)
    self.assertFalse(a.created)
 def test_03_missing_roles_block(self):
  a=FakeApi();a.roles.pop()
  with self.assertRaisesRegex(s.SetupError,'roles-not-ready'):self.run_fake(a)
 def test_04_overprivileged_base_role_block(self):
  a=FakeApi();a.roles[0]['rolsuper']=True
  with self.assertRaisesRegex(s.SetupError,'roles-not-ready'):self.run_fake(a)
 def test_05_existing_login_never_reset(self):
  a=FakeApi();a.roles.append({'rolname':s.LOGINS['orders']})
  with self.assertRaisesRegex(s.SetupError,'already-configured'):self.run_fake(a)
  self.assertFalse(a.created)
 def test_06_existing_secret_never_overwritten(self):
  a=FakeApi();a.names.add(s.SETUP_SECRET)
  with self.assertRaisesRegex(s.SetupError,'already-configured'):self.run_fake(a)
  self.assertFalse(a.written)
 def test_07_pooler_validated(self):
  self.assertEqual(s.choose_pooler(POOLER).port,6543)
  for field,value in [('db_host','attacker.example'),('db_port',5432),('db_user','postgres.other'),('db_name','another'),('is_using_scram_auth',False)]:
   r=copy.deepcopy(POOLER);r[0][field]=value
   with self.subTest(field=field),self.assertRaisesRegex(s.SetupError,'pooler-unavailable'):s.choose_pooler(r)
 def test_08_ambiguous_pooler_blocks(self):
  with self.assertRaisesRegex(s.SetupError,'pooler-unavailable'):s.choose_pooler(POOLER*2)
 def test_09_decline_makes_no_write(self):
  a=FakeApi()
  with self.assertRaisesRegex(s.SetupError,'cancelled'):self.run_fake(a,False)
  self.assertFalse(a.created);self.assertFalse(a.written)
 def test_10_credentials_independent_and_hidden_from_sql(self):
  passwords,values=s.credentials(s.choose_pooler(POOLER));sql=s.create_roles_sql(passwords,str(uuid.uuid4()))
  self.assertEqual(len(set(passwords.values())),5);self.assertEqual(set(values),s.ALL_SECRETS)
  for password in passwords.values():self.assertNotIn(password,sql)
  self.assertEqual(sql.count('PASSWORD \'SCRAM-SHA-256$'),5)
  self.assertEqual(sql.count(' NOLOGIN INHERIT '),5)
 def test_11_scram_reference_math(self):
  password='A'*48;salt=bytes(range(16));v=s.scram_verifier(password,salt,4096)
  self.assertTrue(v.startswith('SCRAM-SHA-256$4096:'))
  _,iteration_salt,keys=v.split('$');iterations,salt64=iteration_salt.split(':');stored64,server64=keys.split(':')
  salted=hashlib.pbkdf2_hmac('sha256',password.encode(),base64.b64decode(salt64),int(iterations))
  client_key=hmac.digest(salted,b'Client Key','sha256')
  self.assertEqual(base64.b64decode(stored64),hashlib.sha256(client_key).digest())
  self.assertEqual(base64.b64decode(server64),hmac.digest(salted,b'Server Key','sha256'))
 def test_12_cleanup_scoped_to_batch(self):
  batch=str(uuid.uuid4());q=s.switch_logins_sql(batch,False)
  self.assertIn('shobj_description',q);self.assertIn(batch,q);self.assertIn('NOLOGIN',q)
  self.assertNotIn('DROP ',q);self.assertNotIn('PASSWORD',q);self.assertNotIn('UPDATE tree_continue',q)
 def test_13_success_requires_hosted_login_check(self):
  a=FakeApi();result,progress=self.run_fake(a)
  self.assertEqual(result['status'],'RUNTIME CREDENTIALS VERIFIED')
  self.assertFalse(result['paymentsEnabled']);self.assertEqual(set(a.written),s.ALL_SECRETS)
  self.assertEqual(sum(c[0]=='PROBE' for c in a.calls),1)
  for secret in a.written.values():
   self.assertNotIn(secret,str(result));self.assertNotIn(secret,str(progress))
 def test_14_write_failure_disables_own_logins(self):
  a=FakeApi();a.fail_write=True
  with self.assertRaisesRegex(s.SetupError,'partial-setup'):self.run_fake(a)
  self.assertIn('NOLOGIN',a.calls[-1][2]);self.assertNotIn('CREATE ROLE',a.calls[-1][2])
  self.assertEqual(sum(c[0]=='POST' and c[1]=='/secrets' for c in a.calls),1)
 def test_15_probe_failure_never_claims_success(self):
  a=FakeApi();a.fail_probe=True
  with self.assertRaisesRegex(s.SetupError,'verification-pending'):self.run_fake(a)
  self.assertEqual(sum(c[0]=='PROBE' for c in a.calls),6);self.assertIn('NOLOGIN',a.calls[-1][2])
 def test_16_bad_probe_flags_rejected(self):
  for field,value in [('paymentsEnabled',True),('restoreAuthorized',True),('credentialsVerified',False),('projectRef','other'),('policyDisabled',False),('checkedRoles',[])]:
   r={**OK,field:value};self.assertFalse(s.successful_probe(r),field)
 def test_17_concurrent_secret_appearance_not_overwritten(self):
  a=FakeApi();a.conflict_after_create=True
  with self.assertRaisesRegex(s.SetupError,'secret-conflict'):self.run_fake(a)
  self.assertFalse(a.written);self.assertIn('NOLOGIN',a.calls[-1][2])
 def test_18_secret_values_not_extracted(self):
  self.assertEqual(s.secret_names([{'name':'A','value':'not-readable'}]),{'A'})
 def test_19_path_allowlist_rejects_external_or_other_project(self):
  a=s.Api('sbp_'+'x'*40)
  for path in ('https://evil.example','/../../other','/config/auth','/functions','/database/password'):
   with self.assertRaisesRegex(s.SetupError,'unexpected-response'):a.request('POST',path,{})
  a.clear();self.assertEqual(a._token,'')
 def test_20_redirects_refused(self):
  with self.assertRaisesRegex(s.SetupError,'redirect-refused'):s.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.example')
 def test_21_plaintext_keys_and_cli_flags_not_accepted_as_token(self):
  for token in ('','sb_secret_example','secret with spaces','0x'+'1'*64):
   with self.assertRaisesRegex(s.SetupError,'token-required'):s.Api(token)
 def test_22_unexpected_errors_redacted(self):
  a=FakeApi()
  def broken(*a,**kw):raise RuntimeError('SENSITIVE VALUE')
  a.probe=broken
  with self.assertRaises(s.SetupError) as ctx:self.run_fake(a)
  self.assertNotIn('SENSITIVE',str(ctx.exception));self.assertEqual(str(ctx.exception),'partial-setup')
 def test_23_invalid_password_or_batch_rejected(self):
  with self.assertRaises(s.SetupError):s.scram_verifier("not'valid")
  with self.assertRaises(ValueError):s.switch_logins_sql("x'; DROP ROLE postgres; --",False)
 def test_24_json_request_and_bearer_are_only_sent_to_fixed_api(self):
  a=s.Api('sbp_'+'x'*40)
  with patch.object(a,'_request',return_value=[]) as call:
   a.request('GET','/secrets')
   self.assertEqual(call.call_args.args[0],s.API_ROOT+s.PREFIX+'/secrets')
   self.assertEqual(call.call_args.args[-1],'sbp_'+'x'*40)
if __name__=='__main__':unittest.main(verbosity=2)
