import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
let server: ReturnType<typeof createServer>;
let url: string;
test.beforeAll(async()=>{
  const output=await build({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {WishlistPage} from './src/components/workspace-pages';import {BrowserInteractions} from './src/components/browser-interactions';
    createRoot(document.getElementById('root')).render(<><BrowserInteractions/><WishlistPage owner={location.search.includes('mine')?'you':'partner'}/></>);
  `,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-workspace',setup(builder){
    builder.onResolve({filter:/settings-provider$/},()=>({path:'settings',namespace:'fixture'}));
    builder.onResolve({filter:/profile-photo-provider$/},()=>({path:'profile',namespace:'fixture'}));
    builder.onResolve({filter:/app-shell$/},()=>({path:'workspace',namespace:'fixture'}));
    builder.onResolve({filter:/^next\/(image|link)$/},args=>({path:args.path,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:process.cwd(),contents:args.path==='profile'?`export const useProfilePhoto=()=>({partner:{nickname:'Partner',photo:null}});`:args.path==='settings'?`export const BACKGROUND_PRESETS=[];export const useAppSettings=()=>({settings:{defaultLayout:'grid',fluidAnimations:true},updateSettings:()=>{}});`:args.path==='workspace'?`
      const items=[{id:'one',name:'Partner common',priority:'Common',owner:'partner'},{id:'two',name:'Partner essential',priority:'Legendary',owner:'partner'},{id:'three',name:'Another common',priority:'Common',owner:'partner'},{id:'four',name:'Own private wish',priority:'Rare',owner:'you'}].map(item=>({...item,images:location.search.includes('photos')&&item.id==='one'?['/api/wishlist/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']:[],image:'',price:null}));
      export const useWorkspace=()=>({items:location.search.includes("many")?Array.from({length:55},(_,index)=>({...items[0],id:"wish-"+index,name:"Wish "+index})):items}); export const useWorkspaceActions=()=>({openItem:item=>{window.opened=item.name;}});
    `:args.path==='next/image'?`import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>}`:`import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}` }));
  }}]});
  const css=(readFileSync('src/components/browser-interactions.css','utf8')+readFileSync('src/app/globals.css','utf8')).replace(/^@import.*$/gm,'')+['Folder.css','priority-folders.css'].map(file=>readFileSync('src/components/priority/'+file,'utf8')).join('\n')+readFileSync('src/components/wish-batch.css','utf8')+'body{margin:18px}.desktop-page-heading{display:flex}.priority-browser{width:100%}';
  server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No harness');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('Sort is separate and Partner-only; actual current Folder source isolates and restores folders',async({page})=>{
  await page.goto(url+'?mine');await expect(page.getByRole('button',{name:'Sort',exact:true})).toHaveCount(0);
  await page.goto(url);const sort=page.getByRole('button',{name:'Sort',exact:true});await expect(sort).toBeVisible();
  expect(await sort.evaluate(element=>!!element.closest('.layout-picker'))).toBe(false);
  await sort.click();await expect(page.locator('.folder-root')).toHaveCount(5);
  await expect(page.locator('.priority-folders')).toHaveCSS('animation-name','wish-batch-reveal');
  expect(await page.locator('.folder-root').evaluateAll(elements=>new Set(elements.map(element=>(element as HTMLElement).style.getPropertyValue('--folder-rgb'))).size)).toBe(5);
  await page.locator('.folder-stage').first().focus();await page.keyboard.press('Enter');
  await expect(page.locator('.folder-root')).toHaveCount(1);
  await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.priority-folder-content .wish-batch .wish-tile')).toHaveCount(2);
  await expect(page.locator('.folder-root')).toHaveAttribute('data-draggable','');
  await page.getByRole('button',{name:'← Бүх ангилал'}).click();await expect(page.locator('.folder-root')).toHaveCount(5);
  await page.locator('.folder-stage').nth(1).click();await expect(page.getByRole('status')).toContainText('Энэ ангилалд хүсэл алга.');
  await expect(page.locator('.folder-item')).toHaveCount(0);
  await expect(page.locator('.folder-stage')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.priority-preview-name')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.locator('.folder-root')).toHaveCount(5);
  await page.getByRole('button',{name:'Grid layout'}).click();await expect(page.locator('.folder-root')).toHaveCount(0);
  await expect(page.locator('.wish-tile')).toHaveCount(3);
});
test('native folder pages drag without changing wish data and expanded cards still open',async({page})=>{
  await page.setViewportSize({width:1024,height:850});await page.goto(url);await page.getByRole('button',{name:'Sort',exact:true}).click();
  await page.locator('.folder-stage').first().click();await expect(page.locator('.folder-root')).toHaveCount(1);
  await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-arriving','false');
  const card=page.locator('.folder-item').first();await page.waitForTimeout(500);
  const box=await card.boundingBox();if(!box)throw Error('Missing page');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,box.y+box.height/2+70,{steps:10});
  await expect(page.locator('.folder-root')).toHaveAttribute('data-dragging','');await page.mouse.up();
  await expect(page.locator('.priority-folder-content .wish-batch .wish-tile')).toHaveCount(2);
  expect(await page.evaluate(()=>(window as unknown as {opened?:string}).opened)).toBeUndefined();
  await page.locator('.priority-folder-content .wish-batch .wish-open-target').first().click();
  expect(await page.evaluate(()=>(window as unknown as {opened:string}).opened)).toBe('Partner common');
});
test('responsive folder navigation and reduced motion',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,375,430,768,1024,1920]){
    await page.setViewportSize({width,height:900});await page.goto(url);await page.getByRole('button',{name:'Sort',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.locator('.folder-stage').last().click();await expect(page.locator('.folder-root')).toHaveCount(1);
    await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-arriving','false');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await page.screenshot({path:'performance-results/current-folder-view.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);await page.getByRole('button',{name:'Sort',exact:true}).click();await page.locator('.folder-stage').first().click();
  await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-ready','true');await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-arriving','false');
  await expect(page.locator('.folder-root')).not.toHaveAttribute('data-draggable','');expect(errors).toEqual([]);
});

test('upper and lower folder slots and scroll stay fixed throughout opening',async({page})=>{
  for(const width of [375,768,1920]) {
    for(const priority of ['Common','Legendary']) {
      await page.setViewportSize({width,height:700});await page.goto(url);await page.getByRole('button',{name:'Sort',exact:true}).click();
      const folder=page.locator(`.priority-folder-group[data-priority="${priority}"] .folder-root`);
      await folder.scrollIntoViewIfNeeded();
      const before=await folder.boundingBox();if(!before)throw Error('No folder bounds');
      const scroll=await page.evaluate(()=>window.scrollY);
      await page.locator(`.priority-folder-group[data-priority="${priority}"] .folder-stage`).click();
      for(const delay of [16,80,300]) {
        await page.waitForTimeout(delay);
        const after=await folder.boundingBox();if(!after)throw Error('Folder disappeared');
        expect(Math.abs(after.x-before.x)).toBeLessThan(2);
        expect(Math.abs(after.y-before.y)).toBeLessThan(2);
        expect(Math.abs(await page.evaluate(()=>window.scrollY)-scroll)).toBeLessThan(2);
      }
      await expect(page.locator('.folder-root')).toHaveCount(1);
    }
  }
});

test('desktop mouse drags actual image previews without native image dragging or accidental detail opening',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');
  await page.route('**/api/wishlist/images/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.goto(url+'?photos');await page.getByRole('button',{name:'Sort',exact:true}).click();await page.locator('.folder-stage').first().click();
  await expect(page.locator('.folder-root')).toHaveCount(1);await expect(page.locator('.priority-folder-content .wish-batch')).toHaveAttribute('data-arriving','false');
  const image=page.locator('.folder-item img').first();await expect(image).toHaveAttribute('src',/^blob:/);await expect(image).toHaveAttribute('draggable','false');
  const bounds=await image.boundingBox();if(!bounds)throw Error('No preview image');
  const card=page.locator('.folder-item').first();const before=await card.getAttribute('style');
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+120,bounds.y+bounds.height/2+70,{steps:15});
  await expect(page.locator('.folder-root')).toHaveAttribute('data-dragging','');await page.waitForTimeout(80);expect(await card.getAttribute('style')).not.toBe(before);await page.mouse.up();
  expect(await page.evaluate(()=>(window as unknown as {opened?:string}).opened)).toBeUndefined();
  await expect(page.locator('.folder-root')).not.toHaveAttribute('data-dragging','');
  await image.click();expect(await page.evaluate(()=>(window as unknown as {opened?:string}).opened)).toBe('Partner common');
});

test('large collections load 24 cards per batch without remounting earlier pages',async({page})=>{
  await page.goto(url+'?many');await expect(page.locator('.wish-tile')).toHaveCount(24);
  await page.locator('.wish-tile').first().evaluate(element=>element.setAttribute('data-retained','true'));
  await page.getByRole('button',{name:'Show more wishes'}).click();await expect(page.locator('.wish-tile')).toHaveCount(48);
  await expect(page.locator('.wish-tile').first()).toHaveAttribute('data-retained','true');
  await page.getByRole('button',{name:'Show more wishes'}).click();await expect(page.locator('.wish-tile')).toHaveCount(55);
  await expect(page.getByRole('button',{name:'Show more wishes'})).toHaveCount(0);
});
