// Public fallback only: never cache authenticated pages, RSC, API or photo responses.
const PREFIX="yourwishes-public-";
const CACHE=PREFIX+"v1";
const PUBLIC=["/offline.html","/app-icons/apple-touch-icon.png","/app-icons/icon-192.png","/app-icons/icon-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(PUBLIC.map(path=>new Request(path,{cache:"reload",credentials:"omit"})));await self.skipWaiting();})());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  // Offline HTML must never replace private API/RSC/photo responses.
  if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/_next/"))return;
  if(PUBLIC.includes(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try {
        const response=await fetch(new Request(request,{credentials:"omit",cache:"no-cache"}));
        if(response.ok&&!response.redirected)await cache.put(url.pathname,response.clone());
        return response;
      } catch {return (await cache.match(url.pathname))||Response.error();}
    })());
    return;
  }
  if(request.mode==="navigate")event.respondWith((async()=>{
    try{return await fetch(request);}
    catch{return (await (await caches.open(CACHE)).match("/offline.html"))||new Response("<!doctype html><html lang='mn'><meta charset='utf-8'><title>Yourwishes · Offline</title><h1>Холболт алга байна</h1><p>Интернэтэд холбогдоод дахин оролдоорой.</p></html>",{headers:{"Content-Type":"text/html; charset=utf-8"}});}
  })());
});
