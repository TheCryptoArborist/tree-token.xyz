"""Offline recovery preflight; never touches Supabase, roles, or secrets.

Run: python -m unittest discover -s services/canopy-credits/runtime-setup/tests -p test_recovery_preflight.py
"""
import base64
import hashlib
import hmac
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tree_runtime_setup', ROOT / 'tree_runtime_setup.py')
module = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = module
spec.loader.exec_module(module)

class RecoveryPreflight(unittest.TestCase):
    def test_scram_verifier_matches_independent_rfc_construction(self):
        password = 'A' * 48
        salt = bytes(range(16))
        verifier = module.scram_verifier(password, salt=salt, iterations=16384)
        salted = hashlib.pbkdf2_hmac('sha256', password.encode('ascii'), salt, 16384)
        client_key = hmac.new(salted, b'Client Key', hashlib.sha256).digest()
        stored_key = hashlib.sha256(client_key).digest()
        server_key = hmac.new(salted, b'Server Key', hashlib.sha256).digest()
        expected = 'SCRAM-SHA-256$16384:' + base64.b64encode(salt).decode() + '$' + base64.b64encode(stored_key).decode() + ':' + base64.b64encode(server_key).decode()
        self.assertEqual(verifier, expected)

    def test_shared_transaction_pooler_selection(self):
        rows = [{'database_type':'PRIMARY','pool_mode':'transaction','db_host':'aws-1-us-east-2.pooler.supabase.com','db_port':6543,'db_name':'postgres','db_user':'postgres.'+module.PROJECT,'is_using_scram_auth':True}]
        p = module.choose_pooler(rows)
        self.assertEqual((p.host,p.port,p.tenant),('aws-1-us-east-2.pooler.supabase.com',6543,module.PROJECT))

    def test_dedicated_pooler_is_rejected(self):
        rows = [{'database_type':'PRIMARY','pool_mode':'transaction','db_host':'db.'+module.PROJECT+'.supabase.co','db_port':6543,'db_name':'postgres','db_user':'postgres.'+module.PROJECT,'is_using_scram_auth':True}]
        with self.assertRaises(module.SetupError):
            module.choose_pooler(rows)

    def test_recovery_must_not_recreate_existing_accounts(self):
        rows = [{'rolname': name} for name in module.GROUPS.values()] + [{'rolname': next(iter(module.LOGINS.values()))}]
        with self.assertRaises(module.SetupError):
            module.check_roles(rows)

if __name__ == '__main__':
    unittest.main()
