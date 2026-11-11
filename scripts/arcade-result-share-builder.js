export const shareGames=[
 {id:'treeforce89',name:'Tree Force ’89',url:'https://tree-token.xyz/play/treeforce89/',art:'/assets/arcade/tree-force-89-poster.webp'},
 {id:'canopy-breaker',name:'Canopy Breaker',url:'https://tree-token.xyz/play/canopy-breaker/',art:'/assets/arcade/canopy-breaker-game.webp'},
 {id:'garden-bot',name:'Garden Bot',url:'https://nftree.net/battle/garden-bot',art:'/assets/arcade/garden-bot-poster.webp'},
 {id:'pvp',name:'PvP Battle',url:'https://nftree.net/battle/pvp',art:'/assets/arcade/pvp-battle-poster.webp'}
];
const shareCardHooks={
 treeforce89:['HOW MANY WAVES CAN YOU SURVIVE?','WHAT’S WAITING IN THE NEXT WAVE?','ONE MORE WAVE. THINK YOU’RE READY?'],
 'canopy-breaker':['WHAT’S HIDING BEHIND THE NEXT BRICK?','ONE BOUNCE CAN CHANGE EVERYTHING.','HOW FAR CAN ONE BALL TAKE YOU?'],
 'garden-bot':['CAN YOUR STRATEGY OUTSMART THE BOT?','YOUR NEXT MOVE COULD CHANGE THE MATCH.','WHAT WOULD YOU PLAY NEXT? FIND OUT.'],
 pvp:['WHAT HAPPENS WHEN YOUR GARDEN GOES TO WAR?','WHO WINS WHEN TWO GARDENS COLLIDE?','YOUR NEXT RIVAL IS WAITING. READY?']
};
export function shareMessages(game,challenge=false){const link='https://tree-token.xyz/play/';return challenge?[
 `Who’s up for ${game.name}? Play a run and reply with your result. Let’s see what you’ve got! 🌳 ${link}`,
 `Your next arcade challenge: ${game.name}. I’m playing—join me and share your run! 🌳 ${link}`,
 `Calling the TREE crew: take on ${game.name} and reply with your gameplay. Your move! 🌳 ${link}`
]:[
 `I’m playing ${game.name} in TREE Arcade. Come defend the canopy with me! 🌳 ${link}`,
 `${game.name} is my next TREE Arcade adventure. Which game are you taking on? 🎮 ${link}`,
 `A little strategy. A little competition. A lot of TREE. Join me in ${game.name}! 🌳 ${link}`
];}
export function mountShareBuilder(host,{challenge=false,initialGame='garden-bot',games=shareGames,result=false,runs=[]}={}){
 if(!host||host.dataset.shareMounted)return;host.dataset.shareMounted='true';
 const doc=host.ownerDocument;let selectedRun=runs[0]||null;let index=0,game=games.find(g=>g.id===initialGame)||games[0],image=null,version=0,ready=false;
 if(selectedRun)initialGame=selectedRun.gameId;
 const select=doc.createElement('select');select.setAttribute('aria-label',challenge?'Choose a game to challenge a friend':'Choose the game you played');if(result&&runs.length){for(const run of runs){const g=games.find(g=>g.id===run.gameId);if(!g)continue;const o=doc.createElement('option');o.value=run.id;o.textContent=g.name+(run.score===null?' · Completed':' · '+run.score.toLocaleString()+' points')+' · '+new Date(run.completedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});select.append(o);}select.value=selectedRun.id;game=games.find(g=>g.id===selectedRun.gameId);select.setAttribute('aria-label','Choose a saved run to share');}else{for(const g of games){const o=doc.createElement('option');o.value=g.id;o.textContent=g.name;select.append(o);}select.value=game.id;}
 const choices=doc.createElement('div');choices.className='share-template-choices';const buttons=[];
 for(let i=0;i<3;i++){const b=doc.createElement('button');b.type='button';b.textContent=(result?['Your turn','Crew call','Next challenger']:['Canopy Crew','Arcade Challenge','TREE Spotlight'])[i];b.addEventListener('click',()=>{index=i;render();});choices.append(b);buttons.push(b);}
 const canvas=doc.createElement('canvas');canvas.width=1200;canvas.height=675;canvas.setAttribute('aria-label','Your ready-made game share card');canvas.className='share-card-preview';
 const text=doc.createElement('p');text.className='share-message';
 const actions=doc.createElement('div');actions.className='share-actions';
 const download=doc.createElement('button');download.type='button';download.textContent='1. Download graphic';
 const x=doc.createElement('a');x.textContent='2. Open ready-made X post ↗';x.target='_blank';x.rel='noopener noreferrer';
 const native=doc.createElement('button');native.type='button';native.textContent='Share graphic & message';
 const note=doc.createElement('p');note.className='growth-small';note.textContent='Pick a message style. Download its graphic, then attach it to the prefilled X post. Nothing is published automatically.';
 const status=doc.createElement('p');status.setAttribute('role','status');status.className='share-status';actions.append(download,x,native);host.append(select,choices,canvas,text,actions,note,status);
 function render(){text.textContent=result?resultMessages(game,selectedRun)[index]:shareMessages(game,challenge)[index];x.href='https://x.com/intent/post?'+new URLSearchParams({text:text.textContent});buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));download.disabled=!ready;native.disabled=!ready;
  drawShareCard(canvas.getContext('2d'),{game,run:selectedRun,image,index,result,challenge});
 }

 async function load(){const n=++version;ready=false;image=null;render();status.textContent='Loading game artwork…';try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=game.art;});if(n!==version)return;image=img;ready=true;render();status.textContent='Your graphic and message are ready.';}catch{if(n===version)status.textContent='Artwork could not load. Choose another game or try again.';}}
 const blob=()=>new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('Export failed')),'image/png'));
 download.addEventListener('click',async()=>{if(!ready)return;try{const url=URL.createObjectURL(await blob()),a=doc.createElement('a');a.href=url;a.download=`tree-${game.id}-${index+1}.png`;doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='Graphic downloaded. Open the prefilled X post and attach this image.';}catch{status.textContent='Could not export this graphic. Try again.';}});
 native.addEventListener('click',async()=>{if(!ready)return;try{const file=new File([await blob()],`tree-${game.id}.png`,{type:'image/png'});if(!navigator.canShare?.({files:[file]})){status.textContent='Your browser does not support image sharing. Use Download graphic, then Open ready-made X post.';return;}await navigator.share({files:[file],text:text.textContent,title:game.name+' · TREE Arcade'});}catch(e){status.textContent=e.name==='AbortError'?'Sharing cancelled. Your draft is still ready.':'Use Download graphic and attach it to the prefilled X post.';}});
 select.addEventListener('change',()=>{if(result&&runs.length){selectedRun=runs.find(run=>run.id===select.value);game=games.find(g=>g.id===selectedRun.gameId);}else game=games.find(g=>g.id===select.value);void load();});
 host.addEventListener('arcade-share-game',e=>{const g=games.find(g=>g.id===e.detail?.gameId);if(g){game=g;select.value=g.id;void load();}});void load();
}

