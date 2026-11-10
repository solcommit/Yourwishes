"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "./ui/sonner";
import { SettingsProvider } from "@/components/settings-provider";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SettingsProvider>{children}<Toaster /></SettingsProvider>
    </NextThemeProvider>
  );
}
