import {RIBBONS,ribbonDimensions,drawRibbon} from './profile-ribbons.js';
import {badgeDimensions,defaultBadgePosition,constrainBadgePosition} from './profile-badge-position.js';
import {photoDimensions,photoFillScale,fitFullPhoto,photoPanLimits,frameOpeningRadius,photoBackdropColors} from './profile-photo-fit.js';
import {framePhotoOutline} from './profile-border-fit.js';
import {gameBadgeArtwork} from './profile-game-art.js';
import {ancientOakArtwork} from './profile-canopy-art.js';
import {createStudioAccess} from './profile-studio-access-v4.js';
import {drawMedallion} from './profile-partner-medallion.js';
import {collections,artURL} from './arcade-seasonal-data.js';
const $=id=>document.getElementById(id),canvas=$('profile-canvas'),ctx=canvas.getContext('2d');
const status=$('studio-status'),download=$('download-profile'),frame=$('download-frame');
let artReady=false,borderReady=true;
let fitMode=true,openingRadius=449,backdropColors=null;
let badgePosition=null,badgeAlpha=null;
let selectedRibbon=null,ribbonPosition=null,ribbonAlpha=null;
let artShape=null,selectedChoice=null;const choiceButtons=new Map();
function availability(choice,b){const available=access.allowed(choice);b.disabled=!available;b.classList.toggle('is-locked',!available);const small=b.querySelector('small');small.textContent=choice.monthKey?(available?'Earned ✓':'Locked · Earn this monthly badge'):choice.nftId?choice.rarityLabel:'';small.hidden=!small.textContent;b.title=available?choice.name:'Earn this monthly badge with your signed-in Arcade wallet.';}
const access=createStudioAccess({onChange:state=>{$('studio-access-status').textContent=state.busy==='signing-in'?state.message:state.wallet?(state.signedIn?'Signed in · Earned badges loaded.':'Wallet connected · Sign in to use earned badges.'):'Connect your wallet to load NFT badges.';$('studio-connect-wallet').textContent=state.wallet?'Change wallet':'Connect wallet';$('studio-nft-connect').hidden=!!state.wallet;$('studio-wallet-identity').textContent=state.wallet?`${state.wallet.slice(0,8)}…${state.wallet.slice(-6)} · ${state.signedIn?'Arcade signed in':'Wallet connected'}`:'No wallet connected';$('studio-wallet-identity').title=state.wallet||'';$('studio-signin').hidden=state.signedIn;$('studio-signin').disabled=state.busy==='signing-in';$('studio-signin').textContent=state.busy==='signing-in'?'Waiting for wallet…':'Sign in · No gas fee';for(const [choice,b]of choiceButtons)availability(choice,b);renderNFTrees(state);if(selectedChoice&&!access.allowed(selectedChoice)){artVersion++;art=null;artReady=false;selectedChoice=null;draw();controls();}}});

