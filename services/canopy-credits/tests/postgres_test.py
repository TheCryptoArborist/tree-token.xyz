"""Integration tests against a DISPOSABLE local PostgreSQL instance only.
No Supabase credentials, remote database URL or user account data are used.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
ENV = {**os.environ, 'PGHOST': os.environ.get('PGHOST', '127.0.0.1'),
       'PGDATABASE': os.environ.get('PGDATABASE', 'canopy_ci')}
if ENV['PGHOST'] not in ('127.0.0.1', 'localhost', '::1') or ENV['PGDATABASE'] != 'canopy_ci':
    raise RuntimeError('Refusing to run: only a disposable loopback canopy_ci database is allowed')

def uid(): return str(uuid.uuid4())
def literal(x): return "'" + str(x).replace("'", "''") + "'"
def jb(x): return literal(json.dumps(x, separators=(',', ':'))) + '::jsonb'
def query(sql, role=None, fail=False):
    text = ('BEGIN; SET LOCAL ROLE ' + role + '; ' + sql + '; COMMIT;') if role else sql
    r = subprocess.run(['psql', '--no-psqlrc', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                       input=text, text=True, capture_output=True, env=ENV, timeout=30)
    if fail:
        if r.returncode == 0: raise AssertionError('Statement unexpectedly succeeded: ' + sql)
        return r.stderr
    if r.returncode: raise AssertionError(r.stderr)
    lines = [x for x in r.stdout.splitlines() if x.strip()]
    return json.loads(lines[-1]) if lines and lines[-1][0] in '{[' else (lines[-1] if lines else None)

def execute(account, cmd, request=None, fail=False):
    return query(f'SELECT canopy_credits_v1.execute({literal(account)},{literal(request or uid())},{jb(cmd)})', 'canopy_cc_runtime', fail)
def balance(account): return query(f'SELECT canopy_credits_v1.balance({literal(account)})', 'canopy_cc_runtime')
def record(account, terms, fail=False):
    return query(f'SELECT canopy_credits_v1.record_order({literal(terms["orderId"])},{literal(account)},{jb(terms)})','canopy_cc_ingest',fail)
def credit(account, terms, evidence, request=None, fail=False, role='canopy_cc_ingest'):
    return query(f'SELECT canopy_credits_v1.credit_receipt({literal(account)},{literal(request or uid())},{literal(terms["orderId"])},{jb(evidence)})',role,fail)

def order(account, base='1000', bonus='100', digest=None):
    # Deliberately fictional evidence fixture, not a real blockchain transaction.
    terms = dict(orderId=uid(), accountId=account, network='sui:mainnet',
        coinType='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
        payer='0x'+'1'*64, recipient='0x'+'2'*64, eventType='0x'+'3'*64+'::checkout::Purchase',
        quoteHash='a'*64, policyVersion='UNIT-TEST-ONLY', baseCC=base, bonusCC=bonus,
        requiredRaw='1000', issuedAtMs=1800000000000, expiresAtMs=1800000045000)
    # UUID hex mapped into valid Base58 characters, deterministic length only for SQL fixture checks.
    dg = digest or (uid().replace('-','').replace('0','G')+'A'*11)
    ev = dict(source='chain-reader',status='success',finalized=True,checkpoint='100',digest=dg,eventIndex='0',
              timestampMs=1800000001000,evidenceHash='b'*64,amountRaw=terms['requiredRaw'])
    for key in ('network','coinType','orderId','accountId','payer','recipient','eventType','quoteHash'): ev[key]=terms[key]
    return terms, ev

def funded(account, base='1000', bonus='100'):
    t,e=order(account,base,bonus);record(account,t);credit(account,t,e);return t,e

def reserve(account):
    run=uid();execute(account,dict(action='open_run',runId=run,ruleset='isolated-test'))
    result=execute(account,dict(action='reserve',runId=run,sku='treeforce89.continue.v1'))
    return run,result['reservationId']

def state_action(account, rid, action, **extra):
    return execute(account,dict(action=action,reservationId=rid,**extra))

class LedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print('Database version:', query('SELECT version()'))
        query(ROOT.joinpath('schema.sql').read_text())
        # Admin-only fixture switch in this empty, disposable database.
        query("UPDATE canopy_credits_v1.skus SET enabled=true WHERE id='treeforce89.continue.v1'")
        query('CREATE ROLE canopy_cc_browser NOLOGIN')

    def setUp(self):
        self.account=uid()
        query(f'SELECT canopy_credits_v1.register_account({literal(self.account)})','canopy_cc_ingest')

    def test_01_new_balance_zero_no_import(self):
        self.assertEqual(balance(self.account),dict(available='0',held='0',spent='0',issued='0'))

    def test_02_credit_issue_and_duplicate(self):
        t,e=order(self.account);record(self.account,t);request=uid()
        one=credit(self.account,t,e,request);two=credit(self.account,t,e,request)
        self.assertEqual(one,two)
        for _ in range(8): credit(self.account,t,e)
        self.assertEqual(balance(self.account)['issued'],'1100')

    def test_03_receipt_global_uniqueness(self):
        t,e=funded(self.account);b=uid();query(f'SELECT canopy_credits_v1.register_account({literal(b)})','canopy_cc_ingest')
        t2,e2=order(b,digest=e['digest']);record(b,t2)
        self.assertIn('duplicate',credit(b,t2,e2,fail=True))
        self.assertEqual(balance(b)['issued'],'0')

    def test_04_idempotency_changed_payload(self):
        request=uid();cmd=dict(action='open_run',runId=uid(),ruleset='fixture')
        execute(self.account,cmd,request);cmd['runId']=uid()
        self.assertIn('idempotency_conflict',execute(self.account,cmd,request,True))

    def test_05_reserve_commit_deliver(self):
        funded(self.account);run,r=reserve(self.account)
        self.assertEqual(balance(self.account),dict(available='1000',held='100',spent='0',issued='1100'))
        state_action(self.account,r,'commit',checkpointRef='c'*64)
        state_action(self.account,r,'deliver',checkpointRef='c'*64)
        self.assertEqual(balance(self.account),dict(available='1000',held='0',spent='100',issued='1100'))
        state_action(self.account,r,'deliver',checkpointRef='c'*64)
        self.assertEqual(balance(self.account)['spent'],'100')

    def test_06_precommit_release(self):
        funded(self.account);_,r=reserve(self.account)
        state_action(self.account,r,'release');state_action(self.account,r,'release')
        self.assertEqual(balance(self.account)['available'],'1100')
        self.assertEqual(balance(self.account)['spent'],'0')

    def test_07_postcommit_refund_append_only(self):
        funded(self.account);_,r=reserve(self.account);state_action(self.account,r,'commit',checkpointRef='c'*64)
        state_action(self.account,r,'release')
        self.assertEqual(balance(self.account)['available'],'1100')
        rows=query(f"SELECT json_agg(kind ORDER BY created_at) FROM canopy_credits_v1.journal WHERE account_id={literal(self.account)}")
        self.assertIn('commit',rows);self.assertIn('refunded',rows)
        self.assertEqual(query(f"SELECT count(*) FROM canopy_credits_v1.journal WHERE account_id={literal(self.account)} AND kind='refunded' AND reverses IS NOT NULL"),'1')

    def test_08_timeout_recovery_no_paid_delivery(self):
        funded(self.account);run,r=reserve(self.account);state_action(self.account,r,'commit',checkpointRef='c'*64)
        query(f"UPDATE canopy_credits_v1.reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id={literal(r)}")
        recovery=execute(self.account,dict(action='recover',runId=run))
        self.assertEqual(recovery['reservation']['state'],'refunded')
        self.assertEqual(recovery['balance']['available'],'1100')

    def test_09_delivered_not_silently_refunded(self):
        funded(self.account);run,r=reserve(self.account);state_action(self.account,r,'commit',checkpointRef='c'*64);state_action(self.account,r,'deliver',checkpointRef='c'*64)
        query(f"UPDATE canopy_credits_v1.reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id={literal(r)}")
        recovery=execute(self.account,dict(action='recover',runId=run))
        self.assertTrue(recovery['reservation']['requiresReview'])
        self.assertEqual(recovery['reservation']['checkpointRef'],'c'*64)
        self.assertEqual(balance(self.account)['spent'],'100')
        self.assertIn('requires_review',execute(self.account,dict(action='release',reservationId=r),fail=True))

    def test_10_no_overdraft_under_concurrency(self):
        funded(self.account);runs=[uid() for _ in range(12)]
        for r in runs: execute(self.account,dict(action='open_run',runId=r,ruleset='fixture'))
        def buy(r):
            try: execute(self.account,dict(action='reserve',runId=r,sku='treeforce89.continue.v1'));return True
            except AssertionError as err:
                if 'insufficient_credits' not in str(err): raise
                return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: outcomes=list(pool.map(buy,runs))
        self.assertEqual(sum(outcomes),11)
        self.assertEqual(balance(self.account),dict(available='0',held='1100',spent='0',issued='1100'))

    def test_11_duplicate_parallel_credit_once(self):
        t,e=order(self.account);record(self.account,t)
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            list(pool.map(lambda _:credit(self.account,t,e),range(10)))
        self.assertEqual(balance(self.account)['issued'],'1100')

    def test_12_fifo_and_bonus_provenance(self):
        funded(self.account)
        for _ in range(11): reserve(self.account)
        rows=query(f"SELECT json_agg(x) FROM (SELECT l.origin,sum(p.held)::text held FROM canopy_credits_v1.lots l JOIN canopy_credits_v1.postings p ON p.lot_id=l.id WHERE l.account_id={literal(self.account)} GROUP BY l.origin) x")
        self.assertEqual({r['origin']:r['held'] for r in rows},dict(purchase='1000',tree_bonus='100'))

    def test_13_cross_account_blocked(self):
        funded(self.account);_,r=reserve(self.account)
        other=uid();query(f'SELECT canopy_credits_v1.register_account({literal(other)})','canopy_cc_ingest')
        self.assertIn('not_found',execute(other,dict(action='release',reservationId=r),fail=True))

    def test_14_runtime_cannot_issue_or_edit(self):
        t,e=order(self.account);record(self.account,t)
        self.assertIn('permission denied',credit(self.account,t,e,role='canopy_cc_runtime',fail=True))
        self.assertIn('permission denied',query('SELECT * FROM canopy_credits_v1.journal','canopy_cc_runtime',True))
        self.assertIn('permission denied',query("UPDATE canopy_credits_v1.skus SET enabled=true",'canopy_cc_runtime',True))

    def test_15_browser_has_no_api_or_table_access(self):
        self.assertIn('permission denied',query(f'SELECT canopy_credits_v1.balance({literal(self.account)})','canopy_cc_browser',True))
        self.assertIn('permission denied',query('SELECT * FROM canopy_credits_v1.orders','canopy_cc_browser',True))

    def test_16_immutable_history_cannot_be_rewritten(self):
        funded(self.account)
        self.assertIn('immutable',query(f"UPDATE canopy_credits_v1.journal SET available=0 WHERE account_id={literal(self.account)}",fail=True))
        self.assertIn('immutable',query(f"DELETE FROM canopy_credits_v1.journal WHERE account_id={literal(self.account)}",fail=True))
        self.assertIn('immutable',query('TRUNCATE canopy_credits_v1.postings',fail=True))

    def test_17_journal_requires_matching_postings(self):
        sql=f"INSERT INTO canopy_credits_v1.journal(account_id,request_id,command,kind,available,source,result) VALUES({literal(self.account)},{literal(uid())},'{{}}','bad',1,-1,'{{}}')"
        self.assertIn('posting_mismatch',query(sql,fail=True))
        self.assertEqual(balance(self.account)['issued'],'0')

    def test_18_closed_operations_reject_new_postings(self):
        funded(self.account)
        q=f"INSERT INTO canopy_credits_v1.postings(operation_id,account_id,lot_id) SELECT j.id,j.account_id,l.id FROM canopy_credits_v1.journal j JOIN canopy_credits_v1.lots l ON l.issuance_id=j.id WHERE j.account_id={literal(self.account)} LIMIT 1"
        self.assertIn('operation_closed',query(q,fail=True))

    def test_19_underpayment_wrong_coin_failed_not_final(self):
        t,e=order(self.account);record(self.account,t)
        for patch in [dict(amountRaw='999'),dict(coinType='FAKE'),dict(status='failed'),dict(finalized=False),dict(network='sui:testnet')]:
            self.assertIn('cc_',credit(self.account,t,{**e,**patch},fail=True))
        self.assertEqual(balance(self.account)['issued'],'0')

    def test_20_quote_expiry_uses_chain_time(self):
        t,e=order(self.account);record(self.account,t)
        self.assertIn('outside_window',credit(self.account,t,{**e,'timestampMs':t['expiresAtMs']+1},fail=True))
        credit(self.account,t,e)
        self.assertEqual(balance(self.account)['issued'],'1100')

    def test_21_immutable_order(self):
        t,e=order(self.account);record(self.account,t)
        self.assertIn('order_conflict',record(self.account,{**t,'requiredRaw':'10'},True))

    def test_22_same_run_cannot_double_reserve(self):
        funded(self.account);run,r=reserve(self.account)
        second=execute(self.account,dict(action='reserve',runId=run,sku='treeforce89.continue.v1'))
        self.assertEqual(second['reservationId'],r);self.assertEqual(balance(self.account)['held'],'100')

    def test_23_commit_requires_recovery_checkpoint(self):
        funded(self.account);_,r=reserve(self.account)
        self.assertIn('checkpoint_required',execute(self.account,dict(action='commit',reservationId=r),fail=True))
        self.assertEqual(balance(self.account)['spent'],'0')

    def test_24_disabled_sku_and_unknown_action(self):
        run=uid();execute(self.account,dict(action='open_run',runId=run,ruleset='fixture'))
        self.assertIn('sku_disabled',execute(self.account,dict(action='reserve',runId=run,sku='nonexistent'),fail=True))
        self.assertIn('unknown_action',execute(self.account,dict(action='transfer'),fail=True))

    def test_25_bigint_no_javascript_rounding(self):
        funded(self.account,base='9007199254740993',bonus='0')
        self.assertEqual(balance(self.account)['available'],'9007199254740993')

    def test_26_process_restart_retains_records(self):
        funded(self.account);_,r=reserve(self.account);state_action(self.account,r,'release')
        # Each psql call creates a new process/connection, not an in-memory client cache.
        self.assertEqual(balance(self.account)['available'],'1100')

    def test_27_wrong_checkpoint_cannot_acknowledge_delivery(self):
        funded(self.account);_,r=reserve(self.account);state_action(self.account,r,'commit',checkpointRef='c'*64)
        self.assertIn('checkpoint_mismatch',execute(self.account,dict(action='deliver',reservationId=r,checkpointRef='d'*64),fail=True))

    def test_28_expired_reservation_releases_once(self):
        funded(self.account);run,r=reserve(self.account)
        query(f"UPDATE canopy_credits_v1.reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id={literal(r)}")
        for _ in range(3): execute(self.account,dict(action='recover',runId=run))
        self.assertEqual(balance(self.account)['available'],'1100')
        self.assertEqual(query(f"SELECT count(*) FROM canopy_credits_v1.journal WHERE account_id={literal(self.account)} AND kind='released'"),'1')

if __name__=='__main__': unittest.main(verbosity=2)
