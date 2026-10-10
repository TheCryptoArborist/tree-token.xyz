"""Offline, no-secret tests of existing-role recovery orchestration."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import tree_runtime_setup as setup
import recover_existing as recovery
from test_recovery_audit import MockApi, role_rows

class RecoveryTests(unittest.TestCase):
    def test_decline_never_writes(self):
        api=MockApi()
        with self.assertRaises(setup.SetupError) as e:
            recovery.run_recovery(api,lambda _:False,lambda _:None)
        self.assertEqual(str(e.exception),'cancelled')
        self.assertFalse(any(c[0]=='request' and c[1]=='POST' for c in api.calls))
    def test_rejects_unknown_tag(self):
        passwords={m:'A'*48 for m in setup.MODES}
        with self.assertRaises(setup.SetupError):
            recovery.rotation_sql(passwords,'TREE_RUNTIME_SETUP_V1:invalid')
    def test_rotation_sql_does_not_contain_plaintext_passwords(self):
        passwords={m:chr(65+i)*48 for i,m in enumerate(setup.MODES)}
        tag='TREE_RUNTIME_SETUP_V1:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
        sql=recovery.rotation_sql(passwords,tag)
        self.assertEqual(sql.count('ALTER ROLE'),5)
        self.assertEqual(sql.count('SCRAM-SHA-256$'),5)
        self.assertTrue(all(p not in sql for p in passwords.values()))
        self.assertIn('NOT rolcanlogin',sql)
    def test_enable_only_tagged_roles(self):
        tag='TREE_RUNTIME_SETUP_V1:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
        sql=recovery.set_login_sql(tag,True)
        self.assertIn('shobj_description',sql)
        self.assertIn('LOGIN',sql)
        self.assertNotIn('PASSWORD',sql)
    def test_preflight_rejects_enabled_role_before_any_write(self):
        rows=role_rows();rows[0]['rolcanlogin']=True
        api=MockApi(roles=rows)
        with self.assertRaises(setup.SetupError):
            recovery.run_recovery(api,lambda _:True,lambda _:None)
        self.assertFalse(any(c[0]=='request' and c[1]=='POST' for c in api.calls))
if __name__=='__main__':unittest.main()