export function savedGameStatus(progress,game,launched=false){const today=Boolean(progress?.today?.gameIds?.includes(game.id));const monthly=Boolean(progress?.passport?.completedGameIds?.includes(game.id)||progress?.passport?.optionalCompletedGameIds?.includes(game.id));return today?game.id==='treeforce89'?'Participation saved ✓ · Run completion is not reported here':`Completed ✓ · Today’s saved ${game.name} result`:monthly?'Monthly game stamp saved ✓ · Play again any time':launched?'Started · Return after saving your result, then check progress':'Not started · Pick a game and select Play';}

export function resultMessages(game,run=null){
 const points=Number.isSafeInteger(run?.score)?run.score.toLocaleString('en-US'):null;
 const stage=Number.isSafeInteger(run?.stage)&&run.stage>0?`${game.id==='canopy-breaker'?'Grove':'Wave'} ${run.stage}`:null;
 const stats=points?`${points} points${stage?' · '+stage:''}`:'Match complete';
 const link='https://tree-token.xyz/play/';
 const hooks={treeforce89:['The canopy called. I answered. 🚀','Canopy crew, you’re up! 🌳','New challenger wanted. 🎮'],
 'canopy-breaker':['Bricks down. Roots up. 🌳','Got a better bounce? 🎮','The canopy has a new challenger. 🍃'],
 'garden-bot':['Planted my strategy. Finished the fight. 🌱','Garden crew, your move! 🌳','Big roots. Bigger strategy. 🎮'],
 pvp:['Roots in the arena. Game on. ⚔️','Next challenger, step into the garden. 🌳','TREE crew: who’s ready for a battle? 🎮']}[game.id]||['Game on! 🎮','Your turn! 🌳','Challenge accepted. 🍃'];
 const invitations=points?['Think you can beat my score?','Play a run. Drop your score. Let’s see it!','Your mission: top this run.']:['Ready to play your match?','Bring your strategy. Share your result!','Play your match and show the TREE crew!'];
 return hooks.map((hook,i)=>`${hook}\n\n${game.name}: ${stats}.\n${invitations[i]}\n\n${link} #TreeArcade`);
}

