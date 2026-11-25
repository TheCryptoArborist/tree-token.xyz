import test from 'node:test';
import assert from 'node:assert/strict';
import {holidayCountdown,holidayAvailable,HOLIDAY_START,HOLIDAY_END,beginHolidayScene} from '../../treeforce89/frontend/game/holiday-mode.mjs';
test('Central-time boundaries, invalid clocks and year rollover',()=>{
 for(const [time,expected] of [[HOLIDAY_START-1,false],[HOLIDAY_START,true],[HOLIDAY_END-1,true],[HOLIDAY_END,false],[NaN,false],[Infinity,false]])assert.equal(holidayAvailable(time),expected);
 assert.equal(new Date(HOLIDAY_START).toISOString(),'2026-11-27T06:00:00.000Z');
 assert.equal(new Date(HOLIDAY_END).toISOString(),'2027-01-01T06:00:00.000Z');
});
test('run theme freezes through cutoff and same-instance continue; new run expires',()=>{
 let now=HOLIDAY_START;const values=new Map([['holidayPolicy',{selected:'christmas',now:()=>now}]]);
 const scene={sys:{settings:{key:'game'}},game:{registry:values}};
 beginHolidayScene(scene);assert.equal(scene.holidayTheme,'christmas');
 now=HOLIDAY_END;scene.resumeRun={};beginHolidayScene(scene);assert.equal(scene.holidayTheme,'christmas');
 scene.resumeRun=null;beginHolidayScene(scene);assert.equal(scene.holidayTheme,'normal');
});

test('countdown rounds up until unlock and never displays negative time',()=>{
 assert.equal(holidayCountdown(HOLIDAY_START-90061000),'1d 01h 01m 01s');
 assert.equal(holidayCountdown(HOLIDAY_START-1),'0d 00h 00m 01s');
 assert.equal(holidayCountdown(HOLIDAY_START),'35d 00h 00m 00s');
 assert.equal(holidayCountdown(HOLIDAY_END-1),'0d 00h 00m 01s');
 assert.equal(holidayCountdown(HOLIDAY_END),'');
 assert.equal(holidayCountdown(HOLIDAY_END+1),'');
 assert.equal(holidayCountdown(NaN),'');
});
