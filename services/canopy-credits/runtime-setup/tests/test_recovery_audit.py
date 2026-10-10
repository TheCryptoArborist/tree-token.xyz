"""Offline tests for recovery_preflight.audit; no network or production writes."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import tree_runtime_setup as setup
import recovery_preflight as recovery

TAG='TREE_RUNTIME_SETUP_V1:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

def role_rows():
    return [dict(rolname=n,rolcanlogin=False,rolinherit=True,rolsuper=False,
        rolcreatedb=False,rolcreaterole=False,rolreplication=False,
        rolbypassrls=False,rolconnlimit=4,setup_tag=TAG)
        for n in setup.LOGINS.values()]

def memberships():
    return [dict(member=setup.LOGINS[m],parent=setup.GROUPS[m],
        inherit_option=True,set_option=False,admin_option=False)
        for m in setup.MODES]

def policy():
    return [dict(new_orders_enabled=False,settlement_enabled=False,
        auth_origin=setup.AUTH_ORIGIN,environment='release-candidate',
        admin_wallet=setup.ADMIN,pilot_wallet=setup.PILOT,
        deployment_unconfigured=True,total_limit_raw='0',reserved_raw='0')]

def pooler():
    return [dict(database_type='PRIMARY',pool_mode='transaction',
        db_host='aws-1-us-east-2.pooler.supabase.com',db_port=6543,
        db_name='postgres',db_user='postgres.'+setup.PROJECT,
        is_using_scram_auth=True)]

class MockApi:
    def __init__(self, *, project=None, roles=None, member_rows=None,
                 policy_rows=None, secrets=None, pooler_rows=None):
        self.project={'id':setup.PROJECT,'status':'ACTIVE_HEALTHY'} if project is None else project
        self.roles=role_rows() if roles is None else roles
        self.member_rows=memberships() if member_rows is None else member_rows
        self.policy_rows=policy() if policy_rows is None else policy_rows
        self.secrets=[{'name':name} for name in setup.ALL_SECRETS] if secrets is None else secrets
        self.pooler_rows=pooler() if pooler_rows is None else pooler_rows
        self.calls=[]
    def request(self, method, suffix='', body=None):
        self.calls.append(('request',method,suffix,body))
        if method!='GET' or body is not None: raise AssertionError('unexpected write')
        return {'':self.project,'/secrets':self.secrets,
                '/config/database/pooler':self.pooler_rows}[suffix]
    def query(self, sql, read_only=True):
        self.calls.append(('query',read_only,sql))
        if read_only is not True: raise AssertionError('unexpected write')
        return {setup.POLICY_SQL:self.policy_rows,recovery.SQL:self.roles,
                recovery.MEMBERSHIP_SQL:self.member_rows}[sql]

class AuditTests(unittest.TestCase):
    def test_good_preflight_is_read_only(self):
        api=MockApi()
        self.assertIn('Credentials NOT verified',recovery.audit(api))
        self.assertEqual(len(api.calls),6)
        self.assertTrue(all(c[1]=='GET' if c[0]=='request' else c[1] is True for c in api.calls))
    def test_refuses_enabled_login(self):
        rows=role_rows();rows[0]['rolcanlogin']=True
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(roles=rows))
    def test_refuses_mixed_setup_tags(self):
        rows=role_rows();rows[0]['setup_tag']='TREE_RUNTIME_SETUP_V1:other'
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(roles=rows))
    def test_refuses_wrong_membership(self):
        rows=memberships();rows[0]['parent']='postgres'
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(member_rows=rows))
    def test_refuses_set_role_right(self):
        rows=memberships();rows[0]['set_option']=True
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(member_rows=rows))
    def test_refuses_missing_secret(self):
        rows=[{'name':n} for n in list(setup.ALL_SECRETS)[1:]]
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(secrets=rows))
    def test_refuses_enabled_commerce(self):
        rows=policy();rows[0]['new_orders_enabled']=True
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(policy_rows=rows))
    def test_refuses_dedicated_pooler(self):
        rows=pooler();rows[0]['db_host']='db.'+setup.PROJECT+'.supabase.co'
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(pooler_rows=rows))
    def test_refuses_wrong_project(self):
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(project={'id':'wrong','status':'ACTIVE_HEALTHY'}))
    def test_refuses_duplicate_memberships(self):
        rows=memberships();rows.append(rows[0].copy())
        with self.assertRaises(setup.SetupError):recovery.audit(MockApi(member_rows=rows))
if __name__=='__main__':unittest.main()
