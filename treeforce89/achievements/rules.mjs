export const BADGES=[
 ['first-blight','First Blight','Destroy your first enemy','kills',1,'✦'],
 ['blight-hunter','Blight Hunter','Destroy 50 enemies in one run','kills',50,'✹'],
 ['grove-guardian','Grove Guardian','Destroy 150 enemies in one run','kills',150,'❖'],
 ['first-canopy','First Canopy','Clear wave 1','clearedWaves',1,'♠'],
 ['deep-patrol','Deep Patrol','Clear wave 5','clearedWaves',5,'⬟'],
 ['clean-canopy','Clean Canopy','Clear a wave without damage','cleanWaves',1,'◇'],
 ['chain-reaction','Chain Reaction','Reach a 25-enemy chain','maxChain',25,'⛓'],
 ['ancient-arborwing','Ancient Arborwing','Reach growth stage 5','maxStage',4,'♣'],
 ['perfect-shield','Perfect Shield','Earn a perfect shield','perfect',1,'⬡'],
 ['victory-boost','Victory Boost','Collect a VICTORY Turbo','turboPickups',1,'ϟ'],
 ['boom-bloom','BOOM Bloom','Collect a BOOM Blast','boomPickups',1,'✺'],
 ['tyrant-toppler','Tyrant Toppler','Defeat the final Canopy Tyrant','cleared',true,'♛'],
 ['canopy-ace','Canopy Ace','Score 50,000 points in one run','score',50000,'★'],
];
export function earnedBadges(run){return BADGES.filter(([, , ,field,target])=>typeof target==='boolean'?run[field]===target:Number(run[field]||0)>=target).map(b=>b[0]);}
export function validateRun(run){
 if(!run||run.ranked!==true||!/^grove-[a-f0-9]{32}$/.test(run.runId||''))throw Error('Only standard game runs can be ranked.');
 const limits={score:10000000,kills:5000,wave:9,shotsFired:200000,shotsHit:200000,perfect:1000,maxStage:4,maxChain:5000,clearedWaves:10,cleanWaves:100,turboPickups:1000,boomPickups:1000};
 const clean={runId:run.runId,ranked:true,cleared:run.cleared===true};
 for(const [key,max] of Object.entries(limits)){const n=run[key]??0;if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('Invalid run statistics.');clean[key]=n;}
 if(clean.shotsHit>clean.shotsFired||clean.maxChain>clean.kills||clean.cleanWaves>clean.clearedWaves)throw Error('Inconsistent run statistics.');
 return clean;
}
export function validateUsername(value){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/.test(value.trim()))throw Error('Use 3–20 letters, numbers, spaces, underscores or hyphens.');return value.trim();}
