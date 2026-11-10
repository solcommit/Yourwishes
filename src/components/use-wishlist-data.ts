"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishInput } from "@/lib/wishlist/types";
import { prunePrivatePhotos } from "@/lib/private-photo-cache";
import { reconcileWishes } from "@/lib/wishlist/reconcile";

const REVALIDATE_MS = 30_000;

export async function wishRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000);
  const response = await fetch(url, { ...init, signal, cache: "no-store", credentials: "same-origin" });
  if (response.status === 401 || response.redirected) {
    window.dispatchEvent(new Event("yourwishes-session-ending"));
    window.location.replace("/sign-in");
    throw new Error("Please sign in again.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not complete the request. Please retry.");
  return result;
}

export function useWishlistData(userId: string) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const active = useRef(true);
  const request = useRef<Promise<void> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const lastFetch = useRef(0);
  const failures = useRef(0);
  const mutation = useRef(false);

  const refresh = useCallback(async (force = true) => {
    if (!active.current || mutation.current) return;
    if (request.current) return request.current;
    if (!force && Date.now() - lastFetch.current < REVALIDATE_MS) return;
    if (!navigator.onLine) {
      setError("You're offline. Your loaded wishes are still available. Reconnect and retry.");
      setLoading(false);
      return;
    }
    lastFetch.current = Date.now();
    const controller = new AbortController();
    abort.current = controller;
    const promise = (async () => {
      try {
        const result = await wishRequest<{ userId: string; items: WishlistItem[]; warning: string }>("/api/wishlist", { signal: controller.signal });
        if (!active.current || controller.signal.aborted) return;
        if (result.userId !== userId) {
          window.dispatchEvent(new Event("yourwishes-session-ending"));
          window.location.replace("/sign-in");
          return;
        }
        prunePrivatePhotos(new Set(result.items.flatMap((item) => item.images ?? (item.image ? [item.image] : []))));
        failures.current = 0;
        startTransition(() => {
          setItems((current) => reconcileWishes(current, result.items));
          setHasLoaded(true); setError(""); setWarning(result.warning);
        });
      } catch {
        if (active.current && !controller.signal.aborted) {
          failures.current++;
          setError("Could not refresh wishes. Your loaded wishes are still available. Please retry.");
        }
      } finally {
        if (active.current && !controller.signal.aborted) setLoading(false);
      }
    })();
    request.current = promise;
    await promise;
    if (request.current === promise) request.current = null;
  }, [userId]);

  useEffect(() => {
    active.current = true;
    const clear = () => {
      active.current = false; abort.current?.abort(); setItems([]); setHasLoaded(false); setError(""); setWarning("");
      window.dispatchEvent(new Event("yourwishes-private-data-cleared"));
    };
    const otherTab = (event: StorageEvent) => { if (event.key === "yourwishes-session-ended") { clear(); window.location.replace("/sign-in"); } };
    const focus = () => { if (document.visibilityState === "visible") void refresh(false); };
    const online = () => { if (document.visibilityState === "visible") void refresh(); };
    const offline = () => { setError("You're offline. Your loaded wishes are still available. Reconnect and retry."); };
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine) await refresh(false);
      if (!stopped) timer = setTimeout(poll, Math.min(REVALIDATE_MS * 2 ** failures.current, 120_000));
    };
    timer = setTimeout(poll, REVALIDATE_MS);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("storage", otherTab);
    window.addEventListener("yourwishes-session-ending", clear);
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session?.user.id && session.user.id !== userId)) { clear(); window.location.replace("/sign-in"); }
    });
    // Strict Mode's setup/cleanup probe must not start a request that is
    // immediately aborted and duplicated by the following setup.
    queueMicrotask(() => { if (!stopped) void refresh(); });
    return () => {
      stopped = true;
      active.current = false; abort.current?.abort(); request.current = null; subscription.unsubscribe(); clearTimeout(timer);
      window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("storage", otherTab); window.removeEventListener("yourwishes-session-ending", clear);
      window.removeEventListener("online", online); window.removeEventListener("offline", offline);
    };
  }, [refresh, userId]);

  const saveItem = useCallback(async (input: WishInput) => {
    if (mutation.current || !active.current) throw new Error("A save is already in progress.");
    mutation.current = true;
    abort.current?.abort();
    if (request.current) await request.current;
    try {
      const result = await wishRequest<{ warning: string }>("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!active.current) return;
      setWarning(result.warning);
    } finally { mutation.current = false; }
    void refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (item: WishlistItem) => {
    if (mutation.current || !active.current) throw new Error("A change is already in progress.");
    mutation.current = true; abort.current?.abort();
    if (request.current) await request.current;
    try {
      const params = new URLSearchParams({ id: item.id, version: item.updatedAt });
      const result = await wishRequest<{ warning: string }>(`/api/wishlist?${params}`, { method: "DELETE" });
      if (active.current) { setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setWarning(result.warning); }
    } finally { mutation.current = false; }
    void refresh();
  }, [refresh]);
  return { items, loading, hasLoaded, error, warning, refresh, saveItem, deleteItem };
}
