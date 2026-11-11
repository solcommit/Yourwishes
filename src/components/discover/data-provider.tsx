"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import type {DiscoverSnapshot} from "@/lib/discover/types";
import {toast} from "sonner";
type DataContext={data:DiscoverSnapshot|null;loading:boolean;busy:boolean;error:string;refresh:()=>Promise<void>;save:(method:"POST"|"PATCH"|"DELETE",value:Record<string,unknown>)=>Promise<boolean>};
const Context=createContext<DataContext|null>(null);
async function call(init?:RequestInit){
 const response=await fetch('/api/discover',{...init,credentials:'same-origin',cache:'no-store'});
 if(response.status===401||response.redirected){window.dispatchEvent(new Event('yourwishes-session-ending'));window.location.replace('/sign-in');throw new Error('Please sign in again.');}
 const value=await response.json();if(!response.ok)throw new Error(value.error||'Discover could not sync. Please retry.');return value;
}
export function DiscoverDataProvider({userId,children}:{userId:string;children:ReactNode}){
 const [data,setData]=useState<DiscoverSnapshot|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(false),revision=useRef(0),last=useRef(0),writing=useRef(false),pending=useRef<AbortController|null>(null);
 const load=useCallback(async(force=false)=>{
  if(!userId||!active.current||pending.current||(!force&&Date.now()-last.current<30_000)||!navigator.onLine)return;
  const controller=new AbortController();pending.current=controller;const epoch=++revision.current;setLoading(true);
  try{const next=await call({signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20_000)])});
   if(!active.current||controller.signal.aborted||epoch!==revision.current)return;
   if(next.userId!==userId||!['shortlist','preferences','occasions','shared'].every(key=>Array.isArray(next[key])))throw new Error('Discover response could not be verified.');
   setData(next);setError('');last.current=Date.now();
  }catch(cause){if(active.current&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Discover could not sync.');}
  finally{if(pending.current===controller)pending.current=null;if(active.current&&epoch===revision.current)setLoading(false);}
 },[userId]);
 useEffect(()=>{
  active.current=true;let stopped=false;queueMicrotask(()=>{if(!stopped){setBusy(writing.current);void load();}});
  const refresh=()=>{if(document.visibilityState==='visible'&&!writing.current)void load();};
  const clear=()=>{active.current=false;revision.current++;pending.current?.abort();setData(null);setError('');};
  const timer=setInterval(refresh,60_000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('yourwishes-session-ending',clear);window.addEventListener('yourwishes-private-data-cleared',clear);
  return()=>{stopped=true;active.current=false;pending.current?.abort();pending.current=null;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('yourwishes-session-ending',clear);window.removeEventListener('yourwishes-private-data-cleared',clear);};
 },[load]);
 const save=useCallback(async(method:"POST"|"PATCH"|"DELETE",value:Record<string,unknown>)=>{
  if(writing.current||!active.current)return false;writing.current=true;setBusy(true);last.current=0;revision.current++;pending.current?.abort();pending.current=null;
  try{await call({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(25_000)});if(!active.current)return false;await load(true);toast.success('Saved',{id:'discover-save'});return true;}
  catch(cause){if(active.current){const message=cause instanceof Error?cause.message:'Could not save. Your input is still here.';setError(message);toast.error(message,{id:'discover-save'});}return false;}
  finally{writing.current=false;if(active.current){setBusy(false);setLoading(false);}}
 },[load]);
 const refresh=useCallback(()=>load(true),[load]);
 const context=useMemo(()=>({data,loading,busy,error,refresh,save}),[data,loading,busy,error,refresh,save]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useDiscoverData(){const value=useContext(Context);if(!value)throw new Error('Discover tools require their provider.');return value;}
