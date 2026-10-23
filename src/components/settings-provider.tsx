"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

export const BACKGROUND_PRESETS = [
  { value: "dark-aurora", label: "Dark Aurora", colors: ["#6f36ff", "#00c9b0", "#2459db"] },
  { value: "sunset-glow", label: "Sunset Glow", colors: ["#ff6a3d", "#ffb451", "#ff866f"] },
  { value: "pink-cloud", label: "Pink Cloud", colors: ["#ff3f9b", "#f58bb4", "#ffc3d5"] },
  { value: "sky-bloom", label: "Sky Bloom", colors: ["#318bff", "#33d3e8", "#83c9ff"] },
  { value: "emerald-tide", label: "Emerald Tide", colors: ["#20c878", "#17d6b4", "#159ee8"] },
  { value: "lavender-dream", label: "Lavender Dream", colors: ["#a77aff", "#8298ff", "#dac7ff"] },
  { value: "peach-sunrise", label: "Peach Sunrise", colors: ["#ff966c", "#ffd05d", "#ffe2ae"] },
  { value: "electric-pop", label: "Electric Pop", colors: ["#902dff", "#326cff", "#f337c2"] },
  { value: "mint-breeze", label: "Mint Breeze", colors: ["#38d99f", "#21cbb9", "#9cebd2"] },
  { value: "cosmic-berry", label: "Cosmic Berry", colors: ["#f23f9c", "#8c47ef", "#392fba"] },
] as const;

export type BackgroundStyle = (typeof BACKGROUND_PRESETS)[number]["value"];

export type AppSettings = {
  appearance: "light" | "dark" | "system";
  nickname: string;
  backgroundStyle: BackgroundStyle;
  gradientIntensity: "off" | "subtle" | "vivid";
  ambientAnimation: boolean;
  defaultLayout: "grid" | "list";
  density: "comfortable" | "compact";
  fluidAnimations: boolean;
  scrollBezel: boolean;
  reduceTransparency: boolean;
  autoPlayVideos: boolean;
};

const defaults: AppSettings = {
  appearance: "system",
  nickname: "You",
  backgroundStyle: "dark-aurora",
  gradientIntensity: "subtle",
  ambientAnimation: true,
  defaultLayout: "grid",
  density: "comfortable",
  fluidAnimations: true,
  scrollBezel: true,
  reduceTransparency: false,
  autoPlayVideos: false,
};

type SettingsContextValue = {
  settings: AppSettings;
  updateSettings: (changes: Partial<AppSettings>) => void;
  triggerCelebration: () => void;
  profilePhoto: string | null;
  saveProfilePhoto: (file: File) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const STORAGE_KEY = "yourwishes-settings";
const PROFILE_DATABASE = "yourwishes-profile";
const PROFILE_STORE = "photos";
const LEGACY_BACKGROUND_STYLES: Record<string, BackgroundStyle> = {
  aurora: "dark-aurora",
  rose: "pink-cloud",
  ocean: "sky-bloom",
  ember: "sunset-glow",
  neutral: "mint-breeze",
};

function normalizeBackgroundStyle(value: string | undefined): BackgroundStyle | null {
  if (BACKGROUND_PRESETS.some((preset) => preset.value === value)) return value as BackgroundStyle;
  return value ? LEGACY_BACKGROUND_STYLES[value] ?? null : null;
}

function openProfileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local profile photo storage."));
      return;
    }
    const request = indexedDB.open(PROFILE_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PROFILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open profile photo storage."));
  });
}

async function readProfilePhoto() {
  const database = await openProfileDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(PROFILE_STORE, "readonly").objectStore(PROFILE_STORE).get("avatar");
    request.onsuccess = () => {
      const value = request.result;
      // Keep reading older Blob avatars. Byte records also work in WebKit
      // environments whose IndexedDB cannot persist File/Blob values.
      if (value instanceof Blob) resolve(value);
      else if (value?.bytes instanceof ArrayBuffer && typeof value.type === "string" && value.type.startsWith("image/") && value.bytes.byteLength <= 5 * 1024 * 1024) {
        resolve(new Blob([value.bytes], { type: value.type }));
      } else resolve(null);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load the saved profile photo."));
    request.transaction?.addEventListener("complete", () => database.close(), { once: true });
  });
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useAppSettings must be used within SettingsProvider.");
  return context;
}

function SettingsMotion({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const systemReducedMotion = useReducedMotion();
  return (
    <MotionConfig reducedMotion={systemReducedMotion || !settings.fluidAnimations ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { setTheme } = useTheme();
  const celebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          const value = parsed as Partial<AppSettings>;
          const backgroundStyle = normalizeBackgroundStyle(value.backgroundStyle as string | undefined);
          const next: AppSettings = {
            ...defaults,
            ...(value.appearance && ["light", "dark", "system"].includes(value.appearance)
              ? { appearance: value.appearance }
              : {}),
            ...(typeof value.nickname === "string" && value.nickname.trim().length > 0 && value.nickname.trim().length <= 32
              ? { nickname: value.nickname.trim() }
              : {}),
            ...(backgroundStyle
              ? { backgroundStyle }
              : {}),
            ...(value.gradientIntensity && ["off", "subtle", "vivid"].includes(value.gradientIntensity)
              ? { gradientIntensity: value.gradientIntensity }
              : {}),
            ...(typeof value.ambientAnimation === "boolean"
              ? { ambientAnimation: value.ambientAnimation }
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
            ...(typeof value.scrollBezel === "boolean" ? { scrollBezel: value.scrollBezel } : {}),
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

  useEffect(() => () => {
    if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    delete document.documentElement.dataset.celebrating;
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void readProfilePhoto()
      .then((photo) => {
        if (active && photo) {
          objectUrl = URL.createObjectURL(photo);
          setProfilePhoto(objectUrl);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load the saved Yourwishes profile photo.", error);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const saveProfilePhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
    const bytes = await file.arrayBuffer();
    const database = await openProfileDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PROFILE_STORE, "readwrite");
      transaction.objectStore(PROFILE_STORE).put({ bytes, type: file.type }, "avatar");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the profile photo."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving the profile photo was cancelled."));
      transaction.addEventListener("complete", () => database.close(), { once: true });
      transaction.addEventListener("error", () => database.close(), { once: true });
      transaction.addEventListener("abort", () => database.close(), { once: true });
    });
    setProfilePhoto((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.backgroundStyle = settings.backgroundStyle;
    document.documentElement.dataset.gradientIntensity = settings.gradientIntensity;
    document.documentElement.dataset.ambientAnimation = String(settings.ambientAnimation);
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

  const triggerCelebration = useCallback(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !settings.ambientAnimation ||
      !settings.fluidAnimations
    ) return;
    if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    document.documentElement.dataset.celebrating = "true";
    celebrationTimeout.current = setTimeout(() => {
      delete document.documentElement.dataset.celebrating;
      celebrationTimeout.current = null;
    }, 1400);
  }, [settings.ambientAnimation, settings.fluidAnimations]);

  const contextValue = useMemo(
    () => ({ settings, updateSettings, triggerCelebration, profilePhoto, saveProfilePhoto }),
    [settings, updateSettings, triggerCelebration, profilePhoto, saveProfilePhoto],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      <SettingsMotion>{children}</SettingsMotion>
    </SettingsContext.Provider>
  );
}
