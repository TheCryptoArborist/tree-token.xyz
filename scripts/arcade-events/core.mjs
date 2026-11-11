export const MIST=1_000_000_000n;
export const TERMS=Object.freeze({entryFeeMist:'5000000000',minimumPrizeMist:'25000000000',prizeShareBps:8000,lives:3,paidContinues:false,attempts:'unlimited',payout:'manual-after-review',access:'nftree-holder-only'});
export const GAMES=Object.freeze([
 {id:'treeforce89',name:'Tree Force ’89',art:'/assets/arcade/tree-force-89-poster.webp',path:'/play/treeforce89/'},
 {id:'canopy-breaker',name:'Canopy Breaker',art:'/assets/arcade/canopy-breaker-game.webp',path:'/play/canopy-breaker/'},
 {id:'root-rage',name:'Root Rage',art:'/play/root-rage/boss-fight-cover.jpg',path:'/play/root-rage/'},
 {id:'deadfall-run',name:'Deadfall Run',art:'/play/deadfall-run/preview-hype-v1.webp',path:'/play/deadfall-run/'},
 {id:'canopy-defense',name:'Canopy Defense',art:'/play/canopy-defense/checkout-test/assets/brand/canopy-home-scene.webp',path:'/play/canopy-defense/'}
]);
export function suiToMist(value){
 if(typeof value!=='string'||! /^(0|[1-9]\d{0,8})(\.\d{1,9})?$/.test(value))throw Error('Use a SUI amount with at most nine decimal places.');
 const [whole,fraction='']=value.split('.');return BigInt(whole)*MIST+BigInt(fraction.padEnd(9,'0'));
}
export function mistToSui(value){const n=BigInt(value),sign=n<0n?'-':'',a=n<0n?-n:n,f=String(a%MIST).padStart(9,'0').replace(/0+$/,'');return sign+String(a/MIST)+(f?'.'+f:'');}
export function economics(entries,terms=TERMS){
 if(!Number.isSafeInteger(entries)||entries<0||entries>1_000_000)throw Error('Invalid number of paid entrants.');
 const fee=BigInt(terms.entryFeeMist),floor=BigInt(terms.minimumPrizeMist);
 if(fee<=0n||floor<0n||terms.prizeShareBps!==8000)throw Error('Invalid event terms.');
 const revenue=BigInt(entries)*fee,share=revenue*8000n/10000n,prize=share>floor?share:floor;
 return {entries,revenueMist:String(revenue),prizeMist:String(prize),organizerNetBeforeCostsMist:String(revenue-prize),organizerShareMist:String(revenue>prize?revenue-prize:0n),reserveTopUpMist:String(prize>revenue?prize-revenue:0n)};
}
function parts(date,timeZone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));}
export function localToUtc(value,timeZone='America/Chicago'){
 if(!['America/Chicago','UTC'].includes(timeZone)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a valid date, time and time zone.');
 const [y,m,d,h,min]=value.match(/\d+/g).map(Number),guess=Date.UTC(y,m-1,d,h,min),valid=new Date(guess);
 if(valid.getUTCFullYear()!==y||valid.getUTCMonth()!==m-1||valid.getUTCDate()!==d||h>23||min>59)throw Error('Choose a valid date and time.');
 const matches=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){const stamp=guess+offset*60000,p=parts(stamp,timeZone);if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===value)matches.push(stamp);}
 if(matches.length!==1)throw Error(matches.length?'That time occurs twice during the clock change. Use UTC or choose another time.':'That local time does not exist during the clock change.');
 return new Date(matches[0]).toISOString();
}
export function makeDraft(input={}){
 const game=GAMES.find(g=>g.id===(input.gameId||'treeforce89'));if(!game)throw Error('Select a supported game.');
 const suppliedTitle=String(input.title||'Canopy Crown ’89');
 const title=(game.id==='treeforce89'&&suppliedTitle==='Defend the Canopy'?'Canopy Crown ’89':suppliedTitle).trim();if(!title||title.length>80)throw Error('Use an event title of 1–80 characters.');
 const timeZone=input.timeZone||'America/Chicago';if(!['America/Chicago','UTC'].includes(timeZone))throw Error('Select Central Time or UTC.');
 const startLocal=input.startLocal||'',endLocal=input.endLocal||'';
 if(Boolean(startLocal)!==Boolean(endLocal))throw Error('Set both the beginning and ending time.');
 const startsAt=startLocal?localToUtc(startLocal,timeZone):null,endsAt=endLocal?localToUtc(endLocal,timeZone):null;
 if(startsAt&&Date.parse(endsAt)<=Date.parse(startsAt))throw Error('The event must end after it begins.');
 const id=/^[a-z0-9-]{6,90}$/.test(input.id||'')?input.id:'treeforce89-defend-the-canopy-01';
 return {version:1,id,title,gameId:game.id,timeZone,startLocal,endLocal,startsAt,endsAt,status:'draft',terms:{...TERMS},cosmetics:{frame:`${id}:participant-frame`,badge:`${id}:participant-badge`,champion:`${id}:champion-badge`,permanent:true},paymentEnabled:false};
}
export function phase(event,serverNow=Date.now()){
 if(!Number.isFinite(serverNow))throw Error('A valid server clock is required.');
 if(event.status==='cancelled')return 'cancelled';
 if(event.status==='finalized')return 'finalized';
 if(event.status==='draft'||!event.startsAt||!event.endsAt)return 'draft';
 const a=Date.parse(event.startsAt),b=Date.parse(event.endsAt);if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Invalid event window.');
 return serverNow<a?'upcoming':serverNow<b?'live':'closed';
}
export function checkEvidence(event,evidence,serverNow){
 if(!Number.isFinite(serverNow))return {eligible:false,reason:'A valid server clock is required.'};
 if(event.gameId!=='treeforce89')return {eligible:false,reason:'This game needs its own score validation adapter.'};
 if(!evidence||evidence.trust!=='server-reviewed')return {eligible:false,reason:'Score evidence must be verified by the event service.'};
 const a=Date.parse(event.startsAt),b=Date.parse(event.endsAt),s=Date.parse(evidence.startedAt),e=Date.parse(evidence.completedAt);
 if(event.status!=='scheduled'||!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(s)||!Number.isFinite(e)||s<a||s>=b||e<s||e>=b||e>serverNow)return {eligible:false,reason:'The run must start and finish inside the event window.'};
 if(evidence.gameId!==event.gameId||!/^0x[0-9a-f]{64}$/.test(evidence.wallet||''))return {eligible:false,reason:'Wrong game or wallet.'};
 if(evidence.continues!==0||evidence.startingLives!==3||evidence.debug!==false)return {eligible:false,reason:'Use a fresh three-life run without continues or test tools.'};
 if(!Number.isSafeInteger(evidence.score)||evidence.score<0||typeof evidence.proofId!=='string'||!evidence.proofId)return {eligible:false,reason:'Invalid score evidence.'};
 return {eligible:true};
}
export function standings(event,rows,serverNow){
 const best=new Map(),proofs=new Set();
 for(const row of rows){if(row.eventId!==event.id||row.review!=='verified'||!checkEvidence(event,row,serverNow).eligible)continue;
  if(proofs.has(row.proofId))throw Error('Duplicate score proof.');proofs.add(row.proofId);
  const old=best.get(row.wallet);if(!old||row.score>old.score||row.score===old.score&&Date.parse(row.completedAt)<Date.parse(old.completedAt))best.set(row.wallet,row);
 }
 return [...best.values()].sort((a,b)=>b.score-a.score||Date.parse(a.completedAt)-Date.parse(b.completedAt)||a.wallet.localeCompare(b.wallet)).map((row,i)=>({...row,rank:i+1}));
}
export function launchChecks(event,verified={}){
 return [
 ['schedule','Beginning and ending times',Boolean(event.startsAt&&event.endsAt)],
 ['funding','Guaranteed prize funding',verified.funding===true],
 ['payment','Entry payment and retry checks',verified.payment===true],
 ['scoring','Three-life tournament score validation',verified.scoring===true],
 ['cosmetics','Saved cosmetic unlock and recovery',verified.cosmetics===true]
 ].map(([id,label,ready])=>({id,label,ready}));
}
