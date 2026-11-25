import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';import {gameFacts} from '../netlify/grove-functions/records.mjs';
const db=new PGlite();await db.exec('create schema private; create role anon; create role authenticated; create role service_role;');await db.exec(await fs.readFile('supabase/migrations/20261125064318_grove_chess_rooms.sql','utf8'));await db.exec(await fs.readFile('supabase/migrations/20261125181009_grove_chess_records.sql','utf8'));
const a='a'.repeat(64),b='b'.repeat(64),id='12345678-1234-4123-8123-123456789012',pgn='1. f3 e5 2. g4 Qh4#';
const call=async args=>{const keys=Object.keys(args);return (await db.query('select public.grove_chess_records_v1('+keys.map((k,i)=>k+'=>$'+(i+1)).join(',')+') as data',Object.values(args))).rows[0].data;};
test('chess accomplishments are derived from legal recorded moves',()=>{
 const mate=gameFacts({pgn,result:'Pine wins by checkmate.'});assert(mate.eligible&&mate.b.win&&mate.b.mate&&!mate.w.win);
 assert(gameFacts({pgn:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O Be7',result:'Birch wins by resignation.'}).w.castleWin);
 assert(gameFacts({pgn:'1. e4 a6 2. e5 d5 3. exd6 cxd6',result:'Pine wins by resignation.'}).w.enPassant);
 const promo=gameFacts({pgn:'[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N',result:'A peaceful draw.'});assert(promo.w.promotion&&promo.w.underpromotion);assert(!promo.eligible);
 assert(!gameFacts({pgn:'',result:'Birch wins by resignation.'}).eligible);assert.throws(()=>gameFacts({pgn:'1. e4 e5',result:'Birch wins by checkmate.'}));
});
test('records bind to completed room revision and PGN and count once',async()=>{
 await db.query('insert into private.grove_chess_players(id) values($1),($2)',[a,b]);await db.query("insert into private.grove_chess_rooms(id,white_id,black_id,pgn,revision,status,result) values($1,$2,$3,$4,5,'finished','Pine wins by checkmate.')",[id,a,b,pgn]);
 const pending=await call({p_action:'pending'});assert.equal(pending.length,1);
 const args={p_action:'record',p_room:id,p_revision:5,p_pgn:pgn,p_facts:gameFacts({pgn,result:'Pine wins by checkmate.'})};await assert.rejects(call({...args,p_revision:4}),/invalid-record/);await assert.rejects(call({...args,p_pgn:'1. e4'}),/invalid-record/);await call(args);await call(args);assert.equal((await call({p_action:'pending'})).length,0);
 const board=await call({p_action:'read',p_actor:b});assert.equal(board.me.wins,1);assert.equal(board.me.mates,1);assert.equal(board.me.games,1);assert.equal(board.leaderboard.length,2);assert.equal(board.leaderboard[0].rank,1);assert(!JSON.stringify(board).includes(b));assert.equal((await call({p_action:'read',p_actor:a})).me.losses,1);
});
test('public roles cannot write awards or read the private record source',async()=>{for(const role of ['anon','authenticated']){const r=await db.query("select has_function_privilege($1,'public.grove_chess_records_v1(text,text,text,uuid,integer,text,jsonb)','execute') as allowed,has_table_privilege($1,'private.grove_chess_records','insert') as writable",[role]);assert.equal(r.rows[0].allowed,false);assert.equal(r.rows[0].writable,false);}});
