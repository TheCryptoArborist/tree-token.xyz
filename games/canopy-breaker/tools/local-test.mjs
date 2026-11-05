// Only the local preview server exposes this file. It is excluded from dist and the release.
import {createGame,step} from '../src/engine.js';
let run={id:'local-test',revision:0,state:createGame(42)},principal={address:'LOCAL PLAYTEST',expiresAt:Date.now()+86400000};
const fake={id:'local-invoice',status:'quoted',recipient:'LOCAL SIMULATION',product:'continue',decimals:6,amount:'20000000000'};
window.breakerSession={account:principal,subscribe:()=>()=>{},openAuth:()=>{},async request(action,input={}){if(action==='open')return structuredClone(run);if(action==='frames'){if(run.revision!==input.revision)return {...structuredClone(run),resync:true};for(const i of input.inputs)step(run.state,i);run.revision++;return structuredClone(run);}if(action==='quote')return fake;if(action==='next'){run={...run,state:createGame(42)};return structuredClone(run);}return {};},async history(){return [];},async pay(){if(run.state.status!=='gameover')throw Error('Lose all lives first');run={...run,state:createGame(42)};return structuredClone(run);},async cancel(){}};
document.getElementById('test-notice').hidden=false;document.getElementById('gate-status').textContent='Local mechanics test. NFT access and payments are simulated.';document.querySelector('mysten-dapp-kit-connect-button').hidden=true;document.getElementById('verify').hidden=true;
await import('../src/app.js');
