import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
let server:ReturnType<typeof createServer>,url:string;
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserInteractions} from './src/components/browser-interactions';createRoot(document.getElementById('root')).render(<><BrowserInteractions/><p id="text">Page text cannot be selected</p><a href="#target">Link</a><img alt="Fixture" width="60" height="60" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="/><input aria-label="Edit" defaultValue="editable text"/><textarea aria-label="Notes" defaultValue="editable notes"/><div id="custom" style={{height:100,width:100,background:'gray'}} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e=>{if(e.buttons===1)window.customMoves=(window.customMoves||0)+1;}}>Custom drag</div></>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
 server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<style>'+readFileSync('src/components/browser-interactions.css','utf8')+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('native page menu, selection and image/link drag are blocked while form editing works',async({page})=>{
 await page.goto(url);await expect(page.locator('body')).toHaveCSS('user-select','none');await expect(page.getByLabel('Edit',{exact:true})).toHaveCSS('user-select','text');
 const prevented=await page.evaluate(()=>{
  const fire=(selector:string,type:string)=>!document.querySelector(selector)!.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
  return {pageMenu:fire('#text','contextmenu'),pageSelect:fire('#text','selectstart'),imageDrag:fire('img','dragstart'),linkDrag:fire('a','dragstart'),inputMenu:fire('input','contextmenu'),inputSelect:fire('input','selectstart')};
 });
 expect(prevented).toEqual({pageMenu:true,pageSelect:true,imageDrag:true,linkDrag:true,inputMenu:false,inputSelect:false});
 await page.getByLabel('Edit',{exact:true}).fill('Edited text');await page.getByLabel('Edit',{exact:true}).press('ControlOrMeta+A');expect(await page.getByLabel('Edit',{exact:true}).evaluate((element:HTMLInputElement)=>element.selectionEnd!-element.selectionStart!)).toBe(11);
 await page.getByLabel('Notes').fill('Updated notes');await expect(page.getByLabel('Notes')).toHaveValue('Updated notes');
});
test('custom pointer dragging remains available',async({page})=>{
 await page.goto(url);const box=await page.locator('#custom').boundingBox();if(!box)throw Error('No target');await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+80,box.y+80,{steps:6});await page.mouse.up();expect(await page.evaluate(()=>(window as unknown as {customMoves:number}).customMoves)).toBeGreaterThan(0);
});
