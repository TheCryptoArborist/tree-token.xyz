"""Schema tests on the same disposable loopback database as the ledger suite."""
import unittest
from pathlib import Path
from postgres_test import query, literal, jb, uid
ROOT=Path(__file__).resolve().parents[1]
class DirectSchemaTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls): query((ROOT/'direct-continue-schema.sql').read_text())
 def setUp(self):
  self.a,self.r,self.o=uid(),uid(),uid()
  self.t=dict(kind='direct-continue',product='treeforce89.continue.v1',requiredRaw='20000000000',network='sui:mainnet',recipient='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f',accountId=self.a,runId=self.r,orderId=self.o)
 def insert(self,terms=None,fail=False):
  return query(f"INSERT INTO tree_continue_v1.orders(account_id,run_id,order_id,terms,state) VALUES({literal(self.a)},{literal(self.r)},{literal(self.o)},{jb(self.t if terms is None else terms)},'ordered')",fail=fail)
 def paid(self):
  receipt='sui:mainnet:'+uid()+':0'
  query(f"BEGIN;INSERT INTO tree_continue_v1.receipts VALUES({literal(receipt)},{literal(self.o)});UPDATE tree_continue_v1.orders SET state='verified',receipt_id={literal(receipt)},evidence='{{\"fixture\":true}}' WHERE order_id={literal(self.o)};COMMIT;")
  return receipt
 def test_fixed_price_and_null_guard(self):
  for value in ['1',None,'20000']:
   self.assertIn('check constraint',self.insert({**self.t,'requiredRaw':value},True))
  missing=dict(self.t);del missing['requiredRaw'];self.assertIn('check constraint',self.insert(missing,True))
 def test_exact_destination(self):
  self.assertIn('check constraint',self.insert({**self.t,'recipient':'0x'+'2'*64},True))
 def test_identity_binding(self):
  self.assertIn('check constraint',self.insert({**self.t,'accountId':uid()},True))
 def test_one_order_per_flight(self):
  self.insert();self.assertIn('duplicate',self.insert(fail=True))
 def test_immutable_order(self):
  self.insert();self.assertIn('immutable',query(f"UPDATE tree_continue_v1.orders SET terms=terms||'{{\"extra\":1}}' WHERE order_id={literal(self.o)}",fail=True))
 def test_late_cancelled_payment_can_settle(self):
  self.insert();query(f"UPDATE tree_continue_v1.orders SET state='cancelled' WHERE order_id={literal(self.o)}");self.paid()
  self.assertEqual(query(f"SELECT state FROM tree_continue_v1.orders WHERE order_id={literal(self.o)}"),'verified')
 def test_paid_delivery_and_audit_once(self):
  self.insert();self.paid()
  for _ in range(2):query(f"UPDATE tree_continue_v1.orders SET state='delivered' WHERE order_id={literal(self.o)}")
  self.assertEqual(query(f"SELECT count(*) FROM tree_continue_v1.journal WHERE order_id={literal(self.o)} AND state='delivered'"),'1')
 def test_unpaid_cannot_deliver(self):
  self.insert();self.assertIn('invalid_transition',query(f"UPDATE tree_continue_v1.orders SET state='delivered' WHERE order_id={literal(self.o)}",fail=True))
 def test_receipt_claim_required(self):
  self.insert();self.assertIn('foreign key',query(f"UPDATE tree_continue_v1.orders SET state='verified',receipt_id='missing',evidence='{{}}' WHERE order_id={literal(self.o)}",fail=True))
 def test_history_and_claims_not_deletable(self):
  self.insert();self.paid()
  for table in ['orders','receipts','journal']:
   self.assertIn('immutable',query(f"DELETE FROM tree_continue_v1.{table} WHERE order_id={literal(self.o)}",fail=True))
 def test_cannot_truncate_history(self):
  self.assertIn('immutable',query('TRUNCATE tree_continue_v1.journal',fail=True))
 def test_public_permissions_are_empty(self):
  self.assertEqual(query("SELECT has_schema_privilege('canopy_cc_browser','tree_continue_v1','USAGE')"),'f')
if __name__=='__main__':unittest.main(verbosity=2)
