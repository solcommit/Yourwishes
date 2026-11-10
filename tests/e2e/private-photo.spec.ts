import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import sharp from "sharp";
import { readFileSync } from "node:fs";

let server: ReturnType<typeof createServer>;
let url: string;
test.beforeAll(async () => {
  const output = await build({ stdin: { contents: `
    import React, {useRef, useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {PrivateWishPhoto} from './src/components/private-wish-photo';
    import {WishBatch} from './src/components/wish-batch';
    import * as cache from './src/lib/private-photo-cache';
    import {Toaster} from 'sonner';
    window.cache = cache;
    function Photo({id,offscreen=false}){const ref=useRef(null);return <div style={offscreen?{marginTop:1200}:{}}><button>Card {id}</button><PrivateWishPhoto src={'/api/wishlist/images/'+id} name={id} list={false} imageRef={ref}/></div>}
    function Batch(){return <WishBatch className="test-batch"><Photo id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"/><Photo id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"/><Photo id="cccccccc-cccc-4ccc-8ccc-cccccccccccc" offscreen/></WishBatch>}
    function Harness(){const ref=useRef(null);const [show,setShow]=useState(true);return <><button onClick={()=>setShow(v=>!v)}>Toggle</button>{show&&<PrivateWishPhoto src="/api/wishlist/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" name="Fixture" list={false} imageRef={ref}/>}<Toaster/></>}
    createRoot(document.getElementById('root')).render(location.search.includes("batch")?<Batch/>:<Harness/>);
  `, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, platform: "browser", format: "esm", loader: {".css":"empty"},
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "image-adapter", setup(builder) {
      builder.onResolve({filter:/^next\/image$/},()=>({path:"image",namespace:"fixture"}));
      builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'import React from "react";export default function Image({unoptimized,...props}){return React.createElement("img",props)}',loader:"jsx",resolveDir:process.cwd()}));
    }}],
  });
  server=createServer((request,response)=>{
    if(request.url==="/app.js"){response.setHeader("Content-Type","text/javascript");response.end(output.outputFiles[0].contents);}
    else {response.setHeader("Content-Type","text/html");response.end('<style>.private-wish-photo{display:block;width:140px;height:140px}'+readFileSync('src/components/wish-batch.css','utf8')+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address(); if(!address||typeof address==="string")throw Error("Harness unavailable");
  url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});

test("failed thumbnail shows toast and a working retry; remount uses memory; sign-out clears it",async({page})=>{
  let requests=0;
  const image=await sharp({create:{width:32,height:32,channels:3,background:"#8844cc"}}).webp().toBuffer();
  await page.route("**/api/wishlist/images/**",route=>{requests++;return requests===1?route.fulfill({status:503}):route.fulfill({contentType:"image/webp",body:image});});
  await page.goto(url);
  await expect(page.getByRole("alert")).toContainText("Photo unavailable");
  await expect(page.locator('[data-sonner-toast]')).toContainText("Photo could not load");
  await page.getByRole("button",{name:"Retry photo for Fixture"}).click();
  await expect(page.locator(".wish-image")).toHaveAttribute("src",/^blob:/);
  await expect(page.getByRole("button",{name:"Retry photo for Fixture"})).toHaveCount(0);
  await page.getByRole("button",{name:"Toggle"}).click();await page.getByRole("button",{name:"Toggle"}).click();
  await expect(page.locator(".wish-image")).toHaveAttribute("src",/^blob:/);
  expect(requests).toBe(2);
  await page.evaluate(()=>window.dispatchEvent(new Event("yourwishes-session-ending")));
  await expect(page.locator(".wish-image")).not.toHaveAttribute("src",/^blob:/);
});

test("shared pending requests are deduplicated, expire, and cannot fill cache after clear",async({page})=>{
  let requests=0;
  const image=await sharp({create:{width:8,height:8,channels:3,background:"#cc4488"}}).webp().toBuffer();
  await page.route("**/api/wishlist/images/**",async route=>{requests++;await route.fulfill({contentType:"image/webp",body:image});});
  await page.goto(url);await expect(page.locator(".wish-image")).toHaveAttribute("src",/^blob:/);
  const path="/api/wishlist/images/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const evaluate=(source:string)=>page.evaluate(source);
  await evaluate(`Promise.all([window.cache.privatePhoto('${path}'),window.cache.privatePhoto('${path}')])`);
  expect(requests).toBe(2);
  await evaluate(`window.cache.privatePhoto('${path}')`); expect(requests).toBe(2);
  await evaluate(`window.cache.prunePrivatePhotos(new Set())`);
  await evaluate(`window.cache.privatePhoto('${path}')`); expect(requests).toBe(3);
  await evaluate(`Date.now=(()=>{const original=Date.now;return()=>original()+31000})()`);
  await evaluate(`window.cache.privatePhoto('${path}')`); expect(requests).toBe(4);
  await page.route("**/api/wishlist/images/cccc*",()=>{});
  const pending="/api/wishlist/images/cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await evaluate(`void (window.pendingPhoto=window.cache.privatePhoto('${pending}').then(()=>false,()=>true))`);
  await evaluate('window.cache.clearPrivatePhotos()');
  expect(await evaluate('window.pendingPhoto')).toBe(true);
});

test("all cards remain hidden until every photo loads, including offscreen; reveal respects reduced motion",async({page})=>{
  let release!: () => void;const gate = new Promise<void>(resolve=>{release=resolve;});
  const image=await sharp({create:{width:32,height:32,channels:3,background:"#8844cc"}}).webp().toBuffer();
  const requests: string[]=[];
  await page.route("**/api/wishlist/images/**",async route=>{
    requests.push(route.request().url());if(route.request().url().includes('cccccccc'))await gate;
    await route.fulfill({contentType:'image/webp',body:image});
  });
  await page.goto(url+'?batch');
  await expect.poll(()=>requests.length).toBe(3);
  await expect(page.locator('.wish-image[src^="blob:"]')).toHaveCount(2);
  await expect(page.locator('.wish-batch')).toHaveAttribute('data-ready','false');
  await expect(page.getByRole('button',{name:/Card/})).toHaveCount(0);
  await expect(page.locator('.app-loader')).toHaveCount(0);
  release();await expect(page.locator('.wish-batch')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('button',{name:/Card/})).toHaveCount(3);
  await expect(page.locator('.wish-batch')).toHaveCSS('animation-name','wish-batch-reveal');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.wish-batch')).toHaveCSS('animation-name','none');
});
test("a failed photo releases the batch and exposes retry instead of hiding everything",async({page})=>{
  const image=await sharp({create:{width:32,height:32,channels:3,background:"#8844cc"}}).webp().toBuffer();
  await page.route('**/api/wishlist/images/**',route=>route.request().url().includes('bbbbbbbb')?route.fulfill({status:503}):route.fulfill({contentType:'image/webp',body:image}));
  await page.goto(url+'?batch');
  await expect(page.locator('.wish-batch')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('button',{name:/Retry photo/})).toBeVisible();
});
