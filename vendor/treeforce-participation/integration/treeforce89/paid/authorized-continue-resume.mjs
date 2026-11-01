/**
 * Prepare a Phaser resume snapshot only after a trusted backend authorizes
 * the exact interrupted run. This module cannot initiate payments or grant
 * eligibility; its output is gameplay state, not an authorization token.
 *
 * Browser score and wave remain client-side presentation data. They MUST NOT
 * be used by the backend as proof of Game Over or as a reward entitlement.
 */
export function prepareAuthorizedContinue(run,grant,{maxWaves=10}={}) {
  if(!run || typeof run!=="object" || !grant || typeof grant!=="object")
    throw new Error("Missing run or authorization");
  if(grant.authorized!==true || grant.lives!==3)
    throw new Error("Continuation has not been authorized");
  if(typeof run.runId!=="string" || !/^grove-[a-f0-9]{32}$/.test(run.runId) ||
     grant.runId!==run.runId)
    throw new Error("Authorized run does not match");
  if(!Number.isSafeInteger(maxWaves) || maxWaves<1 ||
     !Number.isSafeInteger(run.wave) || run.wave<0 || run.wave>=maxWaves ||
     grant.wave!==run.wave)
    throw new Error("Authorized wave does not match");
  if(run.cleared===true || grant.cleared===true)
    throw new Error("Completed runs cannot be continued");
  const fields=["score","seed","kills","perfect","maxStage","shotsFired","shotsHit","start"];
  for(const field of fields){
    if(!Number.isSafeInteger(run[field]) || run[field]<0)
      throw new Error("Invalid interrupted run state");
  }
  if(run.shotsHit>run.shotsFired || run.maxStage>4 ||
     typeof run.mode!=="string" || run.mode!=="ARCADE")
    throw new Error("Invalid interrupted run state");
  // Explicit whitelist; never copy arbitrary fields such as wallet, payment,
  // continuation flags or browser-supplied authorization.
  return {
    runId:run.runId,seed:run.seed,score:run.score,wave:run.wave,
    kills:run.kills,perfect:run.perfect,maxStage:run.maxStage,
    shotsFired:run.shotsFired,shotsHit:run.shotsHit,start:run.start,mode:"ARCADE",
  };
}