let photo=null,art=null,borderArt=null,borderPhotoClip=null,borderVersion=0,rotation=0,photoVersion=0,artVersion=0,exporting=false;
const themes={gold:['#8b541d','#ffe6a0','#b47720'],mint:['#1e9779','#bdffcc','#37b990'],autumn:['#b84b15','#ffda73','#e68522'],christmas:['#126341','#f7f6e1','#be303b']};
const choices=[{name:'No artwork',url:null,group:'None'}, {name:'TREE Token',shape:'medallion',url:'/assets/tree-token-logo-official.webp',group:'TREE Ecosystem'},{name:'Canopy Breaker',shape:'medallion',gameBadge:'canopy-breaker',url:'/assets/arcade/canopy-breaker-game.webp',group:'TREE Ecosystem'},{name:'VICTORY Power-Up',shape:'medallion',url:'/play/treeforce89/assets/powerups/dex-reward-token.jpeg',group:'Partners'},{name:'SuiDex',shape:'medallion',inset:64,url:'/assets/profile-studio/suidex-official.png',group:'Partners'},{name:'Kelpie',shape:'medallion',inset:64,url:'/assets/profile-studio/kelpie-official.png',group:'Partners'},{name:'BOOM Power-Up',url:'/play/treeforce89/assets/powerups/boom-token.png',group:'Partners'},{name:'Root Rage',shape:'medallion',gameBadge:'root-rage',url:'/play/root-rage/boss-fight-cover.jpg',group:'TREE Ecosystem'},{name:'Tree Hero',url:artURL('tree-hero'),group:'TREE Ecosystem'},...Object.entries(collections).flatMap(([month,c])=>c.items.map(([name,slug],i)=>({name,url:artURL(slug),monthKey:month,rankId:['seedling','sapling','deep-roots','full-canopy'][i],group:month==='2026-12'?'December':'November'}))),{name:'Sovereign City',shape:'medallion',url:'/assets/profile-studio/sovereign-city.webp',group:'Partners'},{name:'Tree Force ’89',shape:'medallion',url:'/assets/arcade/tree-force-89-poster.webp',group:'TREE Ecosystem'},{name:'Garden Bot',url:'/assets/arcade/garden-bot-poster.webp',group:'TREE Ecosystem'},{name:'Canopy Defense',lift:48,extract:'ancient-oak',url:'/assets/profile-studio/canopy-oak-warriors.png',group:'TREE Ecosystem'},{name:'Deadfall Run',shape:'medallion',gameBadge:'deadfall-run',url:'/play/deadfall-run/preview-hype-v1.webp',group:'TREE Ecosystem'},{name:'Arborist Trials',lift:72,url:'/assets/arcade/arborist-trials-poster.webp',group:'TREE Ecosystem'}];
function controls(){download.disabled=!photo||!artReady||!borderReady||exporting;frame.disabled=!artReady||!borderReady||exporting;for(const id of ['fit-photo','fill-photo','photo-zoom','photo-x','photo-y','rotate-photo','reset-photo'])$(id).disabled=!photo||exporting;for(const id of ['badge-size','badge-x','badge-y','reset-badge','edit-badge'])$(id).disabled=!art||!artReady||exporting;for(const id of ['ribbon-x','ribbon-y','ribbon-size','reset-ribbon'])$(id).disabled=!selectedRibbon||exporting;$('ribbon-design').disabled=exporting;canvas.classList.toggle('has-photo',!!photo);canvas.classList.toggle('is-interactive',!!photo||!!art&&artReady||!!selectedRibbon);}
function image(url){return new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not load image.'));i.src=url;});}
function draw(includePhoto=true){
 ctx.clearRect(0,0,1024,1024);ctx.save();ctx.beginPath();ctx.arc(512,512,496,0,Math.PI*2);ctx.clip();
 ctx.save();if(borderArt&&borderPhotoClip)ctx.clip(borderPhotoClip);
 if(includePhoto&&photo){
  const scale=photoFillScale(photo.width,photo.height,rotation)*Number($('photo-zoom').value);
  const photoHeight=photoDimensions(photo.width,photo.height,rotation).height*scale,photoCenterY=512+Number($('photo-y').value);
  const background=ctx.createLinearGradient(0,photoCenterY-photoHeight/2,0,photoCenterY+photoHeight/2);
  (backdropColors||['#143c2a','#143c2a']).forEach((color,i,colors)=>background.addColorStop(i/(colors.length-1),color));
  ctx.fillStyle=background;ctx.fillRect(0,0,1024,1024);
  ctx.save();ctx.translate(512+Number($('photo-x').value),512+Number($('photo-y').value));ctx.rotate(rotation*Math.PI/180);ctx.drawImage(photo,-photo.width*scale/2,-photo.height*scale/2,photo.width*scale,photo.height*scale);ctx.restore();
 }
 if(includePhoto&&!photo){ctx.fillStyle='#143c2a';ctx.fillRect(0,0,1024,1024);ctx.fillStyle='#c9d6bb';ctx.textAlign='center';ctx.font='600 38px system-ui';ctx.fillText('Your photo goes here',512,470);}
 ctx.restore();
 if(borderArt){ctx.drawImage(borderArt,0,0,1024,1024);}else{
 const colors=themes[$('border-theme').value]||themes.gold,gradient=ctx.createLinearGradient(80,0,900,1024);colors.forEach((color,i)=>gradient.addColorStop(i/2,color));ctx.strokeStyle=gradient;ctx.lineWidth=36;ctx.beginPath();ctx.arc(512,512,477,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff1b77f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(512,512,453,0,Math.PI*2);ctx.stroke();}
 // Constrain artwork to a rectangle entirely inside the circular social crop.
 if(art){const placement=badgePlacement();if(artShape==='medallion')drawMedallion(ctx,art,placement.x,placement.y,placement.size,selectedChoice?.inset);else ctx.drawImage(art,placement.x,placement.y,placement.w,placement.h);}
 if(selectedRibbon)drawRibbon(ctx,selectedRibbon.id,ribbonPlacement());
 ctx.restore();syncCropLabels();syncBadgeControls();syncRibbonControls();
}
const loadArtwork=choice=>choice.gameBadge?gameBadgeArtwork(choice,image):choice.extract==='ancient-oak'?ancientOakArtwork(choice.url,image):image(choice.url);
async function selectArt(choice,button){if(!access.allowed(choice)){status.textContent='This badge is locked. Earn it or verify the required NFTree holding first.';return;}const version=++artVersion;art=null;artReady=false;controls();status.textContent='Loading '+choice.name+'…';document.querySelectorAll('.art-choice').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));try{const loaded=choice.url?await loadArtwork(choice):null;if(version!==artVersion||!access.allowed(choice))return;selectedChoice=choice;art=loaded;artShape=choice.shape||null;badgeAlpha=art?makeBadgeMask(art):null;artReady=true;if(!art)showTools('photo');draw();status.textContent=photo?'Ready to download. Your photo has stayed in this browser.':'Choose a photo, or download this frame with a transparent center.';controls();}catch{if(version!==artVersion)return;draw();status.textContent='Artwork could not load. Choose another design or try again.';controls();}}
for(const choice of choices){const b=document.createElement('button');b.className='art-choice'+(['medallion','rarity'].includes(choice.shape)?' art-choice--medallion':'');if(choice.inset)b.classList.add('art-choice--partner');b.type='button';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',choice.name+' · '+choice.group);const img=document.createElement('img');if(choice.extract||choice.gameBadge)loadArtwork(choice).then(art=>{img.src=art.src;}).catch(()=>{b.title='Canopy Defense artwork could not load. Try again.';});else if(choice.url)img.src=choice.url;else img.hidden=true;img.alt='';img.loading='lazy';if(choice.color)img.style.borderColor=choice.color;const name=document.createElement('span');name.textContent=choice.name;const small=document.createElement('small');small.hidden=true;b.append(img,name,small);b.addEventListener('click',()=>selectArt(choice,b));let group=document.querySelector('[data-art-group="'+choice.group+'"]');if(!group){const section=document.createElement('section');section.className='art-category';const title=document.createElement('h3');title.textContent=choice.group;group=document.createElement('div');group.className='art-gallery';group.dataset.artGroup=choice.group;section.append(title,group);$('art-gallery').append(section);}group.append(b);choiceButtons.set(choice,b);if(choice.monthKey){b.disabled=true;b.classList.add('is-locked');small.hidden=false;small.textContent='Locked · Earn this monthly badge';}}
document.querySelector('[data-art-group="TREE Ecosystem"]').closest('.art-category').before($('studio-owned-nftrees'));
$('profile-photo').addEventListener('change',async event=>{const version=++photoVersion,file=event.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){status.textContent='Choose a JPG, PNG or WebP photo under 20 MB.';event.target.value='';return;}const url=URL.createObjectURL(file);photo=null;controls();try{const loaded=await image(url);if(version!==photoVersion)return;if(loaded.width*loaded.height>60000000)throw Error('Image too large');photo=loaded;reset();status.textContent='Full photo fitted. Drag to position, or use Zoom for a closer crop.';}catch{if(version===photoVersion){status.textContent='This photo could not be opened. Try a smaller JPG, PNG or WebP.';draw();}}finally{URL.revokeObjectURL(url);controls();}});
function badgePlacement(){
 if(!art)return null;
 const dimensions=badgeDimensions(art.width,art.height,Number($('badge-size').value),artShape==='medallion');
 const requested=badgePosition||defaultBadgePosition({...dimensions,lift:selectedChoice?.lift||0});
 const position=constrainBadgePosition({...dimensions,...requested,medallion:artShape==='medallion'});
 if(badgePosition)badgePosition=position;
 return {...dimensions,x:512+position.x-dimensions.w/2,y:512+position.y-dimensions.h/2,offsetX:position.x,offsetY:position.y};
}
function syncBadgeControls(){
 const placement=badgePlacement();
 if(placement){$('badge-x').value=placement.offsetX;$('badge-y').value=placement.offsetY;}
 $('badge-size-value').textContent=Math.round(Number($('badge-size').value)/1024*100)+'%';
}
function moveBadge(x,y){
 if(!art||!artReady||exporting)return;
 const dimensions=badgeDimensions(art.width,art.height,Number($('badge-size').value),artShape==='medallion');
 badgePosition=constrainBadgePosition({...dimensions,x,y,medallion:artShape==='medallion'});draw();
}
function showTools(target){
 for(const layer of ['photo','badge','ribbon']){
  $(layer+'-tools').hidden=layer!==target;
  $('edit-'+layer).setAttribute('aria-pressed',String(layer===target));
 }
}
for(const layer of ['photo','badge','ribbon'])$('edit-'+layer).addEventListener('click',()=>showTools(layer));
// Ribbons use their own position and scale. Editing one never refits the photo
// or changes the badge, and all decoration stays inside the social avatar crop.
function ribbonPlacement(){
 if(!selectedRibbon)return null;
 const dimensions=ribbonDimensions(Number($('ribbon-size').value));
 const position=constrainBadgePosition({...dimensions,...(ribbonPosition||{x:0,y:-280})});
 if(ribbonPosition)ribbonPosition=position;
 return {...dimensions,x:512+position.x-dimensions.w/2,y:512+position.y-dimensions.h/2,offsetX:position.x,offsetY:position.y};
}
function syncRibbonControls(){
 const placement=ribbonPlacement();
 if(placement){$('ribbon-x').value=placement.offsetX;$('ribbon-y').value=placement.offsetY;}
 $('ribbon-size-value').textContent=Math.round(Number($('ribbon-size').value)/1024*100)+'%';
}
function moveRibbon(x,y){
 if(!selectedRibbon||exporting)return;
 ribbonPosition=constrainBadgePosition({...ribbonDimensions(Number($('ribbon-size').value)),x,y});draw();
}
function hitsRibbon(point){
 if(!selectedRibbon)return false;
 const placement=ribbonPlacement(),x=point.x-placement.x,y=point.y-placement.y;
 if(x<0||y<0||x>=placement.w||y>=placement.h)return false;
 if(!ribbonAlpha)return true;
 const mx=Math.min(ribbonAlpha.width-1,Math.floor(x/placement.w*ribbonAlpha.width)),my=Math.min(ribbonAlpha.height-1,Math.floor(y/placement.h*ribbonAlpha.height));
 return ribbonAlpha.pixels[(my*ribbonAlpha.width+mx)*4+3]>16;
}
for(const design of RIBBONS){const option=document.createElement('option');option.value=design.id;option.textContent=design.secondary?design.secondary+' · '+design.label:design.label;$('ribbon-design').append(option);}
$('ribbon-design').addEventListener('change',()=>{
 if(exporting)return;
 selectedRibbon=RIBBONS.find(design=>design.id===$('ribbon-design').value)||null;
 ribbonAlpha=null;
 if(selectedRibbon){const sample=document.createElement('canvas'),dimensions=ribbonDimensions(650);sample.width=650;sample.height=Math.ceil(dimensions.h);drawRibbon(sample.getContext('2d'),selectedRibbon.id,{x:0,y:0,...dimensions});ribbonAlpha=makeBadgeMask(sample);}
 draw();controls();status.textContent=selectedRibbon?'Ribbon added. Drag it or use the Ribbon sliders to find your favorite spot.':'Ribbon removed. Your photo and badge are unchanged.';
});
for(const id of ['ribbon-x','ribbon-y'])$(id).addEventListener('input',()=>moveRibbon(Number($('ribbon-x').value),Number($('ribbon-y').value)));
$('ribbon-size').addEventListener('input',()=>draw());
$('reset-ribbon').addEventListener('click',()=>{ribbonPosition=null;draw();status.textContent='Ribbon returned to the top. Your photo and badge are unchanged.';});
for(const id of ['badge-x','badge-y'])$(id).addEventListener('input',()=>moveBadge(Number($('badge-x').value),Number($('badge-y').value)));
$('reset-badge').addEventListener('click',()=>{badgePosition=null;draw();status.textContent='Badge returned to the bottom. Your photo crop is unchanged.';});
function makeBadgeMask(image){
 try{const mask=document.createElement('canvas'),scale=128/Math.max(image.width,image.height);mask.width=Math.max(1,Math.round(image.width*scale));mask.height=Math.max(1,Math.round(image.height*scale));const context=mask.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,mask.width,mask.height);return {width:mask.width,height:mask.height,pixels:context.getImageData(0,0,mask.width,mask.height).data};}catch{return null;}
}
function hitsBadge(point){
 if(!art||!artReady)return false;
 const placement=badgePlacement(),x=point.x-placement.x,y=point.y-placement.y;
 if(x<0||y<0||x>=placement.w||y>=placement.h)return false;
 if(artShape==='medallion')return Math.hypot(x-placement.w/2,y-placement.h/2)<=placement.size/2;
 if(!badgeAlpha)return true;
 const mx=Math.min(badgeAlpha.width-1,Math.floor(x/placement.w*badgeAlpha.width)),my=Math.min(badgeAlpha.height-1,Math.floor(y/placement.h*badgeAlpha.height));
 return badgeAlpha.pixels[(my*badgeAlpha.width+mx)*4+3]>16;
}
// A custom badge position must not become a horizontal cutoff for the photo.
// Explicit Fit still keeps default bottom clearance until the badge is moved.
function fittedPhoto(){return fitFullPhoto({width:photo.width,height:photo.height,rotation,radius:openingRadius,badgeTop:badgePosition?null:badgePlacement()?.y??null});}
function updatePanLimits(){
 if(!photo)return;
 const limits=photoPanLimits({width:photo.width,height:photo.height,rotation,zoom:Number($('photo-zoom').value)});
 for(const axis of ['x','y']){const input=$('photo-'+axis),value=Number(input.value);input.min=-Math.ceil(limits[axis]);input.max=Math.ceil(limits[axis]);input.value=Math.max(Number(input.min),Math.min(Number(input.max),value));}
}
function syncCropLabels(){
 $('photo-zoom-value').textContent=Math.round(Number($('photo-zoom').value)*100)+'%';
 $('fit-photo').setAttribute('aria-pressed',String(!!photo&&fitMode));
 $('fill-photo').setAttribute('aria-pressed',String(!!photo&&!fitMode&&Number($('photo-zoom').value)===1&&Number($('photo-x').value)===0&&Number($('photo-y').value)===0));
}
function fitPhoto(){
 if(!photo){draw();return;}
 const fitted=fittedPhoto();fitMode=true;
 $('photo-zoom').min=Math.min(.1,fitted.zoom/2);$('photo-zoom').value=fitted.zoom;
 updatePanLimits();$('photo-x').value=fitted.x;$('photo-y').value=fitted.y;draw();
}
function refitPhoto(){if(photo&&fitMode)fitPhoto();else draw();}
function reset(){rotation=0;if(photo)backdropColors=photoBackdropColors(photo,rotation);fitPhoto();}
$('fit-photo').addEventListener('click',()=>{fitPhoto();status.textContent=badgePosition?'Full photo fitted inside the border. Move the badge wherever you prefer.':'Full photo fitted inside the border, with room for your badge.';});
$('fill-photo').addEventListener('click',()=>{if(!photo)return;fitMode=false;$('photo-zoom').value=1;updatePanLimits();$('photo-x').value=0;$('photo-y').value=0;draw();status.textContent='Circle filled. Drag to choose the crop, or select Fit full photo to show more.';});
for(const id of ['photo-zoom','photo-x','photo-y'])$(id).addEventListener('input',()=>{fitMode=false;updatePanLimits();draw();});
$('badge-size').addEventListener('input',()=>draw());
$('rotate-photo').addEventListener('click',()=>{rotation=(rotation+90)%360;if(photo)backdropColors=photoBackdropColors(photo,rotation);updatePanLimits();refitPhoto();});
$('reset-photo').addEventListener('click',reset);

