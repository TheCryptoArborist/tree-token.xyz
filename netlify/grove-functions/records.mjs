import {Chess} from '../../play/grove-chess/vendor/chess.js';
export function gameFacts(room){
 const game=new Chess();game.loadPgn(room.pgn);const moves=game.history({verbose:true});
 const mate=game.isCheckmate(),draw=game.isDraw();let winner=null;
 if(mate)winner=game.turn()==='w'?'b':'w';
 else if(room.result==='Birch wins by resignation.')winner='w';
 else if(room.result==='Pine wins by resignation.')winner='b';
 else if(!draw)throw Error('Unverified game result');
 const facts={eligible:moves.length>=4};
 for(const side of ['w','b']){const own=moves.filter(m=>m.color===side),win=winner===side;facts[side]={win,draw:!winner&&draw,mate:win&&mate,castleWin:win&&own.some(m=>/[kq]/.test(m.flags)),promotion:own.some(m=>m.promotion),underpromotion:own.some(m=>m.promotion&&m.promotion!=='q'),enPassant:own.some(m=>m.flags.includes('e'))};}
 return facts;
}
export async function syncRecords(rpc){
 const pending=await rpc('grove_chess_records_v1',{p_action:'pending'});
 if(!Array.isArray(pending))throw Error('Records unavailable');
 for(const room of pending)await rpc('grove_chess_records_v1',{p_action:'record',p_room:room.id,p_revision:room.revision,p_pgn:room.pgn,p_facts:gameFacts(room)});
 return pending.length;
}
