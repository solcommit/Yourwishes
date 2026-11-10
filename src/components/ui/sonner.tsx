"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn/ui Sonner adapter, themed with the existing application tokens.
export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();
  return <Sonner theme={theme as ToasterProps["theme"]} richColors closeButton
    position="bottom-right" toastOptions={{ className: "app-toast" }} {...props} />;
}
