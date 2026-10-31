"use client";
import {useEffect,useRef} from 'react';
import type Phaser from 'phaser';
import type {RunState} from './game/arcade';

type Destination='game'|'title';
type Props={homeOnly?:boolean;serverRunId?:string;initialScene?:Destination;resumeRun?:RunState;onNewRunRequested?:(destination:Destination)=>Promise<void>;onContinueRequested?:(run:RunState)=>void};

export default function CanopyGame({homeOnly=false,serverRunId,initialScene='title',resumeRun,onNewRunRequested,onContinueRequested}:Props={}) {
  const mount=useRef<HTMLDivElement>(null);
  const requestRef=useRef(onNewRunRequested);
  requestRef.current=onNewRunRequested;
  const checkoutRef=useRef(onContinueRequested);
  checkoutRef.current=onContinueRequested;
  useEffect(()=>{
    let game:Phaser.Game|undefined;
    let cancelled=false;
    import('./game/arcade').then(({createCanopyGame})=>{
      if(!cancelled && mount.current)game=createCanopyGame(mount.current,{
        homeOnly,serverRunId,initialScene,resumeRun,
        requestCheckout:run=>checkoutRef.current?.(run),
        requestNewRun:async destination=>{
          if(!requestRef.current)throw Error('Reconnect your wallet to start a new run.');
          await requestRef.current(destination);
        },
      });
    });
    return()=>{cancelled=true;game?.destroy(true);};
  },[homeOnly,serverRunId,initialScene,resumeRun]);
  return <div ref={mount} className="phaser-mount" aria-label={homeOnly?"TREE FORCE '89 home screen":"Playable TREE FORCE '89 game"}/>;
}
