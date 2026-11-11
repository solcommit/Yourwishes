"use client";
import { useEffect } from "react";
import { toast, useSonner } from "sonner";
import { CircleCheck, CircleAlert, Info } from "lucide-react";
import SwipeToast from "./SwipeToast";
import "./app-toast.css";

/** Existing toast events, rendered entirely by the official React Bits Swipe Toast. */
export function Toaster() {
  const {toasts} = useSonner();
  useEffect(() => {
    const clear = () => toast.dismiss();
    window.addEventListener("yourwishes-session-ending",clear);
    window.addEventListener("yourwishes-private-data-cleared",clear);
    return () => {window.removeEventListener("yourwishes-session-ending",clear);window.removeEventListener("yourwishes-private-data-cleared",clear);};
  }, []);
  return <div className="app-toast-stack" aria-label="Notifications">{toasts.slice(0,4).map(item => {
    const Icon = item.type === "error" ? CircleAlert : item.type === "success" ? CircleCheck : Info;
    return <SwipeToast key={item.id} inline title={typeof item.title === "function" ? item.title() : item.title}
      description={typeof item.description === "function" ? item.description() : item.description}
      icon={<Icon size={18} />} background="var(--surface)" color="var(--foreground)"
      fuseColor={item.type === "error" ? "var(--system-red)" : item.type === "success" ? "var(--system-green)" : "var(--foreground)"}
      radius={24} width={376} closeButton dismissible={item.dismissible !== false}
      duration={item.duration === Infinity || item.type === "loading" ? 0 : item.duration ?? 5000}
      onClose={reason => {if(reason === "timeout") item.onAutoClose?.(item);else item.onDismiss?.(item);toast.dismiss(item.id);}} />;
  })}</div>;
}
