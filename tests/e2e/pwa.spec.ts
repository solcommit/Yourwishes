import {test,expect} from "@playwright/test";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import sharp from "sharp";
import manifest from "../../src/app/manifest";
let server:ReturnType<typeof createServer>,url:string;
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {PwaRegistration} from './src/components/pwa-registration';createRoot(document.getElementById('root')).render(<PwaRegistration/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});
 server=createServer((req,res)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  if(path==='/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(readFileSync('public/sw.js'));return;}
  if(path==='/offline.html'){res.setHeader('Content-Type','text/html');res.end(readFileSync('public/offline.html'));return;}
  if(path.startsWith('/app-icons/')&&['apple-touch-icon.png','icon-192.png','icon-512.png'].includes(path.split('/').pop()!)){res.setHeader('Content-Type','image/png');res.end(readFileSync('public'+path));return;}
  if(path==='/manifest.webmanifest'){res.setHeader('Content-Type','application/manifest+json');res.end(JSON.stringify(manifest()));return;}
  if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);return;}
  res.setHeader('Cache-Control','private, no-store');
  if(path.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({secret:'PRIVATE_AVATAR_AND_WISH_DATA'}));return;}
  res.setHeader('Content-Type','text/html');res.end('<html><head><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/app-icons/apple-touch-icon.png"></head><body><h1>PRIVATE_AUTHENTICATED_PAGE</h1><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('standalone manifest and real PNG icons have correct sizes and opaque backgrounds',async()=>{
 const data=manifest();expect(data.display).toBe('standalone');expect(data.scope).toBe('/');expect(data.id).toBe('/');expect(data.start_url).toBe('/');
 for(const [name,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]] as const){const image=await sharp(readFileSync('public/app-icons/'+name)).metadata();expect(image.width).toBe(size);expect(image.height).toBe(size);expect(image.hasAlpha).toBe(false);}
});
test('public PWA endpoints bypass auth proxy while private routes remain protected',async()=>{
 const output=await build({entryPoints:['src/proxy.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
 const loaded={exports:{}};new Function('require','module',output.outputFiles[0].text)(createRequire(resolve('package.json')),loaded);
 const config=(loaded.exports as {config:{matcher:string[]}}).config;
 const matcher=new RegExp('^'+config.matcher[0]+'$');
 for(const path of ['/sw.js','/offline.html','/manifest.webmanifest','/app-icons/icon-512.png'])expect(matcher.test(path),path).toBe(false);
 for(const path of ['/','/partner','/wishlist','/api/profile','/api/profile/photo','/api/wishlist','/sw.js/private'])expect(matcher.test(path),path).toBe(true);
});
test('installed worker caches only public assets, provides offline navigation and never fakes private API responses',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});try{
  const page=await context.newPage();await page.goto(url);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await page.evaluate(async()=>{await fetch('/api/profile');await fetch('/api/wishlist/images/fixture');await fetch('/partner?_rsc=private');await fetch('/api/wishlist',{method:'POST',body:'private edit'});});
  const cached=await page.evaluate(async()=>{const result:string[]=[];for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys())result.push(new URL(request.url).pathname);}return result.sort();});
  expect(cached).toEqual(['/app-icons/apple-touch-icon.png','/app-icons/icon-192.png','/app-icons/icon-512.png','/offline.html']);
  await context.setOffline(true);await page.goto(url+'/partner');await expect(page.getByRole('heading',{name:'Холболт алга байна'})).toBeVisible();expect(await page.locator('body').innerText()).not.toContain('PRIVATE_');
  expect(await page.evaluate(async()=>{try{await fetch('/api/profile');return false;}catch{return true;}})).toBe(true);
  await context.setOffline(false);await page.getByRole('link',{name:'Дахин оролдох'}).click();await expect(page.getByRole('heading',{name:'PRIVATE_AUTHENTICATED_PAGE'})).toBeVisible();
 }finally{await context.close();}
});
