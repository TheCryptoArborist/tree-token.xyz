import { AsyncLocalStorage } from 'node:async_hooks';
/** Pool is an injected server-only PostgreSQL pool. All values are parameters.
 * No connection string, schema migration or user-account import occurs here.
 */
export function postgresDirectRepository(pool) {
  const transactions = new AsyncLocalStorage();
  const active = () => { const t = transactions.getStore(); if (!t) throw Error('transaction-required'); return t; };
  return {
    async transact(accountId, runId, action) {
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query("SET LOCAL statement_timeout='15s'");
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [accountId + ':' + runId]);
        const { rows } = await db.query('SELECT terms,state,envelope,evidence,receipt_id FROM tree_continue_v1.orders WHERE account_id=$1::uuid AND run_id=$2::uuid FOR UPDATE', [accountId, runId]);
        const row = rows[0];
        const result = await transactions.run({ db, accountId, runId }, () => action(row ? {
          terms: row.terms, state: row.state, envelope: row.envelope, evidence: row.evidence, receiptId: row.receipt_id,
        } : null));
        await db.query('COMMIT'); return result;
      } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
      finally { db.release(); }
    },
    async save(record) {
      const { db, accountId, runId } = active();
      if (record.terms.accountId !== accountId || record.terms.runId !== runId) throw Error('transaction-owner-mismatch');
      await db.query(`INSERT INTO tree_continue_v1.orders(account_id,run_id,order_id,terms,state,envelope,evidence,receipt_id)
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5,$6::jsonb,$7::jsonb,$8)
        ON CONFLICT(account_id,run_id) DO UPDATE SET order_id=EXCLUDED.order_id,terms=EXCLUDED.terms,state=EXCLUDED.state,envelope=EXCLUDED.envelope,
          evidence=EXCLUDED.evidence,receipt_id=EXCLUDED.receipt_id`,
      [accountId, runId, record.terms.orderId, JSON.stringify(record.terms), record.state,
        record.envelope && JSON.stringify(record.envelope), record.evidence && JSON.stringify(record.evidence), record.receiptId]);
    },
    async claimReceipt(receiptId, orderId) {
      const { db } = active();
      await db.query('INSERT INTO tree_continue_v1.receipts(receipt_id,order_id) VALUES($1,$2::uuid) ON CONFLICT(receipt_id) DO NOTHING', [receiptId, orderId]);
      const { rows } = await db.query('SELECT order_id FROM tree_continue_v1.receipts WHERE receipt_id=$1', [receiptId]);
      if (rows[0]?.order_id !== orderId) throw Error('receipt-already-used');
    },
  };
}
