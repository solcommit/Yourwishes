"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { PwaRegistration } from "./pwa-registration";
import { BrowserInteractions } from "./browser-interactions";
import { SettingsProvider } from "@/components/settings-provider";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SettingsProvider><PwaRegistration /><BrowserInteractions />{children}</SettingsProvider>
    </NextThemeProvider>
  );
}
