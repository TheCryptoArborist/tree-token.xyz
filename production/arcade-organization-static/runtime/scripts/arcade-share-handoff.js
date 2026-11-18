// Opaque navigation hints only. The receiver still requires authenticated receipts.
export const HANDOFF_GAMES=['treeforce89','canopy-breaker','garden-bot','pvp'];
export const sha256=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function md5(value){
 const input=new TextEncoder().encode(value),bytes=new Uint8Array(Math.ceil((input.length+9)/64)*64);bytes.set(input);bytes[input.length]=128;
 const view=new DataView(bytes.buffer);view.setUint32(bytes.length-8,input.length*8,true);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
 for(let offset=0;offset<bytes.length;offset+=64){let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){let f,g;if(i<16){f=(b&c)|(~b&d);g=i;}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}
   const sum=(a+f+(Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0)+view.getUint32(offset+g*4,true))|0,s=shifts[Math.floor(i/16)*4+i%4],next=(b+((sum<<s)|(sum>>>(32-s))))|0;a=d;d=c;c=b;b=next;
  }a0=(a0+a)|0;b0=(b0+b)|0;c0=(c0+c)|0;d0=(d0+d)|0;
 }
 const out=new DataView(new ArrayBuffer(16));[a0,b0,c0,d0].forEach((x,i)=>out.setInt32(i*4,x,true));return [...new Uint8Array(out.buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const address=value=>/^0x[0-9a-f]{1,64}$/i.test(value||'')?'0x'+value.slice(2).toLowerCase().padStart(64,'0'):null;
export async function receiptIdForRun(gameId,runId,wallet){
 if(!HANDOFF_GAMES.includes(gameId))throw Error('Unknown game');
 const owner=address(wallet);if(!owner||typeof runId!=='string')throw Error('Missing saved run');
 let source;
 if(gameId==='treeforce89'){if(!/^grove-[a-f0-9]{32}$/.test(runId))throw Error('Invalid mission');source='treeforce89:'+owner+':'+runId;}
 else if(gameId==='canopy-breaker'){if(!/^[a-z0-9-]{1,128}$/i.test(runId))throw Error('Invalid run');source='canopy-breaker:'+md5(runId);}
 else {const battle=address(runId);if(!battle)throw Error('Invalid battle');source='garden-battles:battle:'+battle+':'+owner;}
 return sha256(gameId+':'+await sha256(source));
}
export function resultShareUrl(gameId,receiptId){
 if(!HANDOFF_GAMES.includes(gameId)||!/^[a-f0-9]{64}$/.test(receiptId))throw Error('Invalid share link');
 return 'https://tree-token.xyz/play/?'+new URLSearchParams({shareGame:gameId,shareRun:receiptId})+'#daily';
}
export function readShareRequest(location){const p=new URLSearchParams(location.search);const gameId=p.get('shareGame'),id=p.get('shareRun');return HANDOFF_GAMES.includes(gameId)&&/^[a-f0-9]{64}$/.test(id||'')?{gameId,id}:null;}
