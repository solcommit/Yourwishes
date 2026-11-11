"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";

export type AppSettings = {
  appearance: "light" | "dark";
  nickname: string;
  defaultLayout: "grid" | "list";
  density: "comfortable" | "compact";
  fluidAnimations: boolean;
  reduceTransparency: boolean;
  autoPlayVideos: boolean;
};

const defaults: AppSettings = {
  appearance: "dark",
  nickname: "You",
  defaultLayout: "grid",
  density: "comfortable",
  fluidAnimations: true,
  reduceTransparency: false,
  autoPlayVideos: false,
};

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (changes: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const STORAGE_KEY = "yourwishes-settings";
export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useAppSettings must be used within SettingsProvider.");
  return context;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setTheme(defaults.appearance);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          const value = parsed as Omit<Partial<AppSettings>, "appearance"> & {appearance?: string};
          const next: AppSettings = {
            ...defaults,
            appearance: value.appearance === "light" || value.appearance === "dark"
              ? value.appearance : value.appearance === "system"
                ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : defaults.appearance,
            ...(typeof value.nickname === "string" && value.nickname.trim().length > 0 && value.nickname.trim().length <= 32
              ? { nickname: value.nickname.trim() }
              : {}),
            ...(value.defaultLayout === "grid" || value.defaultLayout === "list"
              ? { defaultLayout: value.defaultLayout }
              : {}),
            ...(value.density === "comfortable" || value.density === "compact"
              ? { density: value.density }
              : {}),
            ...(typeof value.fluidAnimations === "boolean"
              ? { fluidAnimations: value.fluidAnimations }
              : {}),
            ...(typeof value.reduceTransparency === "boolean"
              ? { reduceTransparency: value.reduceTransparency }
              : {}),
            ...(typeof value.autoPlayVideos === "boolean"
              ? { autoPlayVideos: value.autoPlayVideos }
              : {}),
          };
          startTransition(() => setSettings(next));
          setTheme(next.appearance);
        }
      }
    } catch (error) {
      console.error("Could not load saved Yourwishes settings.", error);
    } finally {
      startTransition(() => setReady(true));
    }
  }, [setTheme]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.reduceTransparency = String(settings.reduceTransparency);
    document.documentElement.dataset.autoPlayVideos = String(settings.autoPlayVideos);
    document.documentElement.dataset.fluidAnimations = String(settings.fluidAnimations);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save Yourwishes settings.", error);
    }
    const applyVideoPreference = (video: HTMLVideoElement) => {
      video.autoplay = settings.autoPlayVideos;
      if (!settings.autoPlayVideos) video.pause();
    };
    document.querySelectorAll("video").forEach((video) => applyVideoPreference(video));
    const observer = new MutationObserver((records) => {
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) applyVideoPreference(node);
          if (node instanceof Element) {
            node.querySelectorAll<HTMLVideoElement>("video").forEach(applyVideoPreference);
          }
        }),
      );
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready, settings]);

  const updateSettings = useCallback(
    (changes: Partial<AppSettings>) => {
      setSettings((current) => ({ ...current, ...changes }));
      if (changes.appearance) setTheme(changes.appearance);
    },
    [setTheme],
  );

  const contextValue = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
