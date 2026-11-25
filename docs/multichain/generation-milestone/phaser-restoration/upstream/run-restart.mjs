// All replay/title inputs share one pending request. A managed game must wait
// for its React host to obtain a fresh server run; never fall back to offline.
export function createRunRestartController({managed,requestNewRun,startOffline,onPending=()=>{},onError=()=>{}}) {
  let pending=false;
  return async function restart(destination) {
    if(pending)return false;
    if(!['game','title'].includes(destination))throw Error('Invalid destination');
    pending=true;onPending(true);
    try {
      if(managed){
        if(typeof requestNewRun!=='function')throw Error('Reconnect your wallet to start a new run.');
        await requestNewRun(destination);
      }else{await startOffline(destination);}
      return true;
    } catch(error) {
      onError(error instanceof Error?error.message:'A new run could not be confirmed. Please retry.');
      return false;
    } finally {pending=false;onPending(false);}
  };
}
