import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
let server:ReturnType<typeof createServer>;let url:string;
test.beforeAll(async()=>{
  const output=await build({stdin:{contents:`
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {Toaster} from './src/components/ui/sonner';import {toast} from 'sonner';
    import {Button,IconButton} from './src/components/ui/button';
    function Harness(){const [list,setList]=useState(false);return <>
      <Button onClick={()=>toast.success('Saved',{duration:1800,description:'Your wish is safe.'})}>Notify</Button>
      <Button onClick={()=>toast.error('Photo unavailable',{id:'photo',duration:0})}>Error</Button>
      <Button onClick={()=>toast.dismiss()}>Clear</Button>
      <button className="home-add-icon" aria-label="Add wish">+</button>
      <Button className="priority-sort-toggle" aria-pressed>Sort</Button>
      <div className="layout-picker"><IconButton label="Grid" className={!list?'selected':''} onClick={()=>setList(false)}>G</IconButton><IconButton label="List" className={list?'selected':''} onClick={()=>setList(true)}>L</IconButton></div>
      <Toaster/></>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);
  `,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
  const css=['src/app/globals.css','src/components/ui/gooey-controls.css','src/components/ui/SwipeToast.css','src/components/ui/app-toast.css'].map(f=>readFileSync(f,'utf8').replace(/^@import.*$/gm,'')).join('\n');
  server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><html class="dark"><style>'+css+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('success uses Swipe Toast and fuse; hover pauses timeout; ID deduplication and dismiss work',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await page.getByRole('button',{name:'Notify',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');await expect(page.getByRole('status')).toContainText('Your wish is safe.');
  const card=page.locator('.swipe-toast__card');await card.hover();await page.waitForTimeout(2000);await expect(card).toBeVisible();
  expect(await page.locator('.swipe-toast__fuse').evaluate(e=>e.getAnimations()[0]?.playState)).toBe('paused');
  await page.mouse.move(0,0);await expect(page.getByRole('status')).toHaveCount(0,{timeout:4000});
  await page.getByRole('button',{name:'Error',exact:true}).click();await page.getByRole('button',{name:'Error',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(1);
  await page.getByRole('button',{name:'Close notification'}).click();await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button',{name:'Error',exact:true}).click();await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(0);expect(errors).toEqual([]);
});
test('pointer swipe and keyboard Escape dismiss the official component; session end clears messages',async({page})=>{
  await page.goto(url);await page.getByRole('button',{name:'Error',exact:true}).click();const card=page.locator('.swipe-toast__card');await card.focus();await page.keyboard.press('Escape');await expect(card).toHaveCount(0);
  await page.getByRole('button',{name:'Error',exact:true}).click();await expect(card).toBeVisible();await page.waitForTimeout(500);const box=await card.boundingBox();if(!box)throw Error('No toast');
  await page.mouse.move(box.x+40,box.y+25);await page.mouse.down();await page.mouse.move(box.x+40,box.y+125,{steps:12});await page.mouse.up();await expect(card).toHaveCount(0);
  await page.getByRole('button',{name:'Error',exact:true}).click();await expect(card).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event('yourwishes-session-ending')));await expect(card).toHaveCount(0);
});
test('Gooey-style action controls and toast fit light/dark and narrow screens',async({page})=>{
  await page.goto(url);await page.getByRole('button',{name:'Error',exact:true}).click();
  for(const theme of ['dark','light']){await page.evaluate(t=>document.documentElement.className=t,theme);for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const box=await page.getByRole('status').boundingBox();expect(box?.x).toBeGreaterThanOrEqual(0);expect((box?.x??0)+(box?.width??0)).toBeLessThanOrEqual(width);}}
  await page.getByRole('button',{name:'List',exact:true}).click();await expect(page.getByRole('button',{name:'List',exact:true})).toHaveClass(/selected/);
  await expect(page.getByRole('button',{name:'Add wish'})).toHaveCSS('border-radius','999px');await expect(page.locator('.layout-picker')).toHaveCSS('border-radius','999px');
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Close notification'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('status')).toHaveCount(0);
});
