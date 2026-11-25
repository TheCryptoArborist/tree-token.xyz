import {createFinishAccess} from './finish-access.js';
const listeners=new Set();
export const holderAccess=createFinishAccess({onChange:()=>{for(const listener of listeners)listener();}});
export function onHolderChange(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
