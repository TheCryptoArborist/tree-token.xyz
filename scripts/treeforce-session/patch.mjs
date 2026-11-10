import assert from 'node:assert/strict';
import {drawRetroEnding,drawContinueInvitation} from './retro-ending.mjs';
import {createHash} from 'node:crypto';
export const fingerprints={entry:'cdb7305a4c789f4b185d2b0a1c5327ebf1b55e5fc8d8a9c7752010027a18d137',game:'3683084258395c95f9013a861fcd093bb0c0cbb13f0d69425092a9d17674d657'};
export const sha=s=>createHash('sha256').update(s).digest('hex');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Source drift: '+a.slice(0,90));return s.replace(a,b)};
// The same mounted Phaser instance owns the unfinished flight. No bearer token or
// gameplay state is copied into browser storage; neither can grant extra lives.
export function accountEffect(){
 s.current++;o.current?.abort();l(false);p('');
 const previous=a.current;
 if(previous && !e?.address){window.dispatchEvent(new Event('treeforce-session-suspend'));return;}
 if(previous && previous.wallet===e?.address && previous.expiresAt>Date.now())return;
 a.current=null;i(null);
 if(previous)void sh(previous).catch(()=>{});
 return()=>{s.current++;o.current?.abort();};
}
export function navigationEffect(){
 const check=()=>{
  const session=a.current;
  if(!session)return;
  window.dispatchEvent(new Event('treeforce-session-suspend'));
  if(session.expiresAt<=Date.now()){
   a.current=null;i(null);p('Your game session expired. Verify your NFTree again to play.');
   void sh(session).catch(()=>{});
  }
 };
 const visible=()=>{if(document.visibilityState==='visible')check();};
 window.addEventListener('pagehide',check);window.addEventListener('pageshow',check);
 document.addEventListener('visibilitychange',visible);
 return()=>{window.removeEventListener('pagehide',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',visible);};
}
export function patch(entry,game){
 assert.equal(sha(entry),fingerprints.entry,'Live entry changed; review before patching');
 assert.equal(sha(game),fingerprints.game,'Live game changed; review before patching');
 entry=replace(entry,'(0,x.useEffect)(()=>{s.current++,o.current?.abort();let e=a.current;return a.current=null,i(null),l(!1),p(``),e&&sh(e).catch(()=>{}),()=>{s.current++,o.current?.abort()}},[e?.address])','(0,x.useEffect)('+accountEffect.toString()+',[e?.address])');
 entry=replace(entry,'(0,x.useEffect)(()=>{let e=()=>{a.current&&sh(a.current,{keepalive:!0}).catch(()=>{})};return window.addEventListener(`pagehide`,e),()=>{window.removeEventListener(`pagehide`,e),e()}},[])','(0,x.useEffect)('+navigationEffect.toString()+',[])');
 entry=replace(entry,'return r&&oh(r,e?.address)?','return r&&oh(r,e?.address||r.wallet)?');
 // Hide and make the preserved canvas inert while the extension is disconnected.
 entry=replace(entry,'className:`nftree-game-shell`,children:[','className:`nftree-game-shell`,children:[!e&&(0,S.jsxs)(`section`,{role:`status`,className:`session-reconnect`,children:[(0,S.jsx)(`p`,{children:`Your run is paused. Reconnect the same wallet to resume. No new verification or payment is needed while your session is valid.`}),(0,S.jsx)(nh,{})]}),');
 entry=replace(entry,'(0,S.jsxs)(`div`,{className:`game-viewport`,children:[(0,S.jsx)(ph,','(0,S.jsxs)(`div`,{className:`game-viewport`,hidden:!e,inert:!e,style:!e?{display:`none`}:undefined,children:[(0,S.jsx)(ph,');
 // Listen inside the mounted game bridge, including account disconnects while focused.
 entry=replace(entry,'!a&&o.current&&(i=l(o.current,','!a&&o.current&&(i=l(o.current,'); // assert location only
 entry=replace(entry,'let i,a=!1;return fh(async()=>','let i,a=!1;const suspend=()=>{const scene=i?.scene.getScenes(true).find(scene=>typeof scene.autoPause===\'function\');scene?.autoPause();};window.addEventListener(\'treeforce-session-suspend\',suspend);return fh(async()=>');
 entry=replace(entry,'()=>{a=!0,i?.destroy(!0)}},[e,t,n,r])','()=>{a=!0,window.removeEventListener(\'treeforce-session-suspend\',suspend),i?.destroy(!0)}},[e,t,n,r])');
 entry=replace(entry,'children:c?`Ready to fly again?`:`Keep the canopy alive`','children:c?`Ready to fly again?`:`GAME OVER`');
 entry=replace(entry,'`Restore 3 lives and replay your current wave, keeping your score.`','`Keep your run going? Continue with your current score and wave for 20,000 TREE. Restore 3 lives and replay this wave.`');
 entry=replace(entry,'children:`Pay 20,000 TREE & restore lives`','children:`Pay 20,000 TREE & Continue`');
 game=replace(game,'e.cleared?`CANOPY SECURED`:`CANOPY BREACH`','e.cleared?`CANOPY SECURED`:`GAME OVER`');
 game=replace(game,'`ROOTS HOLD. REGROUP, ARBORWING.`','`KEEP YOUR RUN GOING?`');
 game=replace(game,'`CONTINUE  //  20,000 TREE`,R(13,I.gold)','`PAY 20,000 TREE & CONTINUE`,R(11,I.gold)');
 game=replace(game,'`SAVE SCORE BELOW // OR CONTINUE RUN`','`KEEP SCORE + WAVE // SUI GAS APPLIES`');
 // Layer the new frame after the existing background, before hero and labels.
 game=replace(game,'this.add.text(240,31,`TREE FORCE ’89  //  MISSION REPORT`', '('+drawRetroEnding.toString()+')(this,e.cleared),this.add.text(240,31,`TREE FORCE ’89  //  MISSION REPORT`');
 game=replace(game,'R(27,e.cleared?I.green:I.danger)).setOrigin(.5).setShadow(3,3,L.bg,4)', 'R(e.cleared?27:42,e.cleared?I.gold:I.danger)).setOrigin(.5).setLetterSpacing(2).setShadow(4,4,0x3b1629,0)');
 game=replace(game,'`CANOPY DEBRIEF`,R(11,I.gold)', '`SCORE  //  MISSION RECORD`,R(11,I.gold)');
 game=replace(game,'`START NEW RUN`,R(13,I.gold)', '`NEW GAME`,R(13,I.gold)');
 // Keep a visible gap between the mission panel and the paid action.
 game=replace(game,'this.add.rectangle(240,376,360,188,L.panel,.94)', 'this.add.rectangle(240,364,360,164,L.panel,.94)');
 game=replace(game,'this.add.rectangle(240,488,330,48,L.panel,.98).setStrokeStyle(2,L.gold,.75)', 'this.add.rectangle(240,491,330,54,L.gold,1).setStrokeStyle(3,0xffefad,1)');
 game=replace(game,'this.add.text(240,480,`PAY 20,000 TREE & CONTINUE`,R(11,I.gold))', 'this.add.text(240,490,`PAY 20,000 TREE & CONTINUE`,R(11,`#17101f`))');
 game=replace(game,'this.add.text(240,497,`KEEP SCORE + WAVE // SUI GAS APPLIES`', 'this.add.text(240,529,`KEEP SCORE + WAVE // SUI GAS APPLIES`');
 game=replace(game,'this.add.rectangle(240,550,266,44,L.bgSoft)', 'this.add.rectangle(240,562,266,44,L.bgSoft)');
 game=replace(game,'this.add.text(240,550,e.cleared?', 'this.add.text(240,562,e.cleared?');
 game=replace(game,'this.add.rectangle(240,603,266,38,L.panel)', 'this.add.rectangle(240,615,266,38,L.panel)');
 game=replace(game,'this.add.text(240,603,`RETURN TO TITLE`', 'this.add.text(240,615,`RETURN TO TITLE`');
 // Classic arcade invitation; the transaction still begins in reviewed checkout.
 game=replace(game,'this.add.rectangle(240,364,360,164,L.panel,.94)','this.add.rectangle(240,348,360,132,L.panel,.94)');
 game=replace(game,'R(11,I.text)).setOrigin(.5,0).setAlign(`left`).setLineSpacing(5)', 'R(10,I.text)).setOrigin(.5,0).setAlign(`left`).setLineSpacing(3)');
 game=replace(game,'this.add.rectangle(240,491,330,54,L.gold,1).setStrokeStyle(3,0xffefad,1)', '('+drawContinueInvitation.toString()+')(this),this.add.rectangle(240,507,330,44,0x39205a,1).setStrokeStyle(3,L.gold,1)');
 // The declaration needs the invitation inside the rectangle expression.
 game=replace(game,'let t=('+drawContinueInvitation.toString()+')(this),this.add.rectangle', 'let t=(('+drawContinueInvitation.toString()+')(this),this.add.rectangle');
 game=replace(game,'(240,507,330,44,0x39205a,1).setStrokeStyle(3,L.gold,1);', '(240,507,330,44,0x39205a,1).setStrokeStyle(3,L.gold,1));');
 game=replace(game,'this.add.text(240,490,`PAY 20,000 TREE & CONTINUE`,R(11,`#17101f`))', 'this.add.text(240,507,`▶ CONTINUE YOUR RUN`,R(15,I.gold))');
 game=replace(game,'this.add.text(240,529,`KEEP SCORE + WAVE // SUI GAS APPLIES`,R(9,I.muted))', 'this.add.text(240,540,`20,000 TREE · RESTORE 3 LIVES`,R(11,I.text))');
 game=replace(game,'this.add.rectangle(240,562,266,44,L.bgSoft)', 'this.add.rectangle(240,590,266,34,L.bgSoft)');
 game=replace(game,'this.add.text(240,562,e.cleared?', 'this.add.text(240,590,e.cleared?');
 game=replace(game,'this.add.rectangle(240,615,266,38,L.panel)', 'this.add.rectangle(240,631,266,30,L.panel)');
 game=replace(game,'this.add.text(240,615,`RETURN TO TITLE`', 'this.add.text(240,631,`RETURN TO TITLE`');
 game=replace(game,'this.add.text(240,644,`RUN ${e.run.runId}', 'this.add.text(240,690,`RUN ${e.run.runId}');
 return{entry,game};
}
