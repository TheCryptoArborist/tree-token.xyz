// Shared cosmetic schedule and copy for the game and Arcade cabinet.
export const HOLIDAY_START = Date.parse('2026-11-27T06:00:00Z');
export const HOLIDAY_END = Date.parse('2027-01-01T06:00:00Z');
export function holidayAvailable(now = Date.now()) {return Number.isFinite(now) && now >= HOLIDAY_START && now < HOLIDAY_END;}
export function holidayCountdown(now = Date.now()) {
 if(!Number.isFinite(now)||now>=HOLIDAY_END)return '';
 const seconds=Math.ceil(((now<HOLIDAY_START?HOLIDAY_START:HOLIDAY_END)-now)/1000);
 return `${Math.floor(seconds/86400)}d ${String(Math.floor(seconds%86400/3600)).padStart(2,'0')}h ${String(Math.floor(seconds%3600/60)).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;
}
export function holidayMessage(now = Date.now()) {
 if(!Number.isFinite(now)||now>=HOLIDAY_END)return '';
 return now<HOLIDAY_START?'A little Christmas magic arrives in…':'Keep the Christmas spirit flying! Time remaining…';
}
