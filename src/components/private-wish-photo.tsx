"use client";

import Image from "next/image";
import { useBatchPhotos } from "./wish-batch";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidatePrivatePhoto, privatePhoto } from "@/lib/private-photo-cache";
import { Alert, AlertDescription } from "./ui/alert";

export function PrivateWishPhoto({ src, name, list, imageRef }: {
  src: string; name: string; list: boolean; imageRef: React.RefObject<HTMLImageElement | null>;
}) {
  const batch = useBatchPhotos();
  const host = useRef<HTMLSpanElement>(null);
  const requestedUrl = useRef("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ url?: string; error?: boolean; loading?: boolean }>({});
  const retry = () => { setState({}); setAttempt((value) => value + 1); };
  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    const load = async () => {
      setState({ loading: true });
      const requested = (list ? 86 : window.innerWidth < 700 ? 130 : 180) * Math.min(window.devicePixelRatio || 1, 3);
      const width = requested <= 320 ? 320 : requested <= 640 ? 640 : 960;
      const url = `${src}${src.includes("?") ? "&" : "?"}width=${width}`;
      requestedUrl.current = url;
      try {
        const blob = await privatePhoto(url);
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: true });
      } catch {
        if (!alive) return;
        invalidatePrivatePhoto(url);
        setState({ error: true });
        toast.error("Photo could not load", { id: "wish-photo-error", description: "Your wishes are safe. Retry the photo or check your connection." });
      }
    };
    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting)) { observer.disconnect(); void load(); }
    }, { rootMargin: "160px" });
    if (batch) queueMicrotask(() => { if (alive) void load(); });
    else if (host.current) observer.observe(host.current);
    const clear = () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setState({}); };
    window.addEventListener("yourwishes-private-data-cleared", clear);
    window.addEventListener("yourwishes-session-ending", clear);
    return () => { alive = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); window.removeEventListener("yourwishes-private-data-cleared", clear); window.removeEventListener("yourwishes-session-ending", clear); };
  }, [src, list, attempt, batch]);
  return <span ref={host} className="private-wish-photo" data-photo-pending={!state.error && (!state.url || !!state.loading)}>
    {state.url ? <Image ref={imageRef} className="wish-image" src={state.url} alt="" width={720} height={560} unoptimized loading={batch ? "eager" : "lazy"}
      onLoad={() => setState((current) => ({ ...current, loading: false }))}
      onError={() => { invalidatePrivatePhoto(requestedUrl.current); setState({ error: true }); toast.error("Photo could not load", { id: "wish-photo-error" }); }} /> : <span className="wish-image wish-image-empty" />}
    {state.error && <span className="photo-load-error"><Alert><AlertDescription>Photo unavailable</AlertDescription></Alert>
      <button type="button" className="photo-retry" aria-label={`Retry photo for ${name}`} onClick={retry}>Retry photo</button></span>}
  </span>;
}