// Pointer capture supports mouse dragging, one-finger dragging and two-finger
// pinch zoom using the same 1024px coordinates as the PNG export.
const photoPointers=new Map();let photoGesture=null,badgeGesture=null,ribbonGesture=null;
function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*1024/rect.width,y:(event.clientY-rect.top)*1024/rect.height};}
function startPhotoGesture(){
 const points=[...photoPointers.values()];
 if(!points.length){photoGesture=null;canvas.classList.remove('is-dragging');return;}
 const center=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
 photoGesture={center,distance:points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0,zoom:Number($('photo-zoom').value),x:Number($('photo-x').value),y:Number($('photo-y').value)};
}
canvas.addEventListener('pointerdown',event=>{
 if(exporting||badgeGesture||ribbonGesture||(event.pointerType==='mouse'&&event.button!==0))return;
 const point=canvasPoint(event);
 if(!photoPointers.size&&hitsRibbon(point)){
  const placement=ribbonPlacement();ribbonGesture={pointerId:event.pointerId,point,x:placement.offsetX,y:placement.offsetY};
  event.preventDefault();canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');showTools('ribbon');return;
 }
 if(!photoPointers.size&&hitsBadge(point)){
  const placement=badgePlacement();badgeGesture={pointerId:event.pointerId,point,x:placement.offsetX,y:placement.offsetY};
  event.preventDefault();canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');showTools('badge');return;
 }
 if(!photo)return;
 if(!photoPointers.size)showTools('photo');
 event.preventDefault();photoPointers.set(event.pointerId,point);canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');startPhotoGesture();
});
canvas.addEventListener('pointermove',event=>{
 if(exporting)return;
 if(ribbonGesture){
  if(event.pointerId!==ribbonGesture.pointerId)return;
  event.preventDefault();const point=canvasPoint(event);moveRibbon(ribbonGesture.x+point.x-ribbonGesture.point.x,ribbonGesture.y+point.y-ribbonGesture.point.y);return;
 }
 if(badgeGesture){
  if(event.pointerId!==badgeGesture.pointerId)return;
  event.preventDefault();const point=canvasPoint(event);moveBadge(badgeGesture.x+point.x-badgeGesture.point.x,badgeGesture.y+point.y-badgeGesture.point.y);return;
 }
 if(!photoPointers.has(event.pointerId)||!photoGesture)return;
 event.preventDefault();photoPointers.set(event.pointerId,canvasPoint(event));const points=[...photoPointers.values()];
 const center=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
 const distance=points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0;
 const zoom=photoGesture.distance>0&&points.length>1?photoGesture.zoom*distance/photoGesture.distance:photoGesture.zoom;
 $('photo-zoom').value=Math.max(Number($('photo-zoom').min),Math.min(Number($('photo-zoom').max),zoom));
 const ratio=Number($('photo-zoom').value)/photoGesture.zoom;updatePanLimits();
 $('photo-x').value=center.x-512-(photoGesture.center.x-512-photoGesture.x)*ratio;
 $('photo-y').value=center.y-512-(photoGesture.center.y-512-photoGesture.y)*ratio;
 fitMode=false;draw();
});
function finishPhotoGesture(event){
 if(ribbonGesture?.pointerId===event.pointerId){ribbonGesture=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return;}
 if(badgeGesture?.pointerId===event.pointerId){badgeGesture=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return;}
 if(!photoPointers.has(event.pointerId))return;
 photoPointers.delete(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);startPhotoGesture();
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finishPhotoGesture);

