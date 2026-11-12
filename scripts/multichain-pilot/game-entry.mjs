import {createCanopyGame,stopPilotMusic} from './arcade.ts';
// The copied engine is never connected to Arcade auth, payments or score APIs.
export function startPilotGame(mount,onState){
 const game=createCanopyGame(mount);let scene,held=false,completed=false,disposed=false,last='';
 const snapshot=phase=>({phase,score:scene?.run?.score||0,wave:(scene?.run?.wave||0)+1,lives:Math.max(0,scene?.lives??3)});
 const report=phase=>{const s=snapshot(phase),key=JSON.stringify(s);if(key!==last){last=key;onState(s);}};
 const hold=()=>{if(disposed||held||completed||!scene?.run)return;held=true;scene.lives=0;scene.clearTouchState();scene.paused=true;scene.physics.world.isPaused=true;scene.time.paused=true;scene.updateHud();report('continue');};
 const timer=setInterval(()=>{if(disposed)return;if(!scene){scene=game.scene?.keys?.game;if(scene){const original=scene.endRun.bind(scene);scene.endRun=(cleared=false)=>{if(cleared){completed=true;report('complete');original(true);}else hold();};}}
 if(scene?.run&&!held&&!completed&&game.scene.isActive('game'))report('playing');},100);
 return {requestContinue:hold,resume(){if(disposed||!held||!scene?.run)return false;scene.lives=3;scene.invulnUntil=scene.time.now+3000;scene.player?.setActive(true).setVisible(true).setAlpha(1).clearTint();if(scene.player?.body)scene.player.body.enable=true;scene.bullets?.clear(true,true);scene.clearTouchState();scene.pauseOverlay?.destroy(true);scene.pauseOverlay=undefined;scene.firstRunBriefing=false;scene.paused=false;scene.physics.world.isPaused=false;scene.time.paused=false;scene.pauseButtonText?.setText('Ⅱ PAUSE');scene.updateHud();held=false;report('playing');return true;},destroy(){if(disposed)return;disposed=true;clearInterval(timer);stopPilotMusic();game.destroy(true);}};
}
