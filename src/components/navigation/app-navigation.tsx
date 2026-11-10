"use client";
import {usePathname} from "next/navigation";
import {useTheme} from "next-themes";
import {Home,Gift,Heart,Compass} from "lucide-react";
import {useReducedMotion} from "motion/react";
import {useAppSettings} from "../settings-provider";
import GooeyNav from "./GooeyNav";
import "./app-navigation.css";
const items=[{href:"/",label:"Home",icon:<Home aria-hidden="true"/>},{href:"/partner",label:"Partner",icon:<Gift aria-hidden="true"/>},{href:"/wishlist",label:"Mine",icon:<Heart aria-hidden="true"/>},{href:"/discover",label:"Discover",icon:<Compass aria-hidden="true"/>}];
export function AppNavigation(){
  const pathname=usePathname();const {resolvedTheme}=useTheme();const {settings}=useAppSettings();const reduced=useReducedMotion()||!settings.fluidAnimations;
  const active=items.findIndex(item=>item.href===pathname||(item.href==="/discover"&&pathname==="/surprises"));
  return <div className="app-gooey-shell"><GooeyNav items={items} activeIndex={Math.max(0,active)} theme={resolvedTheme==="light"?"light":"dark"} frame reducedMotion={!!reduced} hoverEffect={!reduced}/></div>;
}
