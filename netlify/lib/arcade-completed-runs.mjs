import {createHash} from 'node:crypto';
export const GAME_IDS=Object.freeze(['treeforce89','canopy-breaker','garden-bot','pvp']);
export const ORIGINS=Object.freeze(['https://tree-token.xyz','https://www.tree-token.xyz']);
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const playerId=wallet=>hash('tree-arcade-weekly:'+wallet.toLowerCase());
export function normalizeBreakerReceipt(entry,wallet,now=Date.now()){
 if(entry?.playerId!==playerId(wallet))return null;
 if(!/^[a-f0-9]{32}$/.test(entry.id)||!['won','gameover'].includes(entry.outcome)||!Number.isSafeInteger(entry.completedAt)||entry.completedAt>now||entry.completedAt<now-48*3600000||!Number.isSafeInteger(entry.score)||entry.score<0||!Number.isInteger(entry.level)||entry.level<1||entry.level>30)throw Error('Invalid saved Canopy Breaker result');
 return {gameId:'canopy-breaker',sourceRunKey:hash('canopy-breaker:'+entry.id),completedAt:new Date(entry.completedAt).toISOString(),score:entry.score,stage:entry.level,outcome:entry.outcome,evidenceKind:'server-completed-run'};
}
export function normalizeTreeforceReceipt(row,wallet,now=Date.now()){
 if(row?.wallet!==wallet||!/^grove-[a-f0-9]{32}$/.test(row.run_id)||row.stats?.ranked!==true||!Number.isSafeInteger(row.score)||row.score<0||row.stats.score!==row.score||!Number.isInteger(row.stats.wave)||row.stats.wave<0||row.stats.wave>9)throw Error('Invalid saved Tree Force result');
 const at=new Date(row.updated_at).getTime();if(!Number.isFinite(at)||at>now||at<now-48*3600000)throw Error('Invalid saved Tree Force time');
 return {gameId:'treeforce89',sourceRunKey:hash('treeforce89:'+wallet+':'+row.run_id),completedAt:new Date(at).toISOString(),score:row.score,stage:row.stats.wave+1,outcome:row.stats.cleared===true?'won':'gameover',evidenceKind:'saved-client-result'};
}
export async function readBreakerReceipts(fetchImpl,wallet,now=Date.now()){
 let cursor={at:now-48*3600000,key:''};const receipts=[],seen=new Set();
 for(let page=0;page<10;page++){
  const url=new URL('https://tree-token.xyz/play/canopy-breaker/api/completions');url.searchParams.set('after',String(cursor.at));url.searchParams.set('key',cursor.key);
  const response=await fetchImpl(url.href,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Canopy Breaker results unavailable');
  const data=await response.json();if(!Array.isArray(data.entries)||data.entries.length>100||typeof data.hasMore!=='boolean')throw Error('Invalid completion feed');
  for(const entry of data.entries){const receipt=normalizeBreakerReceipt(entry,wallet,now);if(receipt&&!seen.has(receipt.sourceRunKey)){seen.add(receipt.sourceRunKey);receipts.push(receipt);}}
  if(!data.hasMore)return receipts;
  const next=data.cursor;if(!next||!Number.isSafeInteger(next.at)||! /^[a-f0-9]{32}$/.test(next.key)||next.at<cursor.at||(next.at===cursor.at&&next.key<=cursor.key))throw Error('Completion feed did not advance');cursor=next;
 }
 throw Error('Completion feed is too busy; retry shortly');
}
export async function readTreeforceReceipts(pool,wallet,now=Date.now()){
 const db=await pool.connect();try{
  await db.query('BEGIN READ ONLY');
  const {rows}=await db.query(`SELECT r.wallet,r.run_id,r.score,r.stats,r.updated_at FROM treeforce89_pilot_runs r
    WHERE r.wallet=$1 AND r.updated_at >= $2::timestamptz AND (r.stats->>'ranked')='true'
    AND EXISTS(SELECT 1 FROM tree_game_sessions s WHERE s.wallet=r.wallet AND s.run_id=r.run_id)
    ORDER BY r.updated_at DESC LIMIT 100`,[wallet,new Date(now-48*3600000).toISOString()]);
  const receipts=rows.map(row=>normalizeTreeforceReceipt(row,wallet,now));await db.query('COMMIT');return receipts;
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
}
export function validateCompletionResponse(data,wallet,dateKey){
 if(data?.wallet!==wallet||data.dateKey!==dateKey||!Array.isArray(data.runs)||data.runs.length>400)throw Error('Saved run progress could not be verified');
 const seen=new Set();for(const run of data.runs){if(!GAME_IDS.includes(run.gameId)||! /^[a-f0-9]{64}$/.test(run.id)||seen.has(run.id)||!Number.isFinite(Date.parse(run.completedAt))||run.completedAt.slice(0,10)!==dateKey||!(run.score===null||Number.isSafeInteger(run.score)&&run.score>=0)||!['completed','won','gameover'].includes(run.outcome))throw Error('Invalid saved run');seen.add(run.id);}return data;
}