// Keep the exported graphic at 1200 × 675; fit long saved scores inside its text column.
export function drawShareCard(c,{game,run=null,image=null,index=0,result=false,challenge=false}){
 const palettes=[['#071b19','#c9f45c','#3baf94'],['#0b122b','#82f2d5','#687df1'],['#211329','#ffcf73','#b86ccf']];
 const [bg,accent,glow]=palettes[index];
 const gradient=c.createLinearGradient(0,0,1200,675);gradient.addColorStop(0,bg);gradient.addColorStop(1,'#030b10');c.fillStyle=gradient;c.fillRect(0,0,1200,675);
 c.save();c.globalAlpha=.18;c.strokeStyle=glow;c.lineWidth=2;
 for(let r=170;r<820;r+=65){c.beginPath();c.arc(270,310,r,0,Math.PI*2);c.stroke();}
 c.globalAlpha=.1;for(let y=0;y<560;y+=6){c.fillStyle='#ffffff';c.fillRect(0,y,1200,1);}c.restore();
 // A fine outer frame ties the header, artwork and footer into one finished card.
 c.strokeStyle=accent;c.lineWidth=2;c.strokeRect(14,14,1172,647);
 c.save();c.globalAlpha=.28;c.strokeRect(20,20,1160,635);c.restore();
 for(const x of [14,1166])for(const y of [14,641]){c.fillStyle=accent;c.fillRect(x,y===14?14:658,20,3);c.fillRect(x===14?14:1183,y,3,20);}
 c.fillStyle=accent;c.fillRect(52,83,70,3);
 c.font='900 28px system-ui';c.save();c.lineJoin='round';c.strokeStyle='#020908';c.lineWidth=5;c.strokeText('TREE ARCADE',52,62);c.fillText('TREE ARCADE',52,62);c.restore();
 c.textAlign='right';c.font='700 18px system-ui';c.fillStyle='#d2e2db';c.fillText(result?'SAVED RUN  /  PLAYER CHALLENGE':challenge?'THE CANOPY IS CALLING':'PICK UP. PLAY. GROW.',1148,60);c.textAlign='left';
 c.save();c.shadowColor=glow;c.shadowBlur=35;c.fillStyle='#081211';c.fillRect(55,104,440,418);c.restore();
 c.strokeStyle=accent;c.lineWidth=2;c.strokeRect(55,104,440,418);
 c.save();c.globalAlpha=.35;c.strokeRect(61,110,428,406);c.restore();
 if(image){const scale=Math.min(400/image.width,388/image.height),w=image.width*scale,h=image.height*scale;c.drawImage(image,75+(400-w)/2,119+(388-h)/2,w,h);}
 const fit=(value,x,y,max,size,weight='900',color='#fff9e9')=>{c.fillStyle=color;c.font=`${weight} ${size}px system-ui`;while(c.measureText(value).width>max&&size>16){size--;c.font=`${weight} ${size}px system-ui`;}if(color!=='#0a211b'){c.save();c.lineJoin='round';c.strokeStyle='#020908';c.lineWidth=size>=60?6:4;c.strokeText(value,x,y);c.restore();}c.fillText(value,x,y);};
 const hasScore=result&&Number.isSafeInteger(run?.score);
 const headline=result?(hasScore?['CAN YOU TOP THIS?','SCORE TO SETTLE.','NEXT CHALLENGER?'][index]:['YOUR NEXT MATCH?','BRING YOUR STRATEGY.','THE GARDEN CALLS.'][index]):challenge?['YOUR MOVE.','CHALLENGE ACCEPTED?','CALLING THE TREE CREW.'][index]:['DEFEND THE CANOPY.','PICK YOUR ADVENTURE.','GROW. PLAY. REPEAT.'][index];
 fit(headline,540,139,610,43,'900',accent);
 fit(game.name.toUpperCase(),540,200,610,31,'800');
 if(hasScore){
  fit(run.score.toLocaleString('en-US'),532,357,620,142);
  const stage=Number.isSafeInteger(run.stage)&&run.stage>0?`  /  ${game.id==='canopy-breaker'?'GROVE':'WAVE'} ${run.stage}`:'';
  fit('POINTS'+stage,542,405,600,26,'800',accent);
  fit('RUN COMPLETE. CHALLENGE OPEN.',542,480,600,23,'700','#cfdfd6');
 }else{
  fit(result?'MATCH':challenge?'GAME':'PLAY.',540,319,610,91);
  fit(result?'COMPLETE.':challenge?'ON.':'GROW.',540,413,610,84);
  fit(result?'YOUR TURN TO ENTER THE GARDEN.':'BRING YOUR GAME. JOIN THE TREE CREW.',542,480,600,23,'700',accent);
 }
 // Inset the banner inside the card frame, with a dark trim and a light bevel.
 c.save();c.shadowColor='#000000';c.shadowBlur=14;c.shadowOffsetY=4;c.fillStyle=accent;c.fillRect(26,550,1148,103);c.restore();
 c.strokeStyle='#071b19';c.lineWidth=4;c.strokeRect(32,556,1136,91);
 c.save();c.globalAlpha=.58;c.strokeStyle='#ffffff';c.lineWidth=1;c.strokeRect(37,561,1126,81);c.restore();
 fit(shareCardHooks[game.id]?.[index]||'YOUR NEXT ARCADE ADVENTURE STARTS HERE.',56,590,1088,27,'900','#0a211b');
 fit('tree-token.xyz/play/',56,632,900,33,'900','#0a211b');
 c.textAlign='right';c.fillStyle='#0a211b';c.font='900 21px system-ui';c.fillText('PLAY & FIND OUT →',1140,630);c.textAlign='left';
}
