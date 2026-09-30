import { mayanInput, simulateMayan } from '../lib/gateway-mayan-simulation.ts';
const reply = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createMayanHandler(simulate=simulateMayan) {
  return async(request:Request) => {
    if(request.method!=='POST') return reply({error:'Use the read-only Mayan simulation.'},405);
    let input;
    try {
      if(!request.headers.get('content-type')?.startsWith('application/json')) throw Error();
      const text=await request.text(); if(text.length>512) throw Error();
      input=mayanInput(JSON.parse(text));
    } catch { return reply({error:'A valid source address, Sui recipient and Base USDC amount are required.'},400); }
    let timer;
    try {
      const result=await Promise.race([simulate(input),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),25000);})]);
      return reply(result);
    } catch { return reply({status:'not-passed',message:'Mayan simulation was unavailable, reverted, expired, or returned an unsupported route. No transaction was approved, signed or sent.',signed:false,submitted:false,routeReady:false},422); }
    finally { clearTimeout(timer); }
  };
}
export default createMayanHandler();
export const config={path:'/api/tree-gateway-mayan-simulate'};
