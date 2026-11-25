// Host adapter for the recovered NFTreeGateway -> CanopyGame resume props.
// commitResume must synchronously enqueue React state, never schedule another grant.
export function createNativeContinueRenderer({getSession,restoreProgress,commitResume,clock=Date.now}) {
 if(![getSession,restoreProgress,commitResume].every(f=>typeof f==='function'))throw Error('native-render-adapters-required');
 const seen=new Set();
 return ({run,activationId,nativeRunId,sessionEpoch})=>{
  const s=getSession();
  if(!s||s.nativeRunId!==nativeRunId||s.epoch!==sessionEpoch||s.expiresAt<=clock()||run?.runId!==nativeRunId)throw Error('render-session-changed');
  if(seen.has(activationId))throw Error('render-already-attempted');
  seen.add(activationId);
  const resumeRun=restoreProgress(run);
  // Exact native controller pattern: initial game scene and a new component key
  // for this one consumed activation. It is not a new game/run or score submission.
  const result=commitResume({key:nativeRunId+':'+activationId,serverRunId:nativeRunId,initialScene:'game',resumeRun});
  if(result&&typeof result.then==='function')throw Error('synchronous-render-commit-required');
 };
}
