"use client";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useAppSettings } from "../settings-provider";
import "./workspace-background.css";
const LightRays = dynamic(() => import("./LightRays"), {ssr:false,loading:()=>null});
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify:()=>void) => {const media=window.matchMedia(query);media.addEventListener("change",notify);return ()=>media.removeEventListener("change",notify);};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => true;
export function WorkspaceBackground() {
  const {resolvedTheme} = useTheme();
  const {settings} = useAppSettings();
  const reduced = useSyncExternalStore(subscribe,snapshot,serverSnapshot);
  const light = resolvedTheme === "light";
  return <div className="workspace-rays" data-tone={light ? "black" : "white"} aria-hidden="true">
    <LightRays raysOrigin="top-center" raysColor="#ffffff" atmosphere={0} saturation={0}
      raysSpeed={reduced || !settings.fluidAnimations ? 0 : .35} maxDevicePixelRatio={0.75}
      followMouse={false} cursorShadow={false} clickPulse={false} intro={false} />
  </div>;
}
