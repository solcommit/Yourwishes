"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {readLegacyProfilePhoto} from "@/lib/legacy-profile-photo";

type Partner = {nickname:string;photo:string|null};
type Profile = {userId:string;photo:string|null;nickname?:string;partner?:Partner};
type Context = {nickname:string|null;partner:Partner;saveNickname:(nickname:string)=>Promise<void>;profilePhoto:string|null;profileError:string;saveProfilePhoto:(file:File)=>Promise<void>;importLegacyPhoto:()=>Promise<void>};
const ProfileContext=createContext<Context|null>(null);
export function useProfilePhoto(){const context=useContext(ProfileContext);if(!context)throw new Error("ProfilePhotoProvider is required.");return context;}
async function requestProfile(init:RequestInit):Promise<Profile>{
  const response=await fetch("/api/profile",{...init,credentials:"same-origin",cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Profile could not sync. Please retry.");
  return result;
}
export function ProfilePhotoProvider({userId,children}:{userId:string;children:ReactNode}){
  const [nickname,setNickname]=useState<string|null>(null);
  const [partner,setPartner]=useState<Partner>({nickname:"Partner",photo:null});
  const [photo,setPhoto]=useState<string|null>(null);
  const [error,setError]=useState("");
  const active=useRef(false),saving=useRef(false),revision=useRef(0),lastRefresh=useRef(0);
  const pending=useRef<AbortController|null>(null);
  const refresh=useCallback(async(force=false)=>{
    if(!active.current||saving.current||pending.current||!navigator.onLine||(!force&&Date.now()-lastRefresh.current<30_000))return;
    const controller=new AbortController();pending.current=controller;const generation=++revision.current;
    try{
      const result=await requestProfile({signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30_000)])});
      if(active.current&&generation===revision.current&&result.userId===userId){setPhoto(result.photo);if(result.nickname)setNickname(result.nickname);if(result.partner)setPartner(result.partner);lastRefresh.current=Date.now();setError("");}
    }catch(cause){if(active.current&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Profile could not sync.");}
    finally{if(pending.current===controller)pending.current=null;}
  },[userId]);
  useEffect(()=>{
    active.current=true;
    const invalidate = () => { revision.current++; };
    const focus=()=>{if(document.visibilityState==="visible")void refresh(true);};
    const poll=()=>{if(document.visibilityState==="visible")void refresh();};
    const clear=()=>{active.current=false;revision.current++;pending.current?.abort();setPhoto(null);setNickname(null);setPartner({nickname:"Partner",photo:null});setError("");};
    let stopped=false;queueMicrotask(()=>{if(!stopped)void refresh();});
    const timer=setInterval(poll,60_000);
    window.addEventListener("focus",focus);window.addEventListener("online",focus);document.addEventListener("visibilitychange",focus);
    window.addEventListener("yourwishes-session-ending",clear);window.addEventListener("yourwishes-private-data-cleared",clear);
    return()=>{stopped=true;active.current=false;invalidate();pending.current?.abort();pending.current=null;clearInterval(timer);window.removeEventListener("focus",focus);window.removeEventListener("online",focus);document.removeEventListener("visibilitychange",focus);window.removeEventListener("yourwishes-session-ending",clear);window.removeEventListener("yourwishes-private-data-cleared",clear);};
  },[refresh]);
  const saveProfilePhoto=useCallback(async(file:File)=>{
    if(!active.current||saving.current)throw new Error("A profile save is already in progress. Please retry.");
    if(!file.type.startsWith("image/")||!file.size||file.size>5*1024*1024)throw new Error("Choose a photo smaller than 5 MB.");
    saving.current=true;pending.current?.abort();const controller=new AbortController();pending.current=controller;const generation=++revision.current;
    try{
      const body=new FormData();body.set("file",file);
      const result=await requestProfile({method:"POST",body,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60_000)])});
      if(!active.current||generation!==revision.current||result.userId!==userId)throw new Error("Your session changed. Please sign in again.");
      setPhoto(result.photo);if(result.nickname)setNickname(result.nickname);if(result.partner)setPartner(result.partner);setError("");
    }catch(cause){if(active.current)setError(cause instanceof Error?cause.message:"Profile could not save.");throw cause;}
    finally{saving.current=false;if(pending.current===controller)pending.current=null;}
  },[userId]);
  const saveNickname=useCallback(async(nickname:string)=>{
    if(!active.current||saving.current)throw new Error("A profile save is already in progress.");
    saving.current=true;pending.current?.abort();const controller=new AbortController();pending.current=controller;const generation=++revision.current;
    try {
      const result=await requestProfile({method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30_000)])});
      if(!active.current||generation!==revision.current||result.userId!==userId)throw new Error("Your session changed. Please sign in again.");
      setPhoto(result.photo);if(result.nickname)setNickname(result.nickname);setError("");
    }finally{saving.current=false;if(pending.current===controller)pending.current=null;}
  },[userId]);
  const importLegacyPhoto=useCallback(async()=>{
    const blob=await readLegacyProfilePhoto();
    if(!blob)throw new Error("Энэ browser дээр хуучин profile зураг алга. Зургаа сонгоод Save дарна уу.");
    await saveProfilePhoto(new File([blob],"previous-profile-photo",{type:blob.type}));
  },[saveProfilePhoto]);
  const value=useMemo(()=>({nickname,partner,saveNickname,profilePhoto:photo,profileError:error,saveProfilePhoto,importLegacyPhoto}),[nickname,partner,saveNickname,photo,error,saveProfilePhoto,importLegacyPhoto]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
