"use client";

// Immutable photo IDs: retain within this authenticated session, not for 30 seconds.
// Originals have a separate budget so a download cannot evict the card thumbnails.
const VARIANT_BUDGET = 32 * 1024 * 1024;
const ORIGINAL_BUDGET = 8 * 1024 * 1024;
type Entry = {blob:Blob; url?:string; decoded?:Promise<void>; users:number; disposed:boolean};
const entries = new Map<string,Entry>();
const resources = new Set<Entry>();
const pending = new Map<string,{controller:AbortController;promise:Promise<Blob>}>();
let blocked = false;
let generation = 0;
let running = 0;
const waiting: Array<() => void> = [];
function dispose(entry:Entry) { entry.disposed=true; if(entry.url) URL.revokeObjectURL(entry.url); resources.delete(entry); }
function remove(key:string) { const entry=entries.get(key);entries.delete(key);if(entry && !entry.users)dispose(entry); }
export function clearPrivatePhotos() {
  generation++; entries.clear();for(const entry of resources)dispose(entry);
  for(const entry of pending.values())entry.controller.abort();pending.clear();
}
export function invalidatePrivatePhoto(src:string) { remove(src); }
export function prunePrivatePhotos(paths:Set<string>) {
  for(const key of entries.keys())if(!paths.has(key.split("?")[0]))remove(key);
  for(const [key,entry] of pending)if(!paths.has(key.split("?")[0])){entry.controller.abort();pending.delete(key);}
}
if(typeof window!=="undefined") {
  const end=()=>{blocked=true;clearPrivatePhotos();};
  window.addEventListener("yourwishes-session-ending",end);
  window.addEventListener("yourwishes-private-data-cleared",end);
  window.addEventListener("storage",event=>{if(event.key==="yourwishes-session-ended")end();});
  window.addEventListener("pagehide",event=>{if(!event.persisted)clearPrivatePhotos();});
}
async function networkSlot(signal:AbortSignal) {
  if(signal.aborted)throw new Error("Canceled");
  while(running>=6)await new Promise<void>((resolve,reject)=>{
    const start=()=>{signal.removeEventListener("abort",cancel);resolve();};
    const cancel=()=>{const i=waiting.indexOf(start);if(i>=0)waiting.splice(i,1);reject(new Error("Canceled"));};
    waiting.push(start);signal.addEventListener("abort",cancel,{once:true});
  });
  if(signal.aborted){waiting.shift()?.();throw new Error("Canceled");}
  running++;
  return ()=>{running--;waiting.shift()?.();};
}
export async function privatePhoto(src:string):Promise<Blob> {
  if(blocked)throw new Error("Session ended");
  if(!/^\/api\/wishlist\/images\/[0-9a-f-]{36}(?:\?|$)/.test(src))throw new Error("Invalid private image");
  const cached=entries.get(src);if(cached){entries.delete(src);entries.set(src,cached);return cached.blob;}
  const active=pending.get(src);if(active)return active.promise;
  const controller=new AbortController();const epoch=generation;
  const promise=(async()=>{
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(src.includes("width=") ? 15_000 : 45_000)]);
    const release=await networkSlot(signal);
    try {
      const response=await fetch(src,{credentials:"same-origin",cache:"no-store",signal});
      if(response.status===401||response.redirected){window.dispatchEvent(new Event("yourwishes-session-ending"));window.location.replace("/sign-in");throw new Error("Session ended");}
      if(!response.ok)throw new Error("Photo unavailable");
      const blob=await response.blob();
      if(!blob.type.startsWith("image/")||!blob.size||blob.size>5*1024*1024||signal.aborted||blocked||epoch!==generation)throw new Error("Photo unavailable");
      const variant=src.includes("width=");const budget=variant?VARIANT_BUDGET:ORIGINAL_BUDGET;
      const family=()=>[...entries].filter(([key])=>key.includes("width=")===variant);
      while(family().length && (family().length>=256||family().reduce((n,[,e])=>n+e.blob.size,0)+blob.size>budget))remove(family()[0][0]);
      const entry:Entry={blob,users:0,disposed:false};entries.set(src,entry);resources.add(entry);return blob;
    }finally{release();}
  })();
  pending.set(src,{controller,promise});
  try{return await promise;}finally{if(pending.get(src)?.promise===promise)pending.delete(src);}
}
/** Stable decoded blob URL across tab changes; release only this view's lease. */
export async function privatePhotoResource(src:string) {
  const epoch=generation;const blob=await privatePhoto(src);
  if(blocked||epoch!==generation)throw new Error("Session ended");
  const entry=entries.get(src) ?? {blob,users:0,disposed:false};resources.add(entry);entry.users++;
  let released=false;
  const release=()=>{if(released)return;released=true;entry.users--;if(!entry.users && entries.get(src)!==entry)dispose(entry);};
  try{
    if(!entry.url)entry.url=URL.createObjectURL(blob);
    if(!entry.decoded){const decoder=new Image();decoder.decoding="async";decoder.src=entry.url;entry.decoded=decoder.decode();}
    await entry.decoded;
    if(entry.disposed||blocked||epoch!==generation)throw new Error("Session ended");
    return {url:entry.url,release};
  }catch(cause){if(entries.get(src)===entry)remove(src);release();throw cause;}
}
