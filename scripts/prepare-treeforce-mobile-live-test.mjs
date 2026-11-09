import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const source=path.resolve(process.argv[2]||'release/live'),out=path.resolve(process.argv[3]||'release/mobile-live-test');fs.mkdirSync(out,{recursive:true});
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Expected one pinned patch: '+a.slice(0,70));return s.replace(a,b)};
for(const name of ['index.html','assets/index-C7sLq93z.js','assets/arcade-CdwOWItr.js','assets/index-Bw7NF3rR.css','gateway.css']){const dest=path.join(source,path.basename(name));if(!fs.existsSync(dest)){fs.mkdirSync(source,{recursive:true});const response=await fetch('https://tree-token.xyz/play/treeforce89/'+(name==='index.html'?'':name));assert(response.ok,'Could not retrieve pinned live asset '+name);fs.writeFileSync(dest,Buffer.from(await response.arrayBuffer()))}}
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
let entry=fs.readFileSync(path.join(source,'index-C7sLq93z.js'),'utf8');
// Reuse production NFTree/signature/session/restart paths. Only test checkout and
// production score writes are disabled. Local test saves are wallet-separated.
// No new auth endpoint, wallet adapter or DB is added.
assert.equal(crypto.createHash('sha256').update(entry).digest('hex'),'810a2af51cb15df497b9ba2b2a5f28c15c4dcf33f092ae92c31c818c3b886631','Live entry drift; review new source');
entry=replace(entry,'async pay(i){','async pay(i){throw Error(`Payments are disabled in this mobile test.`);');
entry=replace(entry,'async review(t){','async review(t){throw Error(`Payments are disabled in this mobile test. Start a new run or return to title.`);');
entry=entry.replaceAll('treeforce89-pending-continue:','treeforce89-mobile-test-pending-continue:');
// Keep public ranking reads, but save test results only in wallet-keyed device storage.
const profileStart=entry.indexOf('function _h({session:e})');const profileEnd=entry.indexOf('var vh=',profileStart);assert(profileStart>=0&&profileEnd>profileStart);
entry=entry.slice(0,profileStart)+fs.readFileSync(new URL('./treeforce-mobile-test-progress.txt',import.meta.url),'utf8')+entry.slice(profileEnd);
let game=fs.readFileSync(path.join(source,'arcade-CdwOWItr.js'),'utf8');
assert.equal(crypto.createHash('sha256').update(game).digest('hex'),'54a2dc3bd59c23e3e925454d7737dcd038b99ac814c0ccbdcc5d782ce701dab2','Live gameplay drift; review new source');
entry=replace(entry,'3 lives · Continue for 20,000 TREE','3 lives · Test payments disabled');

game=replace(game,'CONTINUE  //  20,000 TREE','TEST PAYMENTS DISABLED');
game=replace(game,'RESTORE 3 LIVES // SAME WAVE & SCORE','SAVE RESULT BELOW // OR START NEW RUN');
game=replace(game,'this.stage===0?`GROW FIRST`:n?`READY -1 GROW`','this.stage===0?`SHIELD\\nGROW FIRST`:n?`SHIELD\\nREADY -1 GROW`');
game=replace(game,'if(this.dragging&&e.id===this.dragPointerId&&e.isDown)','if(!this.paused&&this.dragging&&e.id===this.dragPointerId&&e.isDown)');
game=replace(game,'this.makeHud(),this.bindInput()','this.autoFire=this.sys.game.device.input.touch,this.makeHud(),this.bindInput()');
game=replace(game,'this.badgeText=this.add.text(240,53,','this.badgeText=this.add.text(330,53,');
game=replace(game,'this.makeDebug(),this.updateHud(),this.updateAutoHud()}bindInput(){',`this.pauseButtonBg=this.add.rectangle(240,29,112,58,L.panel,.98).setStrokeStyle(2,L.gold).setInteractive().setDepth(25),this.pauseButtonText=this.add.text(240,29,\`Ⅱ PAUSE\`,R(14,I.gold)).setOrigin(.5).setDepth(26),this.pauseButtonBg.on(\`pointerdown\`,()=>this.togglePause()),this.makeDebug(),this.updateHud(),this.updateAutoHud()}bindInput(){`);
// Keep the complete 160px hero frame above the status panel at Y=608.
// The largest scale is 1.75: center 460 + half-height 140 = 600 (8px clearance).
// Cover initial spawn, reserve respawn, challenge round and windfall resets.
assert.equal(game.split('sprite(240,570,`playerSheet`').length-1,1);
assert.equal(game.split('this.player.setPosition(240,570)').length-1,1);
assert.equal(game.split('this.player.setVelocity(0,0).setPosition(240,570)').length-1,2);
game=replace(game,'sprite(240,570,`playerSheet`','sprite(240,460,`playerSheet`');
game=replace(game,'this.player.setPosition(240,570)','this.player.setPosition(240,460)');
game=game.replaceAll('this.player.setVelocity(0,0).setPosition(240,570)','this.player.setVelocity(0,0).setPosition(240,460)');

