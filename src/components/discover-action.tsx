"use client";
import Image from "next/image";
import { Compass, Sparkles, Wallet, ArrowLeftRight, Bookmark, CalendarHeart, HeartHandshake } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { DISCOVER_ICONS } from "@/lib/discover-icons";
import { useAppSettings } from "./settings-provider";
import "./discover.css";

export function DiscoverAction({icon,label,onClick,disabled=false,compact=false}:{
  icon:keyof typeof DISCOVER_ICONS;label:string;onClick:()=>void;disabled?:boolean;compact?:boolean;
}) {
  const {settings}=useAppSettings();
  const reduced=useReducedMotion() || !settings.fluidAnimations;
  const src=DISCOVER_ICONS[icon].src;
  const Icon=({wheel:Compass,instant:Sparkles,budget:Wallet,versus:ArrowLeftRight,shortlist:Bookmark,occasions:CalendarHeart,shared:HeartHandshake})[icon];
  return <motion.button type="button" aria-label={label} className={`discover-icon-action${compact ? " discover-icon-action-compact" : ""}`}
    disabled={disabled} onClick={onClick} whileHover={reduced || disabled ? undefined : {y:-3}}
    whileTap={reduced || disabled ? undefined : {scale:.94,y:1}}
    transition={reduced ? {duration:0} : {type:"spring",stiffness:380,damping:27,mass:.7}}>
    <span className="discover-action-art" data-artwork={!!src}>{src
      ? <Image src={src} alt="" width={96} height={96} sizes="(max-width: 430px) 80px, 96px" draggable={false} />
      : <Icon aria-hidden="true" strokeWidth={1.5} />}</span>
    <span className="discover-action-label">{label}</span>
  </motion.button>;
}
