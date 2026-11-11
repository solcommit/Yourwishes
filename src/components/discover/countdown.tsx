"use client";
import {useSyncExternalStore} from "react";
import {occasionCountdown,type Occasion} from "@/lib/discover/types";
import {useDiscoverData} from "./data-provider";
import "./tools.css";
function today(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
const subscribe=(notify:()=>void)=>{const timer=setInterval(notify,60_000);window.addEventListener('focus',notify);document.addEventListener('visibilitychange',notify);return()=>{clearInterval(timer);window.removeEventListener('focus',notify);document.removeEventListener('visibilitychange',notify);};};
export function useLocalDay(){return useSyncExternalStore(subscribe,today,()=>'');}
export function OccasionTime({occasion}:{occasion:Occasion}){const day=useLocalDay();const value=occasionCountdown(occasion.date,occasion.annual,day);return <span className="occasion-time">{!value?'…':value.days===0?'Today ♥':value.days<0?'Passed':`${value.days} days to go`}{value&&<small>{value.date}{occasion.kind==='anniversary'&&value.years>0 ? ` · ${value.years} ${value.years===1?"year":"years"}` : ''}</small>}</span>;}
export function DiscoverOccasionSummary({open}:{open:()=>void}){
 const {data,loading,error}=useDiscoverData();const day=useLocalDay();
 const upcoming=(data?.occasions??[]).map(occasion=>({occasion,time:occasionCountdown(occasion.date,occasion.annual,day)})).filter(entry=>entry.time&&entry.time.days>=0).sort((a,b)=>a.time!.days-b.time!.days);
 const next=upcoming.find(entry=>entry.occasion.kind==='anniversary')??upcoming[0];
 return <button type="button" onClick={open} className="discover-countdown">
   <span>{next ? next.occasion.title : 'Your next special day'}</span>
   {next?<OccasionTime occasion={next.occasion}/>:<small>{loading&&!data?'Syncing dates…':error?'Dates unavailable · open to retry':'Add your anniversary or a birthday'}</small>}
 </button>;
}
