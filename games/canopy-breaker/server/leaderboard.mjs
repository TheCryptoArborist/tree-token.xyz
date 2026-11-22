const fail=(message,status=400)=>Object.assign(Error(message),{status});
const walletPattern=/^0x[0-9a-f]{64}$/;
const runPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const LEADERBOARD_LIMIT=20;

export function normalizeUsername(value){
 if(typeof value!=='string')throw fail('Choose a username with 3–20 letters, numbers, spaces, underscores or hyphens.');
 const username=value.trim().replace(/ +/g,' ');
 if(!/^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/.test(username))throw fail('Choose a username with 3–20 letters, numbers, spaces, underscores or hyphens.');
 return username;
}

// Only the replay service calls this with its already-persisted server state.
// Scores never arrive from a profile or public leaderboard request.
export async function recordBestScore(tx,wallet,run,achievedAt=Date.now()){
 const score=run?.state?.score,level=run?.state?.level;
 if(!walletPattern.test(wallet)||!runPattern.test(run?.id||'')||!Number.isSafeInteger(score)||score<0||!Number.isInteger(level)||level<1||level>30||!Number.isSafeInteger(achievedAt)||achievedAt<0)throw Error('Invalid saved leaderboard score');
 if(score===0)return null;
 const {rows}=await tx.query(`INSERT INTO breaker.leaderboard_scores(wallet,run_id,score,level,achieved_at)
  VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(wallet) DO UPDATE SET run_id=EXCLUDED.run_id,score=EXCLUDED.score,
   level=EXCLUDED.level,achieved_at=EXCLUDED.achieved_at
  WHERE EXCLUDED.score>leaderboard_scores.score
   OR (EXCLUDED.score=leaderboard_scores.score AND EXCLUDED.level>leaderboard_scores.level)
   OR (EXCLUDED.score=leaderboard_scores.score AND EXCLUDED.level=leaderboard_scores.level
    AND EXCLUDED.achieved_at<leaderboard_scores.achieved_at)
  RETURNING score,level,achieved_at`,[wallet,run.id,score,level,achievedAt]);
 return rows[0]??null;
}

async function backfillBestScore(tx,wallet){
 const saved=await tx.query('SELECT id,state,updated_at FROM breaker.runs WHERE wallet=$1',[wallet]);
 const links=await tx.query(`SELECT restart.new_run,invoice.run_id
  FROM breaker.restarts restart
  JOIN breaker.invoices invoice ON invoice.id=restart.invoice_id AND invoice.status='paid'
  JOIN breaker.receipts receipt ON receipt.invoice_id=invoice.id
  JOIN breaker.runs child ON child.id=restart.new_run AND child.wallet=invoice.wallet
  WHERE invoice.wallet=$1`,[wallet]);
 const runs=new Map(saved.rows.map(run=>[run.id,run])),parents=new Map(links.rows.map(link=>[link.new_run,link.run_id])),scores=new Map(),visiting=new Set();
 const validScore=value=>{if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid saved leaderboard score');return value;};
 function effectiveScore(run){
  if(scores.has(run.id))return scores.get(run.id);
  if(visiting.has(run.id))throw Error('Saved restart history is invalid');
  visiting.add(run.id);let score=validScore(run.state.score);
  if(run.state.scoreCarryVersion!==1&&parents.has(run.id)){
   const parent=runs.get(parents.get(run.id));
   if(!parent||parent.state.status!=='gameover'||parent.state.lives!==0)throw Error('Saved restart history is invalid');
   score=validScore(score+effectiveScore(parent));
  }
  visiting.delete(run.id);scores.set(run.id,score);return score;
 }
 let best=null;
 for(const run of saved.rows){
  const candidate={...run,state:{...run.state,score:effectiveScore(run)}};
  if(!best||candidate.state.score>best.state.score||candidate.state.score===best.state.score&&(candidate.state.level>best.state.level||candidate.state.level===best.state.level&&Number(candidate.updated_at)<Number(best.updated_at)))best=candidate;
 }
 if(best)await recordBestScore(tx,wallet,best,Number(best.updated_at));
}

export function createLeaderboardService({database:db,authorize,now=Date.now}){
 async function holder(context){
  const account=await authorize(context);
  if(!walletPattern.test(account?.address||'')||!Number.isFinite(account?.expiresAt)||account.expiresAt<=now())throw fail('Verify your NFTree wallet again',401);
  return account;
 }
 async function accountLock(tx,account){
  if(account.expiresAt<=now())throw fail('NFTree session expired',401);
  await tx.query('INSERT INTO breaker.accounts(wallet) VALUES($1) ON CONFLICT DO NOTHING',[account.address]);
  await tx.query('SELECT wallet FROM breaker.accounts WHERE wallet=$1 FOR UPDATE',[account.address]);
 }
 return Object.freeze({
  async leaderboard(){
   const {rows}=await db.query(`SELECT profile.username,score.score,score.level
    FROM breaker.leaderboard_scores score
    JOIN breaker.player_profiles profile ON profile.wallet=score.wallet
    ORDER BY score.score DESC,score.level DESC,score.achieved_at ASC,score.wallet ASC
    LIMIT $1`,[LEADERBOARD_LIMIT]);
   const entries=rows.map((row,index)=>{
    const score=Number(row.score),level=Number(row.level);
    if(!Number.isSafeInteger(score)||score<=0||!Number.isInteger(level)||level<1||level>30)throw Error('Invalid stored leaderboard result');
    return {rank:index+1,username:row.username,score,level};
   });
   return {entries,limit:LEADERBOARD_LIMIT,updatedAt:now()};
  },
  async profile(context){
   const account=await holder(context);
   const {rows}=await db.query('SELECT username FROM breaker.player_profiles WHERE wallet=$1',[account.address]);
   if(account.expiresAt<=now())throw fail('NFTree session expired',401);
   return {username:rows[0]?.username??null};
  },
  async setUsername(context,{username:input}={}){
   const account=await holder(context),username=normalizeUsername(input);
   try{
    return await db.transaction(async tx=>{
     await accountLock(tx,account);
     // Enrollment also recovers the wallet's best already-saved score. New
     // replay checkpoints keep that same single best-score row up to date.
     await backfillBestScore(tx,account.address);
     await tx.query(`INSERT INTO breaker.player_profiles(wallet,username,updated_at) VALUES($1,$2,$3)
      ON CONFLICT(wallet) DO UPDATE SET username=EXCLUDED.username,updated_at=EXCLUDED.updated_at`,[account.address,username,now()]);
     if(account.expiresAt<=now())throw fail('NFTree session expired',401);
     return {username};
    });
   }catch(error){
    if(error?.code==='23505'&&error.constraint==='breaker_profile_username_lower_key')throw fail('That username is already taken. Choose another.',409);
    throw error;
   }
  },
 });
}
