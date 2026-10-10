"""Mocked full recovery orchestration tests; NEVER use real credentials or network."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import recover_existing as recovery
import tree_runtime_setup as setup
from test_recovery_audit import MockApi, role_rows, policy

class RecoveryApi(MockApi):
    def __init__(self, fail_at=None, probe_ok=True):
        super().__init__()
        self.fail_at=fail_at
        self.probe_ok=probe_ok
        self.writes=[]
        self.probes=0
    def request(self,method,suffix='',body=None):
        if method=='POST' and suffix=='/secrets':
            self.writes.append('secrets')
            if self.fail_at=='secrets':raise setup.SetupError('network-error')
            assert set(item['name'] for item in body)==setup.ALL_SECRETS
            return []
        return super().request(method,suffix,body)
    def query(self,sql,read_only=True):
        if not read_only:
            kind='rotate' if ' PASSWORD ' in sql else ('disable' if 'NOLOGIN' in sql else 'enable')
            self.writes.append(kind)
            if self.fail_at==kind:raise setup.SetupError('network-error')
            return [{'updated':True}]
        return super().query(sql,read_only)
    def probe(self,token):
        self.probes+=1
        if self.fail_at=='probe':raise setup.SetupError('network-error')
        if not self.probe_ok:return {'credentialsVerified':False}
        return dict(protocol='tree-runtime-check.v1',projectRef=setup.PROJECT,
                    credentialsVerified=True,paymentsEnabled=False,restoreAuthorized=False,
                    policyDisabled=True,checkedRoles=list(setup.MODES))

class IntegrationTests(unittest.TestCase):
    def run_once(self,api):
        return recovery.run_recovery(api,lambda _:True,lambda _:None,sleeper=lambda _:None)
    def test_successful_sequence(self):
        api=RecoveryApi()
        self.assertIn('VERIFIED',self.run_once(api))
        self.assertEqual(api.writes,['rotate','secrets','enable'])
        self.assertEqual(api.probes,1)
    def test_secret_write_failure_disables(self):
        api=RecoveryApi(fail_at='secrets')
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.writes,['rotate','secrets','disable'])
    def test_role_rotation_failure_attempts_disable(self):
        api=RecoveryApi(fail_at='rotate')
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.writes,['rotate','disable'])
    def test_enable_failure_attempts_disable(self):
        api=RecoveryApi(fail_at='enable')
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.writes,['rotate','secrets','enable','disable'])
    def test_failed_hosted_probe_disables(self):
        api=RecoveryApi(probe_ok=False)
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.probes,6)
        self.assertEqual(api.writes,['rotate','secrets','enable','disable'])
    def test_probe_exception_disables(self):
        api=RecoveryApi(fail_at='probe')
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.probes,6)
        self.assertEqual(api.writes,['rotate','secrets','enable','disable'])
    def test_disable_failure_never_claims_success(self):
        api=RecoveryApi(fail_at='disable',probe_ok=False)
        with self.assertRaises(setup.SetupError) as e:self.run_once(api)
        self.assertEqual(str(e.exception),'partial-setup')
        self.assertEqual(api.writes[-1],'disable')
    def test_rollback_reads_role_state_after_disable(self):
        api=RecoveryApi(fail_at='secrets')
        with self.assertRaises(setup.SetupError):self.run_once(api)
        self.assertEqual(api.writes[-1],'disable')
        self.assertTrue(any(call[0]=='query' and call[2]==recovery.ROLES_SQL for call in api.calls))
    def test_uncertain_rollback_state_never_reports_success(self):
        class UncertainApi(RecoveryApi):
            def query(self,sql,read_only=True):
                if read_only and sql==recovery.ROLES_SQL and 'disable' in self.writes:
                    raise setup.SetupError('network-error')
                return super().query(sql,read_only)
        api=UncertainApi(fail_at='secrets')
        with self.assertRaises(setup.SetupError) as ctx:self.run_once(api)
        self.assertEqual(str(ctx.exception),'partial-setup')
    def test_confirmation_declined_never_writes(self):
        api=RecoveryApi()
        with self.assertRaises(setup.SetupError):
            recovery.run_recovery(api,lambda _:False,lambda _:None,sleeper=lambda _:None)
        self.assertEqual(api.writes,[])
if __name__=='__main__':unittest.main()
