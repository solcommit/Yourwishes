import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import "@/components/ui/gooey-controls.css";

export const metadata: Metadata = {
  title: "Yourwishes",
  description: "A private wishlist for two.",
  applicationName:"Yourwishes",manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Yourwishes",statusBarStyle:"default"},
  icons:{icon:[{url:"/app-icons/icon-192.png",type:"image/png"}],apple:[{url:"/app-icons/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]},
};

export const viewport:Viewport={
  width:"device-width",initialScale:1,viewportFit:"cover",
  themeColor:[{media:"(prefers-color-scheme: light)",color:"#f2f2f7"},{media:"(prefers-color-scheme: dark)",color:"#0b0b11"}],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
