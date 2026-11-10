import {ranks, collections, artURL} from './arcade-seasonal-data.js';
const root=document.getElementById('arcade-daily-growth');
if(root){
 const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 const setImage=(node,slug)=>{if(node&&node.getAttribute('src')!==artURL(slug))node.setAttribute('src',artURL(slug));};
 // Presentation follows the server-rendered month when available. It never grants awards.
 function month(){const label=document.getElementById('growth-calendar-title')?.textContent||'';for(const key of Object.keys(collections)) {const name=new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));if(label.includes(name))return key;}return new Date().toISOString().slice(0,7);}
 function update(){
  const key=month(), collection=collections[key];
  if(!collection)setText(document.getElementById('seasonal-current-title'),'Legends of TREE');
  if(collection){
   setText(document.getElementById('seasonal-current-title'),collection.title);
   root.querySelectorAll('.growth-stop[data-rank],.growth-milestone[data-rank],.growth-rank-stop[data-rank-id],.growth-reward[data-rank]').forEach(node=>{
    const i=ranks.indexOf(node.dataset.rank||node.dataset.rankId);if(i<0)return;
    const [name,slug]=collection.items[i];setImage(node.querySelector('img'),slug);
    setText(node.querySelector('.growth-stop-copy strong')||node.querySelector('strong')||node.querySelector('#growth-summary-art-label'),name+(node.classList.contains('growth-milestone')&&node.classList.contains('is-done')?' ✓':''));
    setText(node.querySelector('.growth-stop-flavor'),i===3?'The Tree Hero of your seasonal collection.':'Show up. Grow your seasonal collection.');
   });
   const rank=root.querySelector('.growth-reward')?.dataset.rank;const i=ranks.indexOf(rank);if(i>=0)setImage(root.querySelector('.growth-strip-art'),collection.items[i][1]);
   const old=['TREE Spark','NFTree Scout','TREE FORCE Vanguard','Thickquidity Legend'];
   for(const id of ['growth-teaser-badge','growth-next','growth-journey-note','growth-summary-flavor','growth-summary-count','growth-invitation-next']){const node=document.getElementById(id);if(node){let value=node.textContent;old.forEach((name,i)=>value=value.replaceAll(name,collection.items[i][0]));setText(node,value);}}
  }
  if(collection){root.querySelectorAll('.growth-earned-chip').forEach(node=>{let value=node.textContent;['TREE Spark','NFTree Scout','TREE FORCE Vanguard','Thickquidity Legend'].forEach((name,i)=>value=value.replaceAll(name,collection.items[i][0]));setText(node,value);});}
   // Earned historical awards retain the artwork belonging to their own month.
   root.querySelectorAll('.growth-badge[data-rank]').forEach(node=>{const i=ranks.indexOf(node.dataset.rank);const label=node.querySelector('.growth-badge-copy p')?.textContent||'';if(i<0)return;for(const [k,c]of Object.entries(collections)){const name=new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(k+'-01T12:00:00Z'));if(label.startsWith(name)){setImage(node.querySelector('img'),c.items[i][1]);setText(node.querySelector('strong'),c.items[i][0]);break;}}});
  const preview=document.getElementById('seasonal-december');if(preview)preview.hidden=new Date().toISOString().slice(0,7)>='2026-12';
  const title=document.getElementById('growth-invitation-title');setText(title,'Daily check-in');
 }
 const banner=document.getElementById('arcade-checkin-shortcut');banner?.addEventListener('click',()=>{document.getElementById('growth-today-tab')?.click();document.getElementById('growth-check-in-task')?.scrollIntoView({block:'center',behavior:'smooth'});});
 const observer=new MutationObserver(()=>{observer.disconnect();update();observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-rank','src']});});
 update();observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-rank','src']});
}
