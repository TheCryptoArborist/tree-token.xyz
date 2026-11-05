import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readControllerFrame,applyControllerInput} from '../treeforce89/frontend/game/gameplay-rules.mjs';
const pad=(...pressed)=>({buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)})),axes:[0,0]});
const game=()=>({paused:false,controllerState:readControllerFrame(undefined),controllerFireHeld:false,shots:0,shields:0,pauses:0,
 fire(){this.shots++},prune(){this.shields++},togglePause(){this.paused=!this.paused;this.pauses++}});
test('either NES face button fires; holding a single button keeps repeat fire enabled',()=>{
 for(const key of [0,1]){const g=game();applyControllerInput(g,pad(key));assert.equal(g.shots,1);applyControllerInput(g,pad(key));assert.equal(g.shots,1);assert.equal(g.controllerFireHeld,true);assert.equal(g.shields,0);}
});
test('A+B shields once per chord and suppresses controller fire until one button is released',()=>{
 const g=game();applyControllerInput(g,pad(0,1));applyControllerInput(g,pad(0,1));assert.equal(g.shields,1);assert.equal(g.shots,0);assert.equal(g.controllerFireHeld,false);
 applyControllerInput(g,pad(0));assert.equal(g.shots,1);assert.equal(g.controllerFireHeld,true);
 applyControllerInput(g,pad(0,1));assert.equal(g.shields,2);
});
test('adding the second button during held fire activates the shield; Select does not',()=>{
 const g=game();applyControllerInput(g,pad(0));applyControllerInput(g,pad(0,1));assert.equal(g.shields,1);assert.equal(g.shots,1);
 applyControllerInput(g,pad(8));assert.equal(g.shields,1);assert.equal(g.controllerFireHeld,false);
});
test('Start pauses and resumes on separate presses and gameplay actions remain blocked while paused',()=>{
 const g=game();applyControllerInput(g,pad(9));assert.equal(g.paused,true);
 applyControllerInput(g,pad(9));assert.equal(g.pauses,1);
 applyControllerInput(g,pad(0,1));assert.equal(g.shields,0);assert.equal(g.shots,0);
 applyControllerInput(g,pad());applyControllerInput(g,pad(9));assert.equal(g.paused,false);assert.equal(g.pauses,2);
});
test('movement, disconnect and held Start on game entry retain predictable edge state',()=>{
 const g=game();assert.equal(readControllerFrame(pad(14)).direction,-1);assert.equal(readControllerFrame(pad(15)).direction,1);
 assert.equal(readControllerFrame(pad(14,15)).direction,0);
 applyControllerInput(g,pad(0));applyControllerInput(g,undefined);assert.equal(g.controllerFireHeld,false);
 g.controllerState=readControllerFrame(pad(9));applyControllerInput(g,pad(9));assert.equal(g.paused,false);
});