async function save(onlyFrame){if(!artReady||(!onlyFrame&&!photo)||exporting)return;exporting=true;controls();const choice=selectedChoice;try{if(choice?.monthKey||choice?.nftId)await access.refresh();if(selectedChoice!==choice||!access.allowed(choice||{}))throw Error('Artwork is locked.');draw(!onlyFrame);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Export failed')),'image/png'));if(selectedChoice!==choice||!access.allowed(choice||{}))throw Error('Artwork access changed.');const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=onlyFrame?'tree-profile-frame.png':'tree-profile-picture.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='PNG downloaded. Upload it as your social profile picture.';}catch{status.textContent='Could not export this picture. Try another photo or artwork.';}finally{draw();exporting=false;controls();}}
download.addEventListener('click',()=>save(false));frame.addEventListener('click',()=>save(true));draw();selectArt(choices.find(c=>c.name==='Tree Hero'),[...document.querySelectorAll('.art-choice')].find(b=>b.getAttribute('aria-label').startsWith('Tree Hero ·')));

$('border-theme').addEventListener('change',async()=>{const version=++borderVersion;const key=$('border-theme').value;borderArt=null;borderPhotoClip=null;openingRadius=449;borderReady=false;controls();status.textContent='Loading border artwork…';const file={autumn:'autumn-glow',christmas:'christmas-lights',leafy:'leafy-canopy'}[key];if(!file){borderReady=true;refitPhoto();controls();return;}try{const loaded=await image('/assets/profile-studio/'+file+'.webp');if(version!==borderVersion)return;borderPhotoClip=framePhotoOutline(loaded);openingRadius=frameOpeningRadius(loaded);borderArt=loaded;borderReady=true;refitPhoto();controls();status.textContent=photo?'Your border is ready. Download your profile picture.':'Your border is ready. Add a photo or download the frame.';}catch{if(version===borderVersion){status.textContent='Border could not load. Select another theme or try again.';draw();controls();}}});