// Reserve separate statistic rows and a full-width, evenly spaced action row.
for(const [a,b]of [
 ['(240,678,480,84','(240,664,480,112'],
 ['(12,638,','(12,608,'],['(12,658,','(12,628,'],['(468,658,','(468,608,'],
 ['(55,688,','(320,615,'],['(55,709,86,8','(240,645,456,4'],['(12,709,86*t,5','(12,645,456*t,4'],
 ['(114,701,10','(126,54,14'],['(114,701,`?`','(126,54,`?`'],
 ['(174,701,88,34','(80,684,144,66'],['(174,701,`AUTO FIRE','(80,684,`AUTO FIRE'],
 ['(279,701,110,34','(240,684,144,66'],['(279,701,`','(240,684,`'],
 ['(404,701,128,34','(400,684,144,66'],['(404,701,`','(400,684,`']
])game=game.replaceAll(a,b);
game=replace(game,'this.chainText=this.add.text(468,638,','this.chainText=this.add.text(468,638,');
game=replace(game,'this.makeDebug(),this.updateHud(),this.updateAutoHud()}bindInput(){','this.chainText.setVisible(false),this.autoText.setFontSize(13),this.pruneText.setFontSize(13),this.fireText.setFontSize(13),this.makeDebug(),this.updateHud(),this.updateAutoHud()}bindInput(){');

game=replace(game,'this.game.events.on(n.Core.Events.HIDDEN,this.autoPause,this)}shutdown()',`this.game.events.on(n.Core.Events.HIDDEN,this.autoPause,this);if(this.sys.game.device.input.touch&&!this.resumeRun){let seen=false;try{seen=!!localStorage.getItem('treeforce89_mobile_visual_guide_v2')}catch{}this.mobileGuideSeen=seen;if(!seen)this.togglePause(true)}}shutdown()`);
const old=game.slice(game.indexOf('togglePause(){if(this.guideClose)'),game.indexOf('makeDebug(){let e=['));assert(old.length>100&&old.length<1200);
const pause=fs.readFileSync(new URL('./treeforce-mobile-visual-pause.txt',import.meta.url),'utf8').trim();
game=replace(game,old,pause);
game=replace(game,'e.on(`pointerdown`,()=>this.showPruneGuide())','e.on(`pointerdown`,()=>this.togglePause(true))');
game=game.replaceAll('`/play/treeforce89/assets/','`/play/treeforce89/test/assets/');
const touchbar=fs.readFileSync(new URL('./treeforce-mobile-touchbar.txt',import.meta.url),'utf8');
const factoryStart=game.lastIndexOf('function ae(e,t){');const factoryEnd=game.indexOf('export{ae as createCanopyGame}',factoryStart);assert(factoryStart>=0&&factoryEnd>factoryStart);
let factory=game.slice(factoryStart,factoryEnd);assert(factory.endsWith('})}'));factory=replace(factory,'return new n.Game(','const game=new n.Game(');factory=factory.slice(0,-3)+'});installMobileTouchbar(game,e);return game}';game=game.slice(0,factoryStart)+touchbar+factory+game.slice(factoryEnd);

html=html.replaceAll('/play/treeforce89/assets/','/play/treeforce89/test/assets/').replace('/play/treeforce89/gateway.css','/play/treeforce89/test/gateway.css').replace('<title>', '<meta name="robots" content="noindex,nofollow"><title>Mobile test · ');
html=html.replace('<div id="root">','<div class="mobile-test-notice">MOBILE TEST 6 · PAYMENTS DISABLED</div><div id="root">');
let css=fs.readFileSync(path.join(source,'gateway.css'),'utf8');
css+=`\n.mobile-test-notice{position:fixed;bottom:0;left:0;right:0;height:20px;text-align:center;background:#071810;color:#e4d887;font:700 10px/20px Verdana;z-index:100;pointer-events:none}\n@media(max-width:620px){.game-frame{width:min(100%,calc((100svh - 138px - var(--player-status-height) - env(safe-area-inset-bottom,0px))*2/3));min-height:0;margin-inline:auto}.game-navigation{min-height:38px;padding:4px 8px;gap:8px}.game-navigation a{min-height:30px;padding:5px 8px}.nftree-wallet-bar{min-height:32px;padding:3px 8px}.game-viewport{width:100%;height:auto;aspect-ratio:2/3;overflow:hidden}.game-item-legend{min-height:28px;padding:4px 6px}.site-shell{padding-bottom:24px}.nftree-game-shell canvas,.nftree-game-shell .phaser-mount{touch-action:none}.nftree-game-shell>.game-viewport{overscroll-behavior:contain}.nftree-game-shell .phaser-mount{width:100%;height:auto;aspect-ratio:2/3}.nftree-game-shell canvas{display:block;width:100%!important;height:auto!important;aspect-ratio:2/3}.game-frame:has(.nftree-game-shell) .game-item-legend{display:none}.mobile-test-board{margin:8px 0 24px;padding:0 12px}.mobile-test-board>summary{min-height:44px;display:list-item;align-content:center;font-size:12px;cursor:pointer}}\n`;
css+=fs.readFileSync(new URL('./treeforce-mobile-touchbar.css',import.meta.url),'utf8');
css+=fs.readFileSync(new URL('./treeforce-mobile-test-progress.css',import.meta.url),'utf8');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
for(const [name,content]of [['index.html',html],['gateway.css',css],['assets/index-C7sLq93z.js',entry],['assets/arcade-CdwOWItr.js',game],['assets/index-Bw7NF3rR.css',fs.readFileSync(path.join(source,'index-Bw7NF3rR.css'))]])fs.writeFileSync(path.join(out,name),content);
const endpoints=s=>[...s.matchAll(/`(\/play\/treeforce89\/api\/[^`]*|\/api\/treeforce89-leaderboard)`/g)].map(m=>m[1]).sort();
assert.deepEqual(endpoints(entry),endpoints(fs.readFileSync(path.join(source,'index-C7sLq93z.js'),'utf8')),'Production API paths changed');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const report={sourceSha256:{entry:sha(fs.readFileSync(path.join(source,'index-C7sLq93z.js'))),game:sha(fs.readFileSync(path.join(source,'arcade-CdwOWItr.js')))},authEndpointsUnchanged:true,additionalFunctions:0,paymentsDisabled:true};fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(report,null,2));console.log(report);
