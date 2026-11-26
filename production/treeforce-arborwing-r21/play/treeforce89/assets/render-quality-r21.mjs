// Downgrade once per game after two slow active windows; never oscillate mid-run.
export function createQualityMonitor(){
 let start=null,last=null,samples=[],slow=0,fallback=false;
 return {get fallback(){return fallback;},sample(now,active){
  if(fallback)return true;
  if(!active){start=null;last=null;samples=[];slow=0;return false;}
  if(start===null){start=now;last=now;return false;}
  samples.push(Math.min(250,Math.max(0,now-last)));last=now;
  if(now-start<2000||samples.length<12)return false;
  const sorted=samples.slice().sort((a,b)=>a-b);
  slow=sorted[Math.floor(sorted.length/2)]>26?slow+1:0;
  start=now;samples=[];
  if(slow>=2)fallback=true;
  return fallback;
 }};
}
