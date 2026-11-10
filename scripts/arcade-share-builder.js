export const shareGames=[
 {id:'garden-bot',name:'Garden Bot',url:'https://nftree.net/battle/garden-bot',art:'/assets/arcade/garden-bot-poster.webp'},
 {id:'arborist-trials',name:'Arborist Trials',url:'https://nftree.net/battle/trials',art:'/assets/arcade/arborist-trials-poster.webp'},
 {id:'pvp',name:'PvP Battle',url:'https://nftree.net/battle/pvp',art:'/assets/arcade/pvp-battle-poster.webp'},
 {id:'treeforce89',name:'Tree Force ’89',url:'https://tree-token.xyz/play/treeforce89/',art:'/assets/arcade/tree-force-89-poster.webp'}
];
export function shareMessages(game,challenge=false){const link='https://tree-token.xyz/play/';return challenge?[
 `Who’s up for ${game.name}? Play a run and reply with your result. Let’s see what you’ve got! 🌳 ${link}`,
 `Your next arcade challenge: ${game.name}. I’m playing—join me and share your run! 🌳 ${link}`,
 `Calling the TREE crew: take on ${game.name} and reply with your gameplay. Your move! 🌳 ${link}`
]:[
 `I’m playing ${game.name} in TREE Arcade. Come defend the canopy with me! 🌳 ${link}`,
 `${game.name} is my next TREE Arcade adventure. Which game are you taking on? 🎮 ${link}`,
 `A little strategy. A little competition. A lot of TREE. Join me in ${game.name}! 🌳 ${link}`
];}
export function mountShareBuilder(host,{challenge=false,initialGame='garden-bot'}={}){
 if(!host||host.dataset.shareMounted)return;host.dataset.shareMounted='true';
 const doc=host.ownerDocument;let index=0,game=shareGames.find(g=>g.id===initialGame)||shareGames[0],image=null,version=0,ready=false;
 const select=doc.createElement('select');select.setAttribute('aria-label',challenge?'Choose a game to challenge a friend':'Choose the game you played');for(const g of shareGames){const o=doc.createElement('option');o.value=g.id;o.textContent=g.name;select.append(o);}select.value=game.id;
 const choices=doc.createElement('div');choices.className='share-template-choices';const buttons=[];
 for(let i=0;i<3;i++){const b=doc.createElement('button');b.type='button';b.textContent=['Canopy Crew','Arcade Challenge','TREE Spotlight'][i];b.addEventListener('click',()=>{index=i;render();});choices.append(b);buttons.push(b);}
 const canvas=doc.createElement('canvas');canvas.width=1200;canvas.height=675;canvas.setAttribute('aria-label','Your ready-made game share card');canvas.className='share-card-preview';
 const text=doc.createElement('p');text.className='share-message';
 const actions=doc.createElement('div');actions.className='share-actions';
 const download=doc.createElement('button');download.type='button';download.textContent='1. Download graphic';
 const x=doc.createElement('a');x.textContent='2. Open ready-made X post ↗';x.target='_blank';x.rel='noopener noreferrer';
 const native=doc.createElement('button');native.type='button';native.textContent='Share graphic & message';
 const note=doc.createElement('p');note.className='growth-small';note.textContent='Pick a message style. Download its graphic, then attach it to the prefilled X post. Nothing is published automatically.';
 const status=doc.createElement('p');status.setAttribute('role','status');status.className='share-status';actions.append(download,x,native);host.append(select,choices,canvas,text,actions,note,status);
 function render(){text.textContent=shareMessages(game,challenge)[index];x.href='https://x.com/intent/post?'+new URLSearchParams({text:text.textContent});buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));download.disabled=!ready;native.disabled=!ready;
  const c=canvas.getContext('2d'),colors=[['#102a20','#eac86f'],['#101f35','#89e6be'],['#291d38','#f1bceb']][index];c.fillStyle=colors[0];c.fillRect(0,0,1200,675);c.strokeStyle=colors[1];c.lineWidth=6;c.strokeRect(20,20,1160,635);c.fillStyle=colors[1];c.font='bold 24px system-ui';c.fillText('TREE ARCADE',55,72);
  if(image){const s=Math.min(420/image.width,450/image.height),w=image.width*s,h=image.height*s;c.drawImage(image,65+(420-w)/2,120+(450-h)/2,w,h);}c.fillStyle='#fff6dd';c.font='bold 43px system-ui';wrap(c,game.name,535,215,590,55);c.font='bold 32px system-ui';wrap(c,challenge?['YOUR MOVE.','JOIN THE CHALLENGE.','CALLING THE TREE CREW.'][index]:['DEFEND THE CANOPY.','PICK YOUR NEXT ADVENTURE.','GROW. PLAY. REPEAT.'][index],535,340,580,45);c.fillStyle=colors[1];c.font='24px system-ui';wrap(c,challenge?'Play a run. Reply with your result.':'Come play with the TREE community.',535,465,560,34);c.font='bold 30px system-ui';c.fillText('tree-token.xyz/play/',535,590);
 }
 function wrap(c,value,x,y,width,line){let row='';for(const word of value.split(' ')){if(c.measureText(row+word).width>width&&row){c.fillText(row,x,y);row='';y+=line;}row+=word+' ';}c.fillText(row.trim(),x,y);}
 async function load(){const n=++version;ready=false;image=null;render();status.textContent='Loading game artwork…';try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=game.art;});if(n!==version)return;image=img;ready=true;render();status.textContent='Your graphic and message are ready.';}catch{if(n===version)status.textContent='Artwork could not load. Choose another game or try again.';}}
 const blob=()=>new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('Export failed')),'image/png'));
 download.addEventListener('click',async()=>{if(!ready)return;try{const url=URL.createObjectURL(await blob()),a=doc.createElement('a');a.href=url;a.download=`tree-${game.id}-${index+1}.png`;doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='Graphic downloaded. Open the prefilled X post and attach this image.';}catch{status.textContent='Could not export this graphic. Try again.';}});
 native.addEventListener('click',async()=>{if(!ready)return;try{const file=new File([await blob()],`tree-${game.id}.png`,{type:'image/png'});if(!navigator.canShare?.({files:[file]})){status.textContent='Your browser does not support image sharing. Use Download graphic, then Open ready-made X post.';return;}await navigator.share({files:[file],text:text.textContent,title:game.name+' · TREE Arcade'});}catch(e){status.textContent=e.name==='AbortError'?'Sharing cancelled. Your draft is still ready.':'Use Download graphic and attach it to the prefilled X post.';}});
 select.addEventListener('change',()=>{game=shareGames.find(g=>g.id===select.value);void load();});
 host.addEventListener('arcade-share-game',e=>{const g=shareGames.find(g=>g.id===e.detail?.gameId);if(g){game=g;select.value=g.id;void load();}});void load();
}

export function savedGameStatus(progress,game,launched=false){const today=Boolean(progress?.today?.gameIds?.includes(game.id));const monthly=Boolean(progress?.passport?.completedGameIds?.includes(game.id)||progress?.passport?.optionalCompletedGameIds?.includes(game.id));return today?game.id==='treeforce89'?'Participation saved ✓ · Run completion is not reported here':`Completed ✓ · Today’s saved ${game.name} result`:monthly?'Monthly game stamp saved ✓ · Play again any time':launched?'Started · Return after saving your result, then check progress':'Not started · Pick a game and select Play';}
