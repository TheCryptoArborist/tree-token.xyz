// Server-side catalog inspection only. This does not prove hosted isolation,
// construct a connection, apply migrations, or enable a public handler.
const tables = {
  tree_wallet_challenges: {
    challenge_hash:['character',64,false], wallet:['text',null,false],
    message:['text',null,false], expires_at:['timestamp with time zone',null,false],
    created_at:['timestamp with time zone',null,false],
  },
  tree_wallet_logins: {
    token_hash:['character',64,false], wallet:['text',null,false],
    expires_at:['timestamp with time zone',null,false],
    revoked_at:['timestamp with time zone',null,true],
    created_at:['timestamp with time zone',null,false],
  },
  tree_game_sessions: {
    session_id:['text',null,false], wallet:['text',null,false],
    session_token_hash:['character',64,true],
    expires_at:['timestamp with time zone',null,false], run_id:['text',null,false],
    wave:['integer',null,false], continuation_number:['integer',null,false],
    game_over:['boolean',null,false], cleared:['boolean',null,false],
    continue_pending:['boolean',null,false], created_at:['timestamp with time zone',null,false],
  },
  tree_continue_redemptions: {
    digest:['text',null,false], session_id:['text',null,false],
    continuation_number:['integer',null,false], wallet:['text',null,false],
    run_id:['text',null,false], redeemed_at:['timestamp with time zone',null,false],
  },
};

export async function inspectTreeForceSchema(pool) {
  const db = await pool.connect();
  let begun=false;
  try {
    await db.query('BEGIN TRANSACTION READ ONLY'); begun=true;
    const names=Object.keys(tables);
    const {rows:columns}=await db.query(`SELECT table_name,column_name,data_type,
      character_maximum_length,is_nullable,column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[])`,[names]);
    const columnChecks={};
    for(const [table,expected] of Object.entries(tables)) {
      for(const [name,[type,length,nullable]] of Object.entries(expected)) {
        const column=columns.find(c=>c.table_name===table&&c.column_name===name);
        columnChecks[table+'.'+name]=!!column && column.data_type===type &&
          column.character_maximum_length===length &&
          column.is_nullable===(nullable?'YES':'NO');
      }
    }
    const {rows:constraints}=await db.query(`SELECT t.relname AS table_name,
      c.contype AS kind,c.convalidated AS validated,
      array(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
        ORDER BY k.n) AS columns,
      f.relname AS referenced_table, fn.nspname AS referenced_schema,
      array(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum,n)
        JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum
        ORDER BY k.n) AS referenced_columns,
      pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      LEFT JOIN pg_class f ON f.oid=c.confrelid
      LEFT JOIN pg_namespace fn ON fn.oid=f.relnamespace
      WHERE n.nspname='public' AND t.relname=ANY($1::text[])`,[names]);
    const has=(table,kind,keys)=>constraints.some(c=>c.table_name===table&&
      c.kind===kind&&c.validated===true&&JSON.stringify(c.columns)===JSON.stringify(keys));
    const keys={
      challengePrimaryKey:has(names[0],'p',['challenge_hash']),
      loginPrimaryKey:has(names[1],'p',['token_hash']),
      sessionPrimaryKey:has(names[2],'p',['session_id']),
      uniqueSessionToken:has(names[2],'u',['session_token_hash']),
      uniqueRun:has(names[2],'u',['run_id']),
      uniquePaymentDigest:has(names[3],'p',['digest']),
      uniqueContinuation:has(names[3],'u',['session_id','continuation_number']),
      sessionForeignKey:constraints.some(c=>c.table_name===names[3]&&c.kind==='f'&&
        c.validated===true&&JSON.stringify(c.columns)==='["session_id"]'&&
        c.referenced_schema==='public'&&c.referenced_table===names[2]&&
        JSON.stringify(c.referenced_columns)==='["session_id"]'),
    };
    const nonnegative=column=>constraints.some(c=>c.table_name===names[2]&&
      c.kind==='c'&&c.validated===true&&
      c.definition.replace(/[()\s]/g,'')==='CHECK'+column+'>=0');
    const checks={waveNonnegative:nonnegative('wave'),
      continuationNonnegative:nonnegative('continuation_number')};
    const {rows:indexes}=await db.query(`SELECT t.relname AS table_name,
      i.indisvalid,i.indisready,i.indpred IS NULL AS unfiltered,
      array(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum,n)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        ORDER BY k.n) AS columns
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' AND t.relname=ANY($1::text[])`,[names]);
    const walletIndex=table=>indexes.some(i=>i.table_name===table&&i.indisvalid&&
      i.indisready&&i.unfiltered&&JSON.stringify(i.columns)==='["wallet"]');
    const indexChecks={loginWallet:walletIndex(names[1]),sessionWallet:walletIndex(names[2])};
    const defaultIs=(table,column,pattern)=>pattern.test(columns.find(c=>
      c.table_name===table&&c.column_name===column)?.column_default||'');
    const defaults={sessionExpiry:defaultIs(names[2],'expires_at',/now\(\).*02:00:00/),
      wave:defaultIs(names[2],'wave',/^0$/),
      continuation:defaultIs(names[2],'continuation_number',/^0$/),
      gameOver:defaultIs(names[2],'game_over',/^false$/),
      cleared:defaultIs(names[2],'cleared',/^false$/),
      continuePending:defaultIs(names[2],'continue_pending',/^false$/)};
    for(const table of names) defaults[table+'.created']=defaultIs(table,
      table===names[3]?'redeemed_at':'created_at',/^now\(\)$/);
    await db.query('ROLLBACK'); begun=false;
    return {schemaReady:[columnChecks,keys,checks,indexChecks,defaults].every(group=>
      Object.values(group).every(Boolean)),tableCount:names.filter(table=>
        columns.some(c=>c.table_name===table)).length,
      columnChecks,keys,checks,indexChecks,defaults,
      hostedIsolationVerified:false,paymentsEnabled:false};
  } finally {
    if(begun)try{await db.query('ROLLBACK');}catch{}
    db.release();
  }
}
