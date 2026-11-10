"use client";
import {useEffect} from "react";
import "./browser-interactions.css";

function editing(target:EventTarget|null){
  const element=target instanceof Element?target:target instanceof Node?target.parentElement:null;
  return !!element?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
}
/** Block browser-native page gestures without intercepting pointer/touch input. */
export function BrowserInteractions(){
  useEffect(()=>{
    const context=(event:Event)=>{if(!editing(event.target))event.preventDefault();};
    const drag=(event:Event)=>event.preventDefault();
    const selection=(event:Event)=>{if(!editing(event.target))event.preventDefault();};
    document.addEventListener("contextmenu",context,true);
    document.addEventListener("dragstart",drag,true);
    document.addEventListener("selectstart",selection,true);
    return()=>{document.removeEventListener("contextmenu",context,true);document.removeEventListener("dragstart",drag,true);document.removeEventListener("selectstart",selection,true);};
  },[]);
  return null;
}
