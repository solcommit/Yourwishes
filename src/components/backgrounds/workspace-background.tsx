"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { BACKGROUND_PRESETS, useAppSettings } from "../settings-provider";
import "./workspace-background.css";

const LightRays = dynamic(() => import("./LightRays"), {
  ssr: false,
  // Contain loading so the workspace and its open form never suspend.
  loading: () => null,
});

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function WorkspaceBackground() {
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const { settings } = useAppSettings();
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  if (!hydrated || settings.gradientIntensity === "off") return null;
  const preset = BACKGROUND_PRESETS.find((entry) => entry.value === settings.backgroundStyle) ?? BACKGROUND_PRESETS[0];
  const raysColor = settings.backgroundStyle === "light-rays"
    ? resolvedTheme === "dark" ? "#b8d2ff" : "#6384cf"
    : preset.colors[0];
  const animated = settings.ambientAnimation && settings.fluidAnimations && !settings.reduceTransparency && reducedMotion === false;
  return <div className="workspace-light-rays" aria-hidden="true" data-animated={animated} data-preset={settings.backgroundStyle} data-ray-color={raysColor}
    style={{ opacity: settings.reduceTransparency ? 0.35 : settings.gradientIntensity === "vivid" ? 1 : 0.8 }}>
    {animated && <LightRays raysOrigin="top-center" raysColor={raysColor}
      raysSpeed={0.35} lightSpread={0.65} rayLength={2.5} followMouse={false} cursorShadow={false} clickPulse={false}
      intro={false} haze={0.15} intensity={settings.gradientIntensity === "vivid" ? 1.35 : 0.85}
      opacity={settings.gradientIntensity === "vivid" ? 0.85 : 0.6} maxDevicePixelRatio={1}
      lightMode={resolvedTheme !== "dark"} />}
  </div>;
}
