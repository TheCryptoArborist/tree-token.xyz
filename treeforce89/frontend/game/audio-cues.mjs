// Original synthesized TREE FORCE motifs. No Galaga samples or music are used.
const motif=(notes,type='triangle',step=.075,priority=2)=>Object.freeze({notes:Object.freeze(notes),type,step,priority});
export const CUES=Object.freeze({
 windfallIntro:motif([294,440,587,880],"triangle",.14,4),ready:motif([440],"sine",.12,4),go:motif([880,1175],"sine",.08,4),
 seed:motif([660,990]),core:motif([440,660,880],'sine'),upgrade:motif([392,494,587,784],'square',.09,3),
 growth:motif([330,440,554,660]),turbo:motif([740,988,1480],'sawtooth',.065),boom:motif([120,70,45],'sawtooth',.1,3),
 shieldReady:motif([523,659,1047],'sine',.1,3),shieldOn:motif([196,392,784],'sine',.09,3),shieldOff:motif([392,262],'sine',.08,3),
 damage:motif([185,110,73],'sawtooth',.08,3),lifeLost:motif([392,294,196,98],'square',.12,4),
 sector:motif([294,370,440,587],'triangle',.12,4),wave:motif([440,554,660],'triangle',.09,3),
 challenge:motif([392,523,659,784,1047],'square',.1,4),perfect:motif([523,659,784,1047,784,1047],'triangle',.12,4),
 clear:motif([392,494,587,784],'triangle',.1,3),boss:motif([147,139,147,196],'sawtooth',.18,4),
 bossPhase:motif([220,277,330],'sawtooth',.12,3),victory:motif([392,494,587,784,988,1175],'triangle',.15,4),
 resume:motif([330,440,660,880],'sine',.09,4),rescue:motif([392,523,659,1047],'triangle',.12,3),
});
export class CueMixer {
 constructor(){this.voices=[];this.last=new Map();this.duckUntil=0;this.sfxVolume=.7;this.musicVolume=.55;}
 play(context,name){
  const cue=CUES[name];if(!cue)return false;return this.schedule(context,cue,name);
 }
 shot(context,f,d=.05,v=.04){return this.schedule(context,{notes:[f,f*.72],type:f<170?'sawtooth':'square',step:d/2,priority:0,volume:v},'shot',.065);}
 schedule(c,cue,key,gap=.12){
  const now=c.currentTime;if(!this.sfxVolume||now-(this.last.get(key)??-Infinity)<gap)return false;
  this.voices=this.voices.filter(v=>v.until>now);
  if(cue.priority===0&&(this.voices.length>=4||now<this.duckUntil))return false;
  if(cue.priority>0){for(const v of [...this.voices])if(v.priority<cue.priority){try{v.osc.stop(now);}catch{}this.voices.splice(this.voices.indexOf(v),1);}}
  if(this.voices.length+cue.notes.length>10)return false;
  this.last.set(key,now);if(cue.priority>=3)this.duckUntil=now+cue.notes.length*cue.step+.1;
  cue.notes.forEach((frequency,i)=>{const at=now+i*cue.step,osc=c.createOscillator(),gain=c.createGain();osc.type=cue.type;
   osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime((cue.volume??.075)*this.sfxVolume,at+.008);
   gain.gain.exponentialRampToValueAtTime(.001,at+cue.step*.9);osc.connect(gain);gain.connect(c.destination);osc.start(at);osc.stop(at+cue.step);
   const voice={osc,until:at+cue.step,priority:cue.priority};this.voices.push(voice);osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices=this.voices.filter(v=>v!==voice);};
  });return true;
 }
 stop(){for(const v of this.voices)try{v.osc.stop();}catch{}this.voices=[];}
}
