"use client";
import Image from "next/image";
import {useState} from "react";
import {motion,useReducedMotion} from "motion/react";
import {useProfilePhoto} from "./profile-photo-provider";
import {useAppSettings} from "./settings-provider";
export function PartnerAvatar(){
  const {partner}=useProfilePhoto();const {settings}=useAppSettings();const [open,setOpen]=useState(false);const reduced=useReducedMotion()||!settings.fluidAnimations;
  return <motion.button type="button" className={`profile-avatar partner-avatar ${open?"profile-avatar-expanded":""}`} layout="size"
    aria-label={`${partner.nickname}: ${open?"Collapse profile photo":"Expand profile photo"}`} aria-expanded={open}
    onPointerEnter={event=>{if(event.pointerType==="mouse")setOpen(true);}} onPointerLeave={event=>{if(event.pointerType==="mouse")setOpen(false);}}
    onClick={event=>{if(event.detail===0||!window.matchMedia("(hover: hover) and (pointer: fine)").matches)setOpen(value=>!value);}}
    onBlur={()=>setOpen(false)} onKeyDown={event=>{if(event.key==="Escape")setOpen(false);}}
    transition={reduced?{duration:0}:{type:"spring",stiffness:300,damping:32}}>
    {partner.photo?<Image src={partner.photo} alt="" fill sizes="224px" unoptimized className="profile-photo"/>:partner.nickname.trim().charAt(0).toUpperCase()||"P"}
  </motion.button>;
}
