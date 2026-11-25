import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Chess} from '../play/grove-chess/vendor/chess.js';
const code=fs.readFileSync(new URL('../play/grove-chess/app.js',import.meta.url),'utf8').replace("import {Chess} from './vendor/chess.js';",'');
function setup(saved=null){
 const nodes=new Map(),timers=new Map();let next=0,data=saved;
 const document={activeElement:null,querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)},createElement:()=>element()};
 function element(){return {children:[],style:{},dataset:{},attributes:{},value:'1',textContent:'',html:'',get innerHTML(){return this.html},set innerHTML(v){this.html=v;this.children=[]},setAttribute(k,v){this.attributes[k]=v},append(c){this.children.push(c)},contains(e){return this.children.includes(e)},querySelector(s){return this.children.find(c=>s.includes('"'+c.dataset.square+'"'))},focus(){document.activeElement=this},showModal(){this.open=true},close(){this.open=false}}}
 const context=vm.createContext({Chess,document,localStorage:{getItem:()=>data,setItem(k,v){data=v}},setTimeout(fn){timers.set(++next,fn);return next},clearTimeout(id){timers.delete(id)},console,Math});
 const run=s=>vm.runInContext(s,context);run(code);
 return {run,nodes,document,timers,saved:()=>data,click:s=>run(`clickSquare('${s}')`),square:s=>nodes.get('#board').children.find(x=>x.dataset.square===s)};
}
const local=setup();local.run("mode='local';render()");
assert.equal(local.nodes.get('#board').children.length,64);
await local.click('e2');assert(local.square('e4').className.includes('legal'));
await local.click('e5');assert.equal(local.run('game.history().length'),0);
for(const sq of ['e2','e4','d7','d5','e4','d5'])await local.click(sq);
assert.equal(local.nodes.get('#captures-w').textContent,'Pawn');
local.nodes.get('#undo').onclick();assert.equal(local.nodes.get('#captures-w').textContent,'None yet');
const restored=setup(local.saved());assert.equal(restored.run('game.fen()'),local.run('game.fen()'));
local.square('e2').focus();local.square('e2').onkeydown({key:'ArrowUp',preventDefault(){}});assert.equal(local.document.activeElement.dataset.square,'e3');
local.nodes.get('#flip').onclick();local.square('e3').onkeydown({key:'ArrowUp',preventDefault(){}});assert.equal(local.document.activeElement.dataset.square,'e2');
local.run("game.reset();['f3','e5','g4','Qh4#'].forEach(m=>game.move(m));render()");assert(local.square('e1').className.includes('in-check'));assert.equal(local.nodes.get('#status').textContent,'Pine wins.');
local.nodes.get('#confirm-new').onclick();assert.equal(local.run('game.history().length'),0);
const ai=setup();await ai.click('e2');await ai.click('e4');assert.equal(ai.timers.size,1);
const reply=[...ai.timers.values()][0];ai.timers.clear();reply();assert.equal(ai.run('game.history().length'),2);assert.equal(ai.run('game.turn()'),'w');
ai.nodes.get('#undo').onclick();assert.equal(ai.run('game.history().length'),0);
await ai.click('d2');await ai.click('d4');ai.nodes.get('#confirm-new').onclick();assert.equal(ai.timers.size,0);assert.equal(ai.run('game.history().length'),0);
for(const type of ['q','r','b','n']){
 const p=setup();p.run("mode='local';game.load('7k/P7/8/8/8/8/8/7K w - - 0 1');render()");await p.click('a7');const pending=p.click('a8');assert(p.nodes.get('#promotion').open);p.nodes.get('#promotion-options').children[['q','r','b','n'].indexOf(type)].onclick();await pending;assert.equal(p.run("game.get('a8').type"),type);
}
console.log('Passed: legal/illegal moves, captures and undo, save/restore, keyboard navigation and flipped board, checkmate, reset, computer reply and undo, pending reply cancellation, all four promotions.');

assert.equal(local.nodes.get('#top-player').style.order,'2');
assert.equal(local.nodes.get('#bottom-player').style.order,'0');
assert(local.run("art('q')").includes('QUEEN'));
assert(local.run("art('p')").includes('tree-crest-pawn.png'));
console.log('Passed flipped player positions, traditional labels, and illustrated pawn mapping.');