renderNFTrees(access.state);void access.refresh();

function renderNFTrees(state){
 const section=$('studio-owned-nftrees');
 let gallery=section.querySelector('.art-gallery');if(!gallery){const note=document.createElement('p');note.className='small';note.dataset.nftNote='';section.append(note);gallery=document.createElement('div');gallery.className='art-gallery';section.append(gallery);}
 section.querySelector('[data-nft-note]').textContent=state.wallet?(state.nfts.length?`${state.nfts.length} NFTree badge${state.nfts.length===1?'':'s'} available.${state.nftMessage?.startsWith('Some')?' '+state.nftMessage:''}`:(state.nftMessage||'Loading your NFT badges…')):'Connect your wallet to load your NFTree badges.';
 const key=state.nfts.map(n=>n.id+':'+n.url).join('|');if(gallery.dataset.key===key)return;gallery.dataset.key=key;
 for(const [choice]of choiceButtons)if(choice.nftId)choiceButtons.delete(choice);gallery.replaceChildren();
 for(const n of state.nfts){const choice={name:n.name,nftId:n.id,url:n.url,rarityLabel:n.rarityLabel,shape:'medallion',group:'NFTs'};const b=document.createElement('button');b.type='button';b.className='art-choice art-choice--medallion';b.setAttribute('aria-label',n.name+' · NFT badge');b.setAttribute('aria-pressed',String(selectedChoice?.nftId===n.id));const img=document.createElement('img');img.src=n.url;img.alt='';img.loading='lazy';const label=document.createElement('span');label.textContent=n.name;const small=document.createElement('small');small.textContent=n.rarityLabel;b.append(img,label,small);b.addEventListener('click',()=>selectArt(choice,b));gallery.append(b);choiceButtons.set(choice,b);availability(choice,b);}
}
$('studio-connect-wallet').addEventListener('click',async()=>{const list=$('studio-wallet-options');list.replaceChildren();try{const wallets=await access.wallets();if(!wallets.length){$('studio-access-status').textContent='No Sui wallet detected. Open this page in Slush or install a supported Sui wallet, then refresh.';return;}for(const w of wallets){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=w.name;b.addEventListener('click',async()=>{b.disabled=true;list.replaceChildren();try{await access.connect(w.id);}catch{$('studio-access-status').textContent='Wallet connection was not completed. Try again.';}finally{b.disabled=false;}});list.append(b);}}catch{$('studio-access-status').textContent='Could not load wallet choices. Refresh to try again.';}});

$('studio-nft-connect').addEventListener('click',()=>{ $('studio-connect-wallet').click();$('studio-connect-wallet').focus(); });
$('studio-nft-refresh').addEventListener('click',()=>void access.refresh());

$('studio-signin').addEventListener('click',async()=>{if(!access.state.wallet){$('studio-connect-wallet').click();$('studio-access-status').textContent='Choose your wallet here, then select Sign in here. You can stay on this page.';return;}try{await access.signIn();}catch(e){$('studio-access-status').textContent=e.message;}});
