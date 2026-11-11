"use client";
import {MotionConfig,useReducedMotion} from "motion/react";
import type {ReactNode} from "react";
import {useAppSettings} from "./settings-provider";
export function AppMotion({children}:{children:ReactNode}) {
  const {settings}=useAppSettings();const reduced=useReducedMotion();
  return <MotionConfig reducedMotion={reduced || !settings.fluidAnimations ? "always" : "never"}>{children}</MotionConfig>;
}
