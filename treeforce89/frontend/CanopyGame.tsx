"use client";
import {useEffect,useRef} from 'react';
import type Phaser from 'phaser';
import type {RunState} from './game/arcade';

type Destination='game'|'title';
type Props={serverRunId?:string;initialScene?:Destination;resumeRun?:RunState;onNewRunRequested?:(destination:Destination)=>Promise<void>;onContinueRequested?:(run:RunState)=>void};

export default function CanopyGame({serverRunId,initialScene='title',resumeRun,onNewRunRequested,onContinueRequested}:Props={}) {
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
        serverRunId,initialScene,resumeRun,
        requestCheckout:run=>checkoutRef.current?.(run),
        requestNewRun:async destination=>{
          if(!requestRef.current)throw Error('Reconnect your wallet to start a new run.');
          await requestRef.current(destination);
        },
      });
    });
    return()=>{cancelled=true;game?.destroy(true);};
  },[serverRunId,initialScene,resumeRun]);
  return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game"/>;
}
